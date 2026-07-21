import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me';

export interface AccountToken {
  sub: string;
  name: string;
  kind: string;
}

/** Valide un JWT de compte émis par le campaign-service (secret partagé). */
export function verifyAccountToken(token: string): AccountToken | null {
  try {
    const payload = jwt.verify(token, SECRET) as AccountToken;
    return payload.kind === 'account' ? payload : null;
  } catch {
    return null;
  }
}
