import { Router, type Request, type Response } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/jwt.js';

export interface CosmeticItem {
  sku: string;
  kind: 'avatar' | 'trail';
  name: string;
  /** Couleur (hex) appliquée côté client. */
  color: number;
  priceCents: number;
}

/** Catalogue cosmétique (strictement cosmétique — jamais pay-to-win). */
export const CATALOG: CosmeticItem[] = [
  { sku: 'avatar.aurora', kind: 'avatar', name: 'Avatar Aurore', color: 0x7be0d8, priceCents: 299 },
  { sku: 'avatar.ember', kind: 'avatar', name: 'Avatar Braise', color: 0xff9db0, priceCents: 299 },
  { sku: 'avatar.gold', kind: 'avatar', name: 'Avatar Or', color: 0xf0b429, priceCents: 399 },
  { sku: 'trail.neon', kind: 'trail', name: 'Traînée Néon', color: 0xc79bff, priceCents: 199 },
];

export const cosmeticRouter = Router();

/** Catalogue public. */
cosmeticRouter.get('/', (_req: Request, res: Response) => {
  res.json({ catalog: CATALOG });
});

/** Possessions du compte. */
cosmeticRouter.get('/mine', requireAuth, async (req: AuthedRequest, res: Response) => {
  const owned = await prisma.entitlement.findMany({ where: { accountId: req.account!.sub } });
  res.json({ skus: owned.map((e) => e.sku) });
});

/**
 * Acquisition d'un cosmétique. Le paiement Stripe est branché en tâche D1 ;
 * ici on accorde l'entitlement (l'achat requiert un compte → gate côté client).
 */
cosmeticRouter.post('/:sku/claim', requireAuth, async (req: AuthedRequest, res: Response) => {
  const item = CATALOG.find((c) => c.sku === req.params.sku);
  if (!item) {
    res.status(404).json({ error: 'cosmétique inconnu' });
    return;
  }
  await prisma.entitlement.upsert({
    where: { accountId_sku: { accountId: req.account!.sub, sku: item.sku } },
    update: {},
    create: { accountId: req.account!.sub, sku: item.sku },
  });
  res.json({ ok: true, sku: item.sku });
});
