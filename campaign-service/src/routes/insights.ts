import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireMerchant, requireServiceKey } from '../auth/jwt.js';

export const insightsRouter = Router();

const visitInput = z.object({
  hexId: z.string().min(1),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number().int().min(1).default(1),
});

/**
 * Enregistre une visite agrégée/anonymisée (server-to-server, opt-in RGPD).
 * Aucune donnée nominative : seulement cellule + jour + compteur.
 */
insightsRouter.post('/visits', requireServiceKey, async (req: Request, res: Response) => {
  const parsed = visitInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'visite invalide' });
    return;
  }
  const { hexId, day, count } = parsed.data;
  await prisma.visitEvent.upsert({
    where: { hexId_day: { hexId, day } },
    update: { count: { increment: count } },
    create: { hexId, day, count },
  });
  res.json({ ok: true });
});

/** Heatmap de fréquentation agrégée (commerçant). */
insightsRouter.get('/heatmap', requireMerchant, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 500), 2000);
  const rows = await prisma.visitEvent.groupBy({
    by: ['hexId'],
    _sum: { count: true },
    orderBy: { _sum: { count: 'desc' } },
    take: limit,
  });
  res.json({
    cells: rows.map((r) => ({ hexId: r.hexId, visits: r._sum.count ?? 0 })),
  });
});
