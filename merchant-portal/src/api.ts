/** Client REST du campaign-service, côté portail commerçant. */

const BASE = import.meta.env.VITE_CAMPAIGN_URL ?? 'http://localhost:3001';
const TOKEN_KEY = 'pixrunner.merchantToken';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string): void {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function req(path: string, method: string, body?: unknown, auth = true): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.json();
}

export interface Campaign {
  id: string;
  title: string;
  offerType: string;
  offerValue: string;
  offerDesc: string;
  h3Cells: string[];
  bonusEnergy: number;
  bonusScore: number;
  active: boolean;
}

export const api = {
  register: (email: string, password: string, name: string) =>
    req('/merchant/register', 'POST', { email, password, name }, false),
  login: (email: string, password: string) =>
    req('/merchant/login', 'POST', { email, password }, false),
  createCampaign: (data: Record<string, unknown>) => req('/campaigns', 'POST', data),
  listCampaigns: (): Promise<{ campaigns: Campaign[] }> => req('/campaigns', 'GET'),
  setActive: (id: string, active: boolean) => req(`/campaigns/${id}`, 'PATCH', { active }),
  heatmap: (): Promise<{ cells: Array<{ hexId: string; visits: number }> }> =>
    req('/insights/heatmap', 'GET'),
  createEvent: (name: string, brandColor: string) =>
    req('/events', 'POST', { name, brandColor }),
  listEvents: (): Promise<{ events: Array<{ id: string; name: string; code: string }> }> =>
    req('/events', 'GET', undefined, false),
};
