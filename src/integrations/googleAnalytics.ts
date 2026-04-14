import { supabase } from './supabase/client';
import { isTokenExpired } from './searchConsole';

// GIS is shared — declared in searchConsole.ts global augmentation

// ── Types ──────────────────────────────────────────────────────────────────
export interface GA4Summary {
  sessions: number;
  users: number;
  newUsers: number;
  bounceRate: number;           // percentage e.g. 42.1
  avgSessionDuration: number;  // seconds
}

export interface GA4TrendPoint {
  date: string;    // YYYY-MM-DD
  sessions: number;
  newUsers: number;
}

export interface GA4TrafficSource {
  channel: string;
  sessions: number;
}

export interface GA4Page {
  page: string;
  sessions: number;
  users: number;
}

export interface GA4Data {
  current: {
    summary: GA4Summary;
    trend: GA4TrendPoint[];
    trafficSources: GA4TrafficSource[];
    topPages: GA4Page[];
  };
  previous: {
    summary: GA4Summary;
  };
  fetchedAt: string;
}

export interface GA4Integration {
  access_token: string;
  expires_at: string;
  connected_at: string;
}

export { isTokenExpired };

// ── GIS loader (shared singleton) ─────────────────────────────────────────
let gisLoading: Promise<void> | null = null;

function loadGIS(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoading) return gisLoading;
  gisLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
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
export async function connectGA4(clientId: string): Promise<string> {
  const clientIdEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientIdEnv) throw new Error('VITE_GOOGLE_CLIENT_ID is not set in .env');

  await loadGIS();

  return new Promise<string>((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientIdEnv,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
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
            provider: 'google_analytics',
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

export async function disconnectGA4(clientId: string): Promise<void> {
  await supabase
    .from('client_integrations')
    .delete()
    .eq('client_id', clientId)
    .eq('provider', 'google_analytics');
}

export async function getGA4Integration(clientId: string): Promise<GA4Integration | null> {
  const { data, error } = await supabase
    .from('client_integrations')
    .select('access_token, expires_at, connected_at')
    .eq('client_id', clientId)
    .eq('provider', 'google_analytics')
    .maybeSingle();

  if (error || !data?.access_token) return null;
  return data as GA4Integration;
}

// ── GA4 Data API helpers ───────────────────────────────────────────────────
function normalizePropertyId(id: string): string {
  return id.startsWith('properties/') ? id : `properties/${id}`;
}

interface GA4ReportRequest {
  dateRanges: Array<{ startDate: string; endDate: string }>;
  dimensions?: Array<{ name: string }>;
  metrics: Array<{ name: string }>;
  limit?: number;
  orderBys?: Array<{ metric?: { metricName: string }; desc?: boolean }>;
}

interface GA4ReportRow {
  dimensionValues?: Array<{ value: string }>;
  metricValues: Array<{ value: string }>;
}

interface GA4ReportResponse {
  rows?: GA4ReportRow[];
  rowCount?: number;
}

async function ga4Report(
  accessToken: string,
  propertyId: string,
  request: GA4ReportRequest
): Promise<GA4ReportResponse> {
  const propId = normalizePropertyId(propertyId);
  const url = `https://analyticsdata.googleapis.com/v1beta/${propId}:runReport`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `GA4 API error ${res.status}`);
  }
  return res.json() as Promise<GA4ReportResponse>;
}

function metricVal(row: GA4ReportRow, index: number): number {
  return parseFloat(row.metricValues[index]?.value ?? '0');
}

function parseSummary(rows: GA4ReportRow[] | undefined): GA4Summary {
  const r = rows?.[0];
  if (!r) return { sessions: 0, users: 0, newUsers: 0, bounceRate: 0, avgSessionDuration: 0 };
  return {
    sessions: metricVal(r, 0),
    users: metricVal(r, 1),
    newUsers: metricVal(r, 2),
    bounceRate: parseFloat((metricVal(r, 3) * 100).toFixed(1)),
    avgSessionDuration: parseFloat(metricVal(r, 4).toFixed(0)),
  };
}

// ── Main fetch ─────────────────────────────────────────────────────────────
export async function fetchGA4Data(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<{
  summary: GA4Summary;
  trend: GA4TrendPoint[];
  trafficSources: GA4TrafficSource[];
  topPages: GA4Page[];
}> {
  const [summaryRes, trendRes, sourcesRes, pagesRes] = await Promise.all([
    // Summary metrics
    ga4Report(accessToken, propertyId, {
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
    }),
    // Daily trend
    ga4Report(accessToken, propertyId, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'sessions' }, { name: 'newUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: false }],
      limit: 90,
    }),
    // Traffic sources
    ga4Report(accessToken, propertyId, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 5,
    }),
    // Top landing pages
    ga4Report(accessToken, propertyId, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'landingPagePlusQueryString' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 5,
    }),
  ]);

  // GA4 date format is YYYYMMDD — convert to YYYY-MM-DD
  const fmtDate = (s: string) =>
    s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : s;

  return {
    summary: parseSummary(summaryRes.rows),
    trend: (trendRes.rows ?? []).map(r => ({
      date: fmtDate(r.dimensionValues?.[0]?.value ?? ''),
      sessions: metricVal(r, 0),
      newUsers: metricVal(r, 1),
    })),
    trafficSources: (sourcesRes.rows ?? []).map(r => ({
      channel: r.dimensionValues?.[0]?.value ?? 'Unknown',
      sessions: metricVal(r, 0),
    })),
    topPages: (pagesRes.rows ?? []).map(r => ({
      page: r.dimensionValues?.[0]?.value ?? '/',
      sessions: metricVal(r, 0),
      users: metricVal(r, 1),
    })),
  };
}

// ── Fetch + store (full refresh) ───────────────────────────────────────────
export async function refreshGA4Data(
  clientId: string,
  accessToken: string,
  propertyId: string
): Promise<GA4Data> {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const end = fmt(now);
  const start30 = fmt(new Date(now.getTime() - 29 * 86_400_000));
  const end60 = fmt(new Date(now.getTime() - 30 * 86_400_000));
  const start60 = fmt(new Date(now.getTime() - 59 * 86_400_000));

  const [current, prev] = await Promise.all([
    fetchGA4Data(accessToken, propertyId, start30, end),
    fetchGA4Data(accessToken, propertyId, start60, end60),
  ]);

  const ga4Data: GA4Data = {
    current,
    previous: { summary: prev.summary },
    fetchedAt: now.toISOString(),
  };

  await saveGA4Metrics(clientId, ga4Data);
  return ga4Data;
}

// ── DB helpers ─────────────────────────────────────────────────────────────
export async function saveGA4Metrics(clientId: string, data: GA4Data): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from('client_integration_metrics').upsert(
    {
      client_id: clientId,
      integration_type: 'google_analytics',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data as any,
      date_ref: today,
    },
    { onConflict: 'client_id,integration_type,date_ref' }
  );
  if (error) throw error;
}

export async function loadCachedGA4Metrics(
  clientId: string
): Promise<{ data: GA4Data; date_ref: string } | null> {
  const { data, error } = await supabase
    .from('client_integration_metrics')
    .select('data, date_ref')
    .eq('client_id', clientId)
    .eq('integration_type', 'google_analytics')
    .order('date_ref', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { data: data.data as unknown as GA4Data, date_ref: data.date_ref };
}

// ── Shared utils (re-exported for convenience) ─────────────────────────────
export { isDataStale, formatLastSynced, pctChange } from './searchConsole';

export function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}
