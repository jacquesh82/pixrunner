import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env, stripeEnabled } from '../env.js';
import { stripe } from '../billing/stripe.js';
import { requireAuth, requireMerchant, type AuthedRequest } from '../auth/jwt.js';
import { CATALOG } from './cosmetics.js';

export const billingRouter = Router();

/** Checkout Stripe pour l'achat d'un cosmétique. */
billingRouter.post('/cosmetics/:sku/checkout', requireAuth, async (req: AuthedRequest, res: Response) => {
  const s = stripe();
  if (!s) {
    res.status(501).json({ error: 'billing non configuré' });
    return;
  }
  const item = CATALOG.find((c) => c.sku === req.params.sku);
  if (!item) {
    res.status(404).json({ error: 'cosmétique inconnu' });
    return;
  }
  const session = await s.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: item.priceCents,
          product_data: { name: item.name },
        },
      },
    ],
    metadata: { kind: 'cosmetic', accountId: req.account!.sub, sku: item.sku },
    success_url: `${env.appBase}/?purchase=success`,
    cancel_url: `${env.appBase}/?purchase=cancel`,
  });
  res.json({ url: session.url });
});

/** Checkout Stripe pour l'hébergement d'un événement/ligue brandé. */
billingRouter.post('/events/checkout', requireMerchant, async (req: AuthedRequest, res: Response) => {
  const s = stripe();
  if (!s) {
    res.status(501).json({ error: 'billing non configuré' });
    return;
  }
  const name = z.string().min(1).catch('Événement').parse(req.body?.name);
  const session = await s.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: env.stripe.eventPriceCents,
          product_data: { name: `Hébergement événement — ${name}` },
        },
      },
    ],
    metadata: { kind: 'event', merchantId: req.merchant!.sub, name },
    success_url: `${env.appBase}/?event=success`,
    cancel_url: `${env.appBase}/?event=cancel`,
  });
  res.json({ url: session.url });
});

/** Statut du billing (le client bascule vers l'achat gratuit en dev si désactivé). */
billingRouter.get('/status', (_req: Request, res: Response) => {
  res.json({ enabled: stripeEnabled() });
});

/**
 * Webhook Stripe (corps brut). À la fin d'un checkout cosmétique, accorde
 * l'entitlement ; pour un événement, l'active.
 */
export async function stripeWebhook(req: Request, res: Response): Promise<void> {
  const s = stripe();
  if (!s) {
    res.status(501).end();
    return;
  }
  let event;
  try {
    event = s.webhooks.constructEvent(
      req.body as Buffer,
      req.header('stripe-signature') ?? '',
      env.stripe.webhookSecret,
    );
  } catch (err) {
    res.status(400).send(`signature invalide: ${String(err)}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as { metadata?: Record<string, string> };
    const meta = session.metadata ?? {};
    if (meta.kind === 'cosmetic' && meta.accountId && meta.sku) {
      await prisma.entitlement.upsert({
        where: { accountId_sku: { accountId: meta.accountId, sku: meta.sku } },
        update: {},
        create: { accountId: meta.accountId, sku: meta.sku },
      });
    }
    // meta.kind === 'event' : l'événement est déjà créé côté portail ; on
    // pourrait ici le marquer 'payé/actif'.
  }

  res.json({ received: true });
}
