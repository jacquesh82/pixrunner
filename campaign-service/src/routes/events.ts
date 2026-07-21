import { Router, type Request, type Response } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireMerchant, type AuthedRequest } from '../auth/jwt.js';

export const eventRouter = Router();

const eventInput = z.object({
  name: z.string().min(1),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#4a86ff'),
});

/** Crée un événement/ligue brandé (le game-server hébergera la room dédiée). */
eventRouter.post('/', requireMerchant, async (req: AuthedRequest, res: Response) => {
  const parsed = eventInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'événement invalide' });
    return;
  }
  const code = randomBytes(3).toString('hex').toUpperCase();
  const event = await prisma.event.create({
    data: { ...parsed.data, code, merchantId: req.merchant!.sub },
  });
  res.json({ event });
});

/** Liste les événements actifs (navigation côté client). */
eventRouter.get('/', async (_req: Request, res: Response) => {
  const events = await prisma.event.findMany({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, code: true, brandColor: true },
  });
  res.json({ events });
});

/** Récupère un événement par code (rejoindre une ligue privée). */
eventRouter.get('/:code', async (req: Request, res: Response) => {
  const event = await prisma.event.findUnique({
    where: { code: req.params.code },
    select: { id: true, name: true, code: true, brandColor: true, active: true },
  });
  if (!event || !event.active) {
    res.status(404).json({ error: 'événement introuvable' });
    return;
  }
  res.json({ event });
});
