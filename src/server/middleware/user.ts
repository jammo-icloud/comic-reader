import type { Request, Response, NextFunction } from 'express';
import { getSessionUser } from '../routes/auth.js';

const DEFAULT_USER = process.env.DEFAULT_USER || 'local';

// Augment Express Request with username and isAdmin
declare global {
  namespace Express {
    interface Request {
      username: string;
      isAdmin: boolean;
    }
  }
}

/**
 * Extract authenticated user from session cookie.
 * Falls back to DEFAULT_USER for unauthenticated requests
 * (auth enforcement happens separately in authGuard).
 */
export function userMiddleware(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.['comic-session'];
  const session = getSessionUser(token);

  if (session) {
    req.username = session.username;
    req.isAdmin = session.isAdmin;
  } else {
    req.username = DEFAULT_USER;
    req.isAdmin = false;
  }
  next();
}

/**
 * Auth guard — blocks unauthenticated requests.
 * Applied to /api routes (except /api/auth/*).
 */
export function authGuard(req: Request, res: Response, next: NextFunction) {
  // Allow auth routes and user info through
  if (req.path.startsWith('/auth/') || req.path === '/me') {
    next();
    return;
  }

  // Allow static assets (covers, thumbnails) — these are loaded by <img> tags
  if (req.path.startsWith('/series-cover/') || req.path.startsWith('/thumbnails/')) {
    next();
    return;
  }

  // Allow extension uploads and .crz imports
  if (req.path.startsWith('/import/chapter-images') || req.path.startsWith('/import/crz')) {
    next();
    return;
  }

  const token = req.cookies?.['comic-session'];
  const session = getSessionUser(token);

  if (!session) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  next();
}
