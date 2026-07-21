import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, signAccountToken, type AuthedRequest } from '../auth/jwt.js';
import {
  buildAuthUrl,
  handleCallback,
  isEnabled,
  type OidcProviderName,
} from '../auth/oidc.js';

export const authRouter = Router();

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).optional(),
});

/** Inscription par email/mot de passe. */
authRouter.post('/register', async (req: Request, res: Response) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'email/mot de passe invalides' });
    return;
  }
  const { email, password, name } = parsed.data;
  const existing = await prisma.account.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'compte déjà existant' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const account = await prisma.account.create({
    data: { email, passwordHash, provider: 'email', name: name ?? email.split('@')[0] },
  });
  res.json({ token: token(account), account: publicAccount(account) });
});

/** Connexion par email/mot de passe. */
authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = credentials.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'identifiants invalides' });
    return;
  }
  const account = await prisma.account.findUnique({ where: { email: parsed.data.email } });
  if (!account?.passwordHash || !(await bcrypt.compare(parsed.data.password, account.passwordHash))) {
    res.status(401).json({ error: 'identifiants incorrects' });
    return;
  }
  res.json({ token: token(account), account: publicAccount(account) });
});

/** Profil du compte authentifié. */
authRouter.get('/me', requireAuth, async (req: AuthedRequest, res: Response) => {
  const account = await prisma.account.findUnique({ where: { id: req.account!.sub } });
  if (!account) {
    res.status(404).json({ error: 'compte introuvable' });
    return;
  }
  res.json({ account: publicAccount(account) });
});

// ── OIDC (Google, Mindlog.id) ───────────────────────────────────────────────

authRouter.get('/:provider/start', async (req: Request, res: Response) => {
  const provider = req.params.provider as OidcProviderName;
  if (provider !== 'google' && provider !== 'mindlog') {
    res.status(404).json({ error: 'provider inconnu' });
    return;
  }
  if (!isEnabled(provider)) {
    res.status(501).json({ error: `provider ${provider} non configuré` });
    return;
  }
  const url = await buildAuthUrl(provider);
  res.redirect(url);
});

authRouter.get('/:provider/callback', async (req: Request, res: Response) => {
  const provider = req.params.provider as OidcProviderName;
  if (provider !== 'google' && provider !== 'mindlog') {
    res.status(404).json({ error: 'provider inconnu' });
    return;
  }
  try {
    const profile = await handleCallback(provider, req.query as Record<string, string>);
    const account = await prisma.account.upsert({
      where: { provider_providerSub: { provider, providerSub: profile.sub } },
      update: { name: profile.name, email: profile.email ?? undefined },
      create: {
        provider,
        providerSub: profile.sub,
        name: profile.name,
        email: profile.email ?? undefined,
      },
    });
    // En prod : redirection vers l'app avec le token. Ici on le renvoie en JSON.
    res.json({ token: token(account), account: publicAccount(account) });
  } catch (err) {
    res.status(400).json({ error: 'échec OIDC', detail: String(err) });
  }
});

interface AccountRow {
  id: string;
  name: string;
  email: string | null;
  provider: string;
}

function token(a: AccountRow): string {
  return signAccountToken({ sub: a.id, name: a.name, email: a.email ?? undefined });
}

function publicAccount(a: AccountRow) {
  return { id: a.id, name: a.name, email: a.email, provider: a.provider };
}
