import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type {
  Offer,
  SponsoredZone,
  SponsoredZonesResponse,
} from '@pixirunner/protocol';
import { prisma } from '../db.js';
import { requireMerchant, type AuthedRequest } from '../auth/jwt.js';

export const campaignRouter = Router();

const campaignInput = z.object({
  title: z.string().min(1),
  offerType: z.enum(['ad', 'discount', 'reward']),
  offerValue: z.string().min(1),
  offerDesc: z.string().default(''),
  h3Cells: z.array(z.string()).min(1),
  bonusEnergy: z.number().int().min(0).default(0),
  bonusScore: z.number().int().min(0).default(0),
  budgetCents: z.number().int().min(0).default(0),
});

/** Crée une campagne (offre + ciblage de cellules H3). */
campaignRouter.post('/', requireMerchant, async (req: AuthedRequest, res: Response) => {
  const parsed = campaignInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'campagne invalide', detail: parsed.error.flatten() });
    return;
  }
  const c = await prisma.campaign.create({
    data: { ...parsed.data, merchantId: req.merchant!.sub },
  });
  res.json({ campaign: c });
});

/** Liste les campagnes du commerçant. */
campaignRouter.get('/', requireMerchant, async (req: AuthedRequest, res: Response) => {
  const campaigns = await prisma.campaign.findMany({
    where: { merchantId: req.merchant!.sub },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ campaigns });
});

/** Active/désactive une campagne. */
campaignRouter.patch('/:id', requireMerchant, async (req: AuthedRequest, res: Response) => {
  const active = z.object({ active: z.boolean() }).safeParse(req.body);
  if (!active.success) {
    res.status(400).json({ error: 'active booléen requis' });
    return;
  }
  const existing = await prisma.campaign.findFirst({
    where: { id: req.params.id, merchantId: req.merchant!.sub },
  });
  if (!existing) {
    res.status(404).json({ error: 'campagne introuvable' });
    return;
  }
  const c = await prisma.campaign.update({
    where: { id: req.params.id },
    data: { active: active.data.active },
  });
  res.json({ campaign: c });
});

campaignRouter.delete('/:id', requireMerchant, async (req: AuthedRequest, res: Response) => {
  await prisma.campaign.deleteMany({ where: { id: req.params.id, merchantId: req.merchant!.sub } });
  res.json({ ok: true });
});

/**
 * Zones sponsorisées actives — consommé par le game-server (bonus + émission de
 * redemption) et le client (mise en avant). Public en lecture.
 */
campaignRouter.get('/sponsored-zones', async (_req: Request, res: Response) => {
  const campaigns = await prisma.campaign.findMany({ where: { active: true } });
  const zones: SponsoredZone[] = campaigns.map((c) => ({
    sponsorId: c.merchantId,
    h3Cells: c.h3Cells,
    bonus: { energy: c.bonusEnergy, score: c.bonusScore },
    offerId: c.id,
  }));
  const offers: Offer[] = campaigns.map((c) => ({
    id: c.id,
    sponsorId: c.merchantId,
    title: c.title,
    description: c.offerDesc,
    type: c.offerType as Offer['type'],
    value: c.offerValue,
  }));
  const payload: SponsoredZonesResponse = { zones, offers };
  res.json(payload);
});
