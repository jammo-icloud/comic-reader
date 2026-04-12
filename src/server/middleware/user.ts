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
  // Allow auth routes through
  if (req.path.startsWith('/auth/')) {
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
