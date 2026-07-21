import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../env.js';

export interface JwtPayload {
  /** accountId. */
  sub: string;
  name: string;
  email?: string;
  kind: 'account';
}

export function signAccountToken(payload: Omit<JwtPayload, 'kind'>): string {
  return jwt.sign({ ...payload, kind: 'account' }, env.jwtSecret, { expiresIn: '30d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

export interface AuthedRequest extends Request {
  account?: JwtPayload;
}

/** Middleware : exige un JWT de compte valide (Authorization: Bearer …). */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: 'non authentifié' });
    return;
  }
  req.account = payload;
  next();
}
