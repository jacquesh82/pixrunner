import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireMerchant, signMerchantToken, type AuthedRequest } from '../auth/jwt.js';

export const merchantRouter = Router();

const creds = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).optional(),
});

merchantRouter.post('/register', async (req: Request, res: Response) => {
  const parsed = creds.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'données invalides' });
    return;
  }
  const { email, password, name } = parsed.data;
  if (await prisma.merchant.findUnique({ where: { email } })) {
    res.status(409).json({ error: 'commerçant déjà existant' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const m = await prisma.merchant.create({
    data: { email, passwordHash, name: name ?? email.split('@')[0] },
  });
  res.json({ token: signMerchantToken({ sub: m.id, name: m.name, email: m.email }), merchant: pub(m) });
});

merchantRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = creds.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'identifiants invalides' });
    return;
  }
  const m = await prisma.merchant.findUnique({ where: { email: parsed.data.email } });
  if (!m || !(await bcrypt.compare(parsed.data.password, m.passwordHash))) {
    res.status(401).json({ error: 'identifiants incorrects' });
    return;
  }
  res.json({ token: signMerchantToken({ sub: m.id, name: m.name, email: m.email }), merchant: pub(m) });
});

merchantRouter.get('/me', requireMerchant, async (req: AuthedRequest, res: Response) => {
  const m = await prisma.merchant.findUnique({ where: { id: req.merchant!.sub } });
  if (!m) {
    res.status(404).json({ error: 'commerçant introuvable' });
    return;
  }
  res.json({ merchant: pub(m) });
});

function pub(m: { id: string; name: string; email: string }) {
  return { id: m.id, name: m.name, email: m.email };
}
