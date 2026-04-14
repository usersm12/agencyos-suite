import { supabase } from './supabase/client';

// ── GIS type declarations ──────────────────────────────────────────────────
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: GISTokenClientConfig) => GISTokenClient;
        };
      };
    };
  }
}
interface GISTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GISTokenResponse) => void;
  error_callback?: (error: { type: string; message?: string }) => void;
}
interface GISTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}
interface GISTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

// ── Types ──────────────────────────────────────────────────────────────────
export interface GSCSummary {
  clicks: number;
  impressions: number;
  ctr: number;        // percentage e.g. 2.17
  avgPosition: number;
}

export interface GSCTrendPoint {
  date: string;       // YYYY-MM-DD
  clicks: number;
  impressions: number;
}

export interface GSCQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;        // percentage
  position: number;
}

export interface GSCPage {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCData {
  current: {
    summary: GSCSummary;
    trend: GSCTrendPoint[];
    topQueries: GSCQuery[];
    topPages: GSCPage[];
  };
  previous: {
    summary: GSCSummary;
  };
  fetchedAt: string;
}

export interface GSCIntegration {
  access_token: string;
  expires_at: string;
  connected_at: string;
}

// ── GIS loader ─────────────────────────────────────────────────────────────
let gisLoading: Promise<void> | null = null;

function loadGIS(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoading) return gisLoading;

  gisLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
  return gisLoading;
}

// ── OAuth ─────────────────────────────────────────────────────────────────
export async function connectSearchConsole(clientId: string): Promise<string> {
  const clientIdEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientIdEnv) throw new Error('VITE_GOOGLE_CLIENT_ID is not set in .env');

  await loadGIS();

  return new Promise<string>((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientIdEnv,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      callback: async (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || response.error || 'OAuth failed'));
          return;
        }

        const expiresAt = new Date(
          Date.now() + (response.expires_in ?? 3600) * 1000
        ).toISOString();

        const { error } = await supabase.from('client_integrations').upsert(
          {
            client_id: clientId,
            provider: 'google_search_console',
            access_token: response.access_token,
            expires_at: expiresAt,
            connected_at: new Date().toISOString(),
          },
          { onConflict: 'client_id,provider' }
        );

        if (error) { reject(error); return; }
        resolve(response.access_token);
      },
      error_callback: (err) => reject(new Error(err.message ?? err.type)),
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

export async function disconnectSearchConsole(clientId: string): Promise<void> {
  await supabase
    .from('client_integrations')
    .delete()
    .eq('client_id', clientId)
    .eq('provider', 'google_search_console');
}

export async function getGSCIntegration(clientId: string): Promise<GSCIntegration | null> {
  const { data, error } = await supabase
    .from('client_integrations')
    .select('access_token, expires_at, connected_at')
    .eq('client_id', clientId)
    .eq('provider', 'google_search_console')
    .maybeSingle();

  if (error || !data?.access_token) return null;
  return data as GSCIntegration;
}

export function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) <= new Date(Date.now() + 60_000); // 1-min buffer
}

// ── API helpers ────────────────────────────────────────────────────────────
async function gscPost<T>(
  accessToken: string,
  siteUrl: string,
  body: object
): Promise<T> {
  const encoded = encodeURIComponent(siteUrl);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Search Console API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

interface SCRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

function parseSummary(rows: SCRow[] | undefined): GSCSummary {
  const r = rows?.[0];
  return {
    clicks: r?.clicks ?? 0,
    impressions: r?.impressions ?? 0,
    ctr: parseFloat(((r?.ctr ?? 0) * 100).toFixed(2)),
    avgPosition: parseFloat((r?.position ?? 0).toFixed(1)),
  };
}

// ── Main fetch ─────────────────────────────────────────────────────────────
export async function fetchSearchConsoleData(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<{
  summary: GSCSummary;
  trend: GSCTrendPoint[];
  topQueries: GSCQuery[];
  topPages: GSCPage[];
}> {
  const [summaryRes, trendRes, queriesRes, pagesRes] = await Promise.all([
    gscPost<{ rows?: SCRow[] }>(accessToken, siteUrl, {
      startDate, endDate, dimensions: [],
    }),
    gscPost<{ rows?: SCRow[] }>(accessToken, siteUrl, {
      startDate, endDate, dimensions: ['date'], rowLimit: 90,
    }),
    gscPost<{ rows?: SCRow[] }>(accessToken, siteUrl, {
      startDate, endDate, dimensions: ['query'], rowLimit: 10,
    }),
    gscPost<{ rows?: SCRow[] }>(accessToken, siteUrl, {
      startDate, endDate, dimensions: ['page'], rowLimit: 5,
    }),
  ]);

  return {
    summary: parseSummary(summaryRes.rows),
    trend: (trendRes.rows ?? []).map(r => ({
      date: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
    })),
    topQueries: (queriesRes.rows ?? []).map(r => ({
      query: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: parseFloat((r.ctr * 100).toFixed(2)),
      position: parseFloat(r.position.toFixed(1)),
    })),
    topPages: (pagesRes.rows ?? []).map(r => ({
      page: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: parseFloat((r.ctr * 100).toFixed(2)),
      position: parseFloat(r.position.toFixed(1)),
    })),
  };
}

// ── Fetch + store (full refresh) ───────────────────────────────────────────
export async function refreshGSCData(
  clientId: string,
  accessToken: string,
  siteUrl: string
): Promise<GSCData> {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const end = fmt(now);
  const start30 = fmt(new Date(now.getTime() - 29 * 86_400_000));
  const end60 = fmt(new Date(now.getTime() - 30 * 86_400_000));
  const start60 = fmt(new Date(now.getTime() - 59 * 86_400_000));

  const [current, prev] = await Promise.all([
    fetchSearchConsoleData(accessToken, siteUrl, start30, end),
    fetchSearchConsoleData(accessToken, siteUrl, start60, end60),
  ]);

  const gscData: GSCData = {
    current,
    previous: { summary: prev.summary },
    fetchedAt: now.toISOString(),
  };

  await saveGSCMetrics(clientId, gscData);
  return gscData;
}

// ── DB helpers ─────────────────────────────────────────────────────────────
export async function saveGSCMetrics(clientId: string, data: GSCData): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from('client_integration_metrics').upsert(
    {
      client_id: clientId,
      integration_type: 'google_search_console',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data as any,
      date_ref: today,
    },
    { onConflict: 'client_id,integration_type,date_ref' }
  );
  if (error) throw error;
}

export async function loadCachedGSCMetrics(
  clientId: string
): Promise<{ data: GSCData; date_ref: string } | null> {
  const { data, error } = await supabase
    .from('client_integration_metrics')
    .select('data, date_ref')
    .eq('client_id', clientId)
    .eq('integration_type', 'google_search_console')
    .order('date_ref', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { data: data.data as unknown as GSCData, date_ref: data.date_ref };
}

// ── Date helpers ───────────────────────────────────────────────────────────
export function isDataStale(dateRef: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dateRef < today;
}

export function formatLastSynced(fetchedAt: string): string {
  const diff = Date.now() - new Date(fetchedAt).getTime();
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor(diff / 60_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ago`;
  if (hours >= 1) return `${hours}h ago`;
  return `${mins}m ago`;
}

export function pctChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return parseFloat((((current - previous) / previous) * 100).toFixed(1));
}
