import type { SponsoredZonesResponse } from '@pixirunner/protocol';

const CAMPAIGN_URL = process.env.CAMPAIGN_URL ?? '';
const SERVICE_KEY = process.env.SERVICE_KEY ?? 'dev-service-key';
const REFRESH_MS = 30_000;

interface ZoneInfo {
  campaignId: string;
  sponsorId: string;
  energy: number;
  score: number;
}

export interface IssuedRedemption {
  code: string;
}

/**
 * Synchronise les zones sponsorisées depuis le campaign-service et émet les
 * redemptions (server-to-server, clé de service) — le game-server est la seule
 * autorité habilitée à attester une conquête.
 */
export class SponsorSync {
  private zones = new Map<string, ZoneInfo>();
  private timer?: ReturnType<typeof setInterval>;

  get enabled(): boolean {
    return CAMPAIGN_URL.length > 0;
  }

  start(): void {
    if (!this.enabled) {
      console.log('[sponsor] CAMPAIGN_URL absent → zones sponsorisées désactivées');
      return;
    }
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  getZone(cell: string): ZoneInfo | undefined {
    return this.zones.get(cell);
  }

  private async refresh(): Promise<void> {
    try {
      const res = await fetch(`${CAMPAIGN_URL}/campaigns/sponsored-zones`);
      if (!res.ok) return;
      const data = (await res.json()) as SponsoredZonesResponse;
      const next = new Map<string, ZoneInfo>();
      for (const z of data.zones) {
        for (const cell of z.h3Cells) {
          next.set(cell, {
            campaignId: z.offerId,
            sponsorId: z.sponsorId,
            energy: z.bonus.energy ?? 0,
            score: z.bonus.score ?? 0,
          });
        }
      }
      this.zones = next;
    } catch {
      // silencieux : le jeu fonctionne sans la couche commerciale
    }
  }

  async issueRedemption(
    runnerRef: string,
    campaignId: string,
    sponsorId: string,
    hexId: string,
  ): Promise<IssuedRedemption | null> {
    if (!this.enabled) return null;
    try {
      const res = await fetch(`${CAMPAIGN_URL}/redemptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-service-key': SERVICE_KEY },
        body: JSON.stringify({ offerId: campaignId, sponsorId, accountId: runnerRef, hexId }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { redemption: { code: string } };
      return { code: data.redemption.code };
    } catch {
      return null;
    }
  }
}

export const sponsorSync = new SponsorSync();
