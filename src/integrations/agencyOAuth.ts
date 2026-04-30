/**
 * agencyOAuth.ts
 * Agency-level Google OAuth — connect once, use everywhere.
 *
 * Uses Google Identity Services (GIS) implicit / token flow:
 * - No refresh token (GIS limitation in browser)
 * - Token lasts ~1 hour; the UI prompts to reconnect when expired
 * - Scopes: Search Console readonly + Analytics readonly
 */
import { supabase } from './supabase/client';

// ── GIS type declarations (shared with searchConsole.ts) ──────────────────
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

// ── GIS singleton loader ──────────────────────────────────────────────────
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

// ── Types ─────────────────────────────────────────────────────────────────
export interface AgencyOAuthToken {
  access_token: string;
  expires_at: string;
  connected_at: string;
  scope: string | null;
}

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
].join(' ');

// ── Connect ───────────────────────────────────────────────────────────────
export async function connectAgencyGoogle(userId: string): Promise<AgencyOAuthToken> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('VITE_GOOGLE_CLIENT_ID is not set in .env');

  await loadGIS();

  return new Promise<AgencyOAuthToken>((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPES,
      callback: async (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || response.error || 'OAuth failed'));
          return;
        }

        const expiresAt = new Date(
          Date.now() + (response.expires_in ?? 3600) * 1000
        ).toISOString();

        const record = {
          provider: 'google',
          scope: GOOGLE_SCOPES,
          access_token: response.access_token,
          expires_at: expiresAt,
          connected_at: new Date().toISOString(),
          connected_by: userId,
        };

        const { error } = await supabase
          .from('agency_oauth_tokens')
          .upsert(record, { onConflict: 'provider' });

        if (error) { reject(error); return; }

        resolve({
          access_token: response.access_token,
          expires_at: expiresAt,
          connected_at: record.connected_at,
          scope: GOOGLE_SCOPES,
        });
      },
      error_callback: (err) => reject(new Error(err.message ?? err.type)),
    });

    // Use 'consent' prompt so user sees which account they're connecting
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

// ── Disconnect ────────────────────────────────────────────────────────────
export async function disconnectAgencyGoogle(): Promise<void> {
  const { error } = await supabase
    .from('agency_oauth_tokens')
    .delete()
    .eq('provider', 'google');
  if (error) throw error;
}

// ── Status ────────────────────────────────────────────────────────────────
export async function getAgencyGoogleToken(): Promise<AgencyOAuthToken | null> {
  const { data, error } = await supabase
    .from('agency_oauth_tokens')
    .select('access_token, expires_at, connected_at, scope')
    .eq('provider', 'google')
    .maybeSingle();

  if (error || !data) return null;
  return data as AgencyOAuthToken;
}

export function isAgencyTokenExpired(expiresAt: string): boolean {
  // Consider expired if within 5 minutes of expiry
  return new Date(expiresAt) <= new Date(Date.now() + 5 * 60_000);
}

export function formatTokenExpiry(expiresAt: string): string {
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  if (msLeft <= 0) return 'Expired';
  const minsLeft = Math.floor(msLeft / 60_000);
  if (minsLeft < 60) return `Expires in ${minsLeft}m`;
  return `Expires in ${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m`;
}
