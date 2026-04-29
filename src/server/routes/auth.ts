import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureUserDir, loadPreferences, savePreferences, userDir } from '../data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// In-memory sessions: token → { username, isAdmin, expiresAt }
interface Session {
  username: string;
  isAdmin: boolean;
  expiresAt: number;
}

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Synology DSM API base URL (running on the same NAS)
const DSM_URL = process.env.DSM_URL || 'http://localhost:5000';

/**
 * Initialize a new user on first login.
 * Creates user directory, preferences, and empty collection/progress files.
 */
function initializeUser(username: string) {
  ensureUserDir(username);
  const dir = userDir(username);

  // Create preferences if missing
  const prefsPath = path.join(dir, 'preferences.json');
  if (!fs.existsSync(prefsPath)) {
    savePreferences(username, { theme: 'midnight', safeMode: true });
    console.log(`  Initialized preferences for "${username}"`);
  }

  // Create empty collection if missing or corrupt
  const collPath = path.join(dir, 'collection.jsonl');
  if (!fs.existsSync(collPath) || fs.statSync(collPath).size <= 1) {
    fs.writeFileSync(collPath, '');
    console.log(`  Initialized collection for "${username}"`);
  }

  // Create empty progress if missing or corrupt
  const progPath = path.join(dir, 'progress.jsonl');
  if (!fs.existsSync(progPath) || fs.statSync(progPath).size <= 1) {
    fs.writeFileSync(progPath, '');
    console.log(`  Initialized progress for "${username}"`);
  }
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt < now) sessions.delete(token);
  }
}

// Periodic cleanup every hour
setInterval(cleanExpiredSessions, 60 * 60 * 1000);

/**
 * Login via Synology DSM API.
 * In local dev mode (DSM_URL not configured or unreachable), accepts any credentials.
 */
router.post('/auth/login', async (req, res) => {
  const { username, password, otpCode } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  try {
    // Try Synology DSM authentication
    let loginUrl = `${DSM_URL}/webapi/entry.cgi?api=SYNO.API.Auth&version=6&method=login&account=${encodeURIComponent(username)}&passwd=${encodeURIComponent(password)}&enable_syno_token=yes`;
    if (otpCode) {
      loginUrl += `&otp_code=${encodeURIComponent(otpCode)}`;
    }

    const dsmRes = await fetch(loginUrl, { signal: AbortSignal.timeout(5000) });
    const dsmData = await dsmRes.json();

    if (!dsmData.success) {
      // Error 403 = OTP required
      if (dsmData.error?.code === 403) {
        res.status(200).json({ ok: false, otpRequired: true });
        return;
      }
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    // Determine admin status — DSM API doesn't return this directly,
    // but we can check via SYNO.Core.User.Get if needed.
    // For now, treat the first user or "admin" as admin.
    const isAdmin = username.toLowerCase() === 'admin' || username.toLowerCase() === (process.env.ADMIN_USER || '').toLowerCase();

    // Logout from DSM (we don't need the DSM session, just validated creds)
    fetch(`${DSM_URL}/webapi/entry.cgi?api=SYNO.API.Auth&version=6&method=logout&_sid=${dsmData.data?.sid || ''}`).catch(() => {});

    // Initialize user data on first login
    initializeUser(username);

    // Create our own session
    const token = generateToken();
    sessions.set(token, {
      username,
      isAdmin,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    // Set HTTP-only cookie
    res.cookie('comic-session', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_TTL_MS,
      path: '/',
    });

    res.json({ ok: true, username, isAdmin });
  } catch (err) {
    // DSM unreachable — local dev mode
    if (process.env.NODE_ENV === 'production') {
      res.status(502).json({ error: 'Cannot reach NAS authentication service' });
      return;
    }

    // Dev mode: accept any login
    console.log(`  Dev mode auth: accepting login for "${username}"`);
    initializeUser(username);
    const token = generateToken();
    sessions.set(token, {
      username,
      isAdmin: true,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    res.cookie('comic-session', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_TTL_MS,
      path: '/',
    });

    res.json({ ok: true, username, isAdmin: true });
  }
});

router.post('/auth/logout', (req, res) => {
  const token = req.cookies?.['comic-session'];
  if (token) sessions.delete(token);
  res.clearCookie('comic-session', { path: '/' });
  res.json({ ok: true });
});

import { APP_VERSION } from '../version.js';

router.get('/auth/version', (_req, res) => {
  res.json({ version: APP_VERSION });
});

router.get('/auth/check', (req, res) => {
  const token = req.cookies?.['comic-session'];
  if (!token) {
    res.json({ authenticated: false });
    return;
  }
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token!);
    res.json({ authenticated: false });
    return;
  }
  res.json({ authenticated: true, username: session.username, isAdmin: session.isAdmin });
});

// ============================================================
// Login background art
//
// Three layers:
//   /auth/login-bg              — single random image (legacy; root files only)
//   /auth/login-bg/spread       — JSON with 3 establishing-shot panels from a
//                                 random aesthetic subdir + 1 manga-panel accent
//                                 (used by the comic-panel login layout)
//   /auth/login-bg/img/:dir/:f  — serves a specific file by aesthetic + filename
//                                 (path-traversal guarded — validates dir is a
//                                 real subdir and filename matches image regex)
// ============================================================

const IMAGE_EXT_RE = /\.(png|jpg|jpeg|webp)$/i;
const SAFE_FILENAME_RE = /^[a-zA-Z0-9_.-]+\.(png|jpg|jpeg|webp)$/i;
const SAFE_DIRNAME_RE = /^[a-zA-Z0-9_-]+$/;

function loginBgRoot(): string | null {
  const publicDir = path.resolve(__dirname, '../../../public/login-bg');
  const clientDir = path.resolve(__dirname, '../../client/login-bg');
  if (fs.existsSync(publicDir)) return publicDir;
  if (fs.existsSync(clientDir)) return clientDir;
  return null;
}

// Single random — kept for backwards-compat (Option B / cinematic uses it).
router.get('/auth/login-bg', (_req, res) => {
  const bgDir = loginBgRoot();
  if (!bgDir) { res.status(404).end(); return; }
  const files = fs.readdirSync(bgDir).filter((f) => IMAGE_EXT_RE.test(f));
  if (files.length === 0) { res.status(404).end(); return; }
  const pick = files[Math.floor(Math.random() * files.length)];
  res.sendFile(path.join(bgDir, pick));
});

// Comic-panel spread: random aesthetic + 3 panels + 1 accent
router.get('/auth/login-bg/spread', (_req, res) => {
  const bgDir = loginBgRoot();
  if (!bgDir) { res.status(404).end(); return; }

  // List subdirectories — each is one aesthetic (shinkai / brutalist-scifi / …)
  // The "manga-panel" subdir is used for accent panels regardless of aesthetic.
  const allSubdirs = fs.readdirSync(bgDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && SAFE_DIRNAME_RE.test(d.name))
    .map((d) => d.name);

  const aestheticDirs = allSubdirs.filter((d) => d !== 'manga-panel');
  if (aestheticDirs.length === 0) {
    // No subdirs configured — fall back to root files as a single "pool"
    const files = fs.readdirSync(bgDir).filter((f) => IMAGE_EXT_RE.test(f));
    if (files.length < 3) { res.status(404).end(); return; }
    const shuffled = [...files].sort(() => Math.random() - 0.5).slice(0, 3);
    res.json({
      aesthetic: 'mixed',
      panels: shuffled.map((f) => `/api/auth/login-bg/img/_root/${encodeURIComponent(f)}`),
      accents: [],
    });
    return;
  }

  // Pick an aesthetic, then 3 panels from it
  const aesthetic = aestheticDirs[Math.floor(Math.random() * aestheticDirs.length)];
  const aestheticPath = path.join(bgDir, aesthetic);
  const panels = fs.readdirSync(aestheticPath).filter((f) => IMAGE_EXT_RE.test(f));
  if (panels.length === 0) { res.status(404).end(); return; }

  const pickN = (arr: string[], n: number): string[] =>
    [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(n, arr.length));

  const heroPicks = pickN(panels, 3);

  // Accent panel from manga-panel/ (universal across aesthetics)
  let accents: string[] = [];
  if (allSubdirs.includes('manga-panel')) {
    const accentFiles = fs.readdirSync(path.join(bgDir, 'manga-panel'))
      .filter((f) => IMAGE_EXT_RE.test(f));
    if (accentFiles.length > 0) {
      accents = pickN(accentFiles, 1).map((f) => `/api/auth/login-bg/img/manga-panel/${encodeURIComponent(f)}`);
    }
  }

  res.json({
    aesthetic,
    panels: heroPicks.map((f) => `/api/auth/login-bg/img/${encodeURIComponent(aesthetic)}/${encodeURIComponent(f)}`),
    accents,
  });
});

// Per-file serving with path-traversal guards.
// `_root` is a sentinel for the root directory (used in fallback above).
router.get('/auth/login-bg/img/:dir/:filename', (req, res) => {
  const bgDir = loginBgRoot();
  if (!bgDir) { res.status(404).end(); return; }

  const { dir, filename } = req.params;

  // Validate inputs strictly — never trust path components.
  if (!SAFE_FILENAME_RE.test(filename)) {
    res.status(400).end();
    return;
  }
  if (dir !== '_root' && !SAFE_DIRNAME_RE.test(dir)) {
    res.status(400).end();
    return;
  }

  const filePath = dir === '_root'
    ? path.join(bgDir, filename)
    : path.join(bgDir, dir, filename);

  // Belt-and-suspenders: resolved path MUST be inside the login-bg root.
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(bgDir + path.sep) && resolved !== bgDir) {
    res.status(400).end();
    return;
  }
  if (!fs.existsSync(resolved)) {
    res.status(404).end();
    return;
  }

  res.sendFile(resolved, {
    // Aggressive cache — these files don't change after generation.
    maxAge: '1d',
  });
});

// Export session lookup for middleware use
export function getSessionUser(token: string | undefined): { username: string; isAdmin: boolean } | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) sessions.delete(token);
    return null;
  }
  return { username: session.username, isAdmin: session.isAdmin };
}

export default router;
