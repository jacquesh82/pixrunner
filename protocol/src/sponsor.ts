/**
 * Types de la couche commerciale partagés entre le client, le game-server
 * et le campaign-service : zones sponsorisées, offres, redemptions.
 */

export type OfferType = 'ad' | 'discount' | 'reward';

export interface Offer {
  id: string;
  sponsorId: string;
  title: string;
  description: string;
  type: OfferType;
  /** ex. "-20%", "1 café offert". */
  value: string;
}

/** Bonus de gameplay accordé en conquérant une zone sponsorisée. */
export interface SponsorBonus {
  /** Énergie offerte à la conquête. */
  energy?: number;
  /** Points bonus. */
  score?: number;
}

/** Une zone (ensemble de cellules H3) achetée par un commerçant. */
export interface SponsoredZone {
  sponsorId: string;
  /** Cellules H3 couvertes par la campagne. */
  h3Cells: string[];
  bonus: SponsorBonus;
  /** id de l'offre débloquée en conquérant la zone. */
  offerId: string;
}

export type RedemptionStatus = 'issued' | 'redeemed' | 'expired';

/** Bon émis à un coureur qualifié, attesté par le game-server. */
export interface Redemption {
  code: string;
  offerId: string;
  sponsorId: string;
  /** Compte du coureur, ou id d'invité. */
  accountId: string;
  /** Cellule H3 qui a déclenché l'émission. */
  hexId: string;
  status: RedemptionStatus;
  issuedAt: number;
}

/** Réponse de GET /sponsored-zones. */
export interface SponsoredZonesResponse {
  zones: SponsoredZone[];
  offers: Offer[];
}

/** Corps de POST /redemptions (server-to-server, autorité game-server). */
export interface IssueRedemptionRequest {
  offerId: string;
  sponsorId: string;
  accountId: string;
  hexId: string;
}
