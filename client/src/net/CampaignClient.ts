import type { Offer, SponsoredZonesResponse } from '@pixirunner/protocol';

export interface CosmeticItem {
  sku: string;
  kind: 'avatar' | 'trail';
  name: string;
  color: number;
  priceCents: number;
}

/**
 * Client REST du campaign-service (couche commerciale). Le client coureur ne
 * connaît ce backend que par son URL (VITE_CAMPAIGN_URL).
 */
export class CampaignClient {
  constructor(private baseUrl: string) {}

  /** Récupère les zones sponsorisées + offres (cellules à mettre en avant). */
  async fetchSponsoredZones(): Promise<{ cells: Set<string>; offers: Map<string, Offer> }> {
    const empty = { cells: new Set<string>(), offers: new Map<string, Offer>() };
    try {
      const res = await fetch(`${this.baseUrl}/campaigns/sponsored-zones`);
      if (!res.ok) return empty;
      const data = (await res.json()) as SponsoredZonesResponse;
      const cells = new Set<string>();
      for (const z of data.zones) for (const c of z.h3Cells) cells.add(c);
      const offers = new Map<string, Offer>();
      for (const o of data.offers) offers.set(o.id, o);
      return { cells, offers };
    } catch {
      return empty;
    }
  }

  /** Catalogue cosmétique public. */
  async fetchCatalog(): Promise<CosmeticItem[]> {
    try {
      const res = await fetch(`${this.baseUrl}/cosmetics`);
      if (!res.ok) return [];
      return (await res.json()).catalog as CosmeticItem[];
    } catch {
      return [];
    }
  }

  /** Cosmétiques possédés (nécessite un compte). */
  async fetchOwned(token: string): Promise<Set<string>> {
    try {
      const res = await fetch(`${this.baseUrl}/cosmetics/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return new Set();
      return new Set((await res.json()).skus as string[]);
    } catch {
      return new Set();
    }
  }

  /** Acquiert un cosmétique (le paiement Stripe arrive en D1). */
  async claim(token: string, sku: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/cosmetics/${sku}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
