-- ============================================================
-- AGENCY OAUTH TOKENS
-- Stores agency-wide Google OAuth access tokens so the owner
-- can connect once and use one Google identity to pull data
-- for all clients (GSC, GA4, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agency_oauth_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT        NOT NULL,           -- 'google'
  scope        TEXT,                           -- granted scopes (space-separated)
  access_token TEXT        NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  connected_by UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE(provider)
);

ALTER TABLE public.agency_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Only owners can see and manage agency-level tokens
CREATE POLICY "Owners can view agency_oauth_tokens"
  ON public.agency_oauth_tokens FOR SELECT
  TO authenticated
  USING (public.is_owner(auth.uid()));

CREATE POLICY "Owners can manage agency_oauth_tokens"
  ON public.agency_oauth_tokens FOR ALL
  TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));
