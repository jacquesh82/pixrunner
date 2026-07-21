import Stripe from 'stripe';
import { env, stripeEnabled } from '../env.js';

let client: Stripe | null = null;

/** Client Stripe (null si non configuré). */
export function stripe(): Stripe | null {
  if (!stripeEnabled()) return null;
  if (!client) client = new Stripe(env.stripe.secretKey);
  return client;
}
