import type { Offer, SponsoredZonesResponse } from '@pixirunner/protocol';

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
}
