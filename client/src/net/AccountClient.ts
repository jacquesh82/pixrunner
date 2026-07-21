/** Compte plateforme (coureur) via le campaign-service. Upgrade depuis l'invité. */

const TOKEN_KEY = 'pixrunner.accountToken';

export interface AccountInfo {
  id: string;
  name: string;
  email: string | null;
  provider: string;
}

export class AccountClient {
  constructor(private baseUrl: string) {}

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  /** URL de démarrage d'un flux OIDC (Google / Mindlog.id). */
  oidcStartUrl(provider: 'google' | 'mindlog'): string {
    return `${this.baseUrl}/auth/${provider}/start`;
  }

  async register(email: string, password: string, name: string): Promise<AccountInfo> {
    return this.auth('/auth/register', { email, password, name });
  }

  async login(email: string, password: string): Promise<AccountInfo> {
    return this.auth('/auth/login', { email, password });
  }

  private async auth(path: string, body: Record<string, string>): Promise<AccountInfo> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    localStorage.setItem(TOKEN_KEY, data.token);
    return data.account;
  }
}
