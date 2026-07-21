import { env, providerEnabled } from '../env.js';

export type OidcProviderName = 'google' | 'mindlog';

interface PendingAuth {
  verifier: string;
  provider: OidcProviderName;
}

/** État PKCE en attente, indexé par `state` (dev : en mémoire). */
const pending = new Map<string, PendingAuth>();

export interface OidcProfile {
  sub: string;
  name: string;
  email?: string;
}

function config(provider: OidcProviderName) {
  return provider === 'google' ? env.google : env.mindlog;
}

export function isEnabled(provider: OidcProviderName): boolean {
  return providerEnabled(config(provider));
}

/** openid-client est CJS : import dynamique avec interop défensive. */
async function loadOidc(): Promise<{ Issuer: any; generators: any }> {
  const mod: any = await import('openid-client');
  return {
    Issuer: mod.Issuer ?? mod.default?.Issuer,
    generators: mod.generators ?? mod.default?.generators,
  };
}

async function clientFor(provider: OidcProviderName): Promise<any> {
  const cfg = config(provider);
  const { Issuer } = await loadOidc();
  const issuer = await Issuer.discover(cfg.issuer);
  return new issuer.Client({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uris: [`${env.redirectBase}/auth/${provider}/callback`],
    response_types: ['code'],
  });
}

/** Construit l'URL d'autorisation (PKCE) et mémorise le verifier. */
export async function buildAuthUrl(provider: OidcProviderName): Promise<string> {
  const { generators } = await loadOidc();
  const client = await clientFor(provider);
  const verifier = generators.codeVerifier();
  const challenge = generators.codeChallenge(verifier);
  const state = generators.state();
  pending.set(state, { verifier, provider });
  return client.authorizationUrl({
    scope: 'openid email profile',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  });
}

/** Échange le code contre un profil OIDC. */
export async function handleCallback(
  provider: OidcProviderName,
  params: Record<string, string>,
): Promise<OidcProfile> {
  const state = params.state ?? '';
  const entry = pending.get(state);
  if (!entry || entry.provider !== provider) throw new Error('état OIDC inconnu');
  pending.delete(state);

  const client = await clientFor(provider);
  const tokenSet = await client.callback(
    `${env.redirectBase}/auth/${provider}/callback`,
    params,
    { code_verifier: entry.verifier, state },
  );
  const claims = tokenSet.claims();
  return {
    sub: String(claims.sub),
    name: String(claims.name ?? claims.email ?? 'Coureur'),
    email: claims.email ? String(claims.email) : undefined,
  };
}
