import 'dotenv/config';

interface OidcProviderConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
}

function oidc(prefix: string): OidcProviderConfig {
  return {
    issuer: process.env[`${prefix}_ISSUER`] ?? '',
    clientId: process.env[`${prefix}_CLIENT_ID`] ?? '',
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`] ?? '',
  };
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me',
  /** Clé de service partagée pour les appels server-to-server (game-server → campaign). */
  serviceKey: process.env.SERVICE_KEY ?? 'dev-service-key',
  redirectBase: process.env.OIDC_REDIRECT_BASE ?? 'http://localhost:3001',
  google: oidc('GOOGLE'),
  mindlog: oidc('MINDLOG'),
};

/** Un provider OIDC est actif si son issuer et son client_id sont renseignés. */
export function providerEnabled(p: OidcProviderConfig): boolean {
  return Boolean(p.issuer && p.clientId);
}
