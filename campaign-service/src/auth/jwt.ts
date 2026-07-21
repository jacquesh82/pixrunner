import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../env.js';

export type TokenKind = 'account' | 'merchant';

export interface JwtPayload {
  sub: string;
  name: string;
  email?: string;
  kind: TokenKind;
}

export function signAccountToken(payload: Omit<JwtPayload, 'kind'>): string {
  return jwt.sign({ ...payload, kind: 'account' }, env.jwtSecret, { expiresIn: '30d' });
}

export function signMerchantToken(payload: Omit<JwtPayload, 'kind'>): string {
  return jwt.sign({ ...payload, kind: 'merchant' }, env.jwtSecret, { expiresIn: '30d' });
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
  merchant?: JwtPayload;
}

function bearer(req: Request): JwtPayload | null {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return token ? verifyToken(token) : null;
}

/** Exige un JWT de compte coureur. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const payload = bearer(req);
  if (!payload || payload.kind !== 'account') {
    res.status(401).json({ error: 'non authentifié' });
    return;
  }
  req.account = payload;
  next();
}

/** Exige un JWT de commerçant. */
export function requireMerchant(req: AuthedRequest, res: Response, next: NextFunction): void {
  const payload = bearer(req);
  if (!payload || payload.kind !== 'merchant') {
    res.status(401).json({ error: 'authentification commerçant requise' });
    return;
  }
  req.merchant = payload;
  next();
}

/** Exige la clé de service (appels server-to-server, ex. game-server → campaign). */
export function requireServiceKey(req: Request, res: Response, next: NextFunction): void {
  if (req.header('x-service-key') !== env.serviceKey) {
    res.status(401).json({ error: 'clé de service invalide' });
    return;
  }
  next();
}
