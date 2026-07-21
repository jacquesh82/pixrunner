import { Router, type Request, type Response } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireMerchant, requireServiceKey, type AuthedRequest } from '../auth/jwt.js';

export const redemptionRouter = Router();

const issueInput = z.object({
  offerId: z.string().min(1), // = campaignId
  sponsorId: z.string().min(1),
  accountId: z.string().min(1), // compte ou id d'invité (runnerRef)
  hexId: z.string().min(1),
});

/**
 * Émission d'une redemption — appelé UNIQUEMENT par le game-server (autorité),
 * protégé par la clé de service. Le client ne peut pas s'auto-octroyer un bon.
 */
redemptionRouter.post('/', requireServiceKey, async (req: Request, res: Response) => {
  const parsed = issueInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'requête invalide' });
    return;
  }
  const { offerId, accountId, hexId } = parsed.data;
  const campaign = await prisma.campaign.findUnique({ where: { id: offerId } });
  if (!campaign || !campaign.active) {
    res.status(404).json({ error: 'campagne inconnue ou inactive' });
    return;
  }
  const code = randomBytes(4).toString('hex').toUpperCase();
  const isAccount = !accountId.startsWith('guest:');
  const redemption = await prisma.redemption.create({
    data: {
      code,
      campaignId: campaign.id,
      accountId: isAccount ? accountId : null,
      runnerRef: accountId,
      hexId,
    },
  });
  res.json({
    redemption: { code: redemption.code, status: redemption.status, offerId: campaign.id },
    offer: { title: campaign.title, value: campaign.offerValue, type: campaign.offerType },
  });
});

/** Portefeuille du coureur : ses redemptions. */
redemptionRouter.get('/mine', requireAuth, async (req: AuthedRequest, res: Response) => {
  const redemptions = await prisma.redemption.findMany({
    where: { accountId: req.account!.sub },
    orderBy: { issuedAt: 'desc' },
    include: { campaign: { select: { title: true, offerValue: true, offerType: true } } },
  });
  res.json({ redemptions });
});

/** Vérification/consommation d'un bon en boutique (par le commerçant). */
redemptionRouter.post('/:code/verify', requireMerchant, async (req: AuthedRequest, res: Response) => {
  const redemption = await prisma.redemption.findUnique({
    where: { code: req.params.code },
    include: { campaign: true },
  });
  if (!redemption || redemption.campaign.merchantId !== req.merchant!.sub) {
    res.status(404).json({ error: 'bon introuvable' });
    return;
  }
  if (redemption.status === 'redeemed') {
    res.status(409).json({ error: 'bon déjà utilisé' });
    return;
  }
  const updated = await prisma.redemption.update({
    where: { code: req.params.code },
    data: { status: 'redeemed', redeemedAt: new Date() },
  });
  res.json({ redemption: { code: updated.code, status: updated.status } });
});
