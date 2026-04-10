-- add missing columns to clients table
ALTER TABLE public.clients
ADD COLUMN website_url TEXT,
ADD COLUMN industry TEXT,
ADD COLUMN contract_start_date DATE,
ADD COLUMN contract_type TEXT DEFAULT 'Retainer' CHECK (contract_type IN ('One-time', 'Retainer')),
ADD COLUMN monthly_retainer_value NUMERIC,
ADD COLUMN notes TEXT,
ADD COLUMN manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- update RLS policies if necessary? clients policies already allow Owners for all, Managers for is_assigned. Our manager_id is new, but `is_assigned_to_client` checks the junction table `team_assignments`. We could update it, but keeping logic in `team_assignments` is safer for the existing policy. The spec says manager is foreign key, team members are junction table. So we will just leave the existing RLS or update it if needed. Leaving it relies on junction table for access.

-- ============ CLIENT CREDENTIALS ============
CREATE TABLE public.client_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL UNIQUE,
  website_cms_url TEXT,
  website_cms_notes TEXT,
  ga4_property_id TEXT,
  gsc_property_url TEXT,
  google_ads_account_id TEXT,
  meta_business_manager_id TEXT,
  social_media_handles JSONB DEFAULT '{}',
  general_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_credentials ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_client_credentials_updated_at BEFORE UPDATE ON public.client_credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Owners can view all client_credentials" ON public.client_credentials FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can view assigned client_credentials" ON public.client_credentials FOR SELECT TO authenticated USING (public.is_assigned_to_client(auth.uid(), client_id));
CREATE POLICY "Owners can manage client_credentials" ON public.client_credentials FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Managers can insert assigned client_credentials" ON public.client_credentials FOR INSERT TO authenticated WITH CHECK (public.is_assigned_to_client(auth.uid(), client_id));
CREATE POLICY "Owners can update client_credentials" ON public.client_credentials FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can update assigned client_credentials" ON public.client_credentials FOR UPDATE TO authenticated USING (public.is_assigned_to_client(auth.uid(), client_id));
CREATE POLICY "Owners can delete client_credentials" ON public.client_credentials FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- ============ CLIENT INTEGRATIONS ============
CREATE TABLE public.client_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google_search_console', 'google_analytics', 'google_ads', 'meta_ads')),
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, provider)
);
ALTER TABLE public.client_integrations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_client_integrations_updated_at BEFORE UPDATE ON public.client_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Owners can view all client_integrations" ON public.client_integrations FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can view assigned client_integrations" ON public.client_integrations FOR SELECT TO authenticated USING (public.is_assigned_to_client(auth.uid(), client_id));
CREATE POLICY "Owners can manage client_integrations" ON public.client_integrations FOR ALL TO authenticated USING (public.is_owner(auth.uid()));

-- ============ CLIENT INTEGRATION METRICS ============
CREATE TABLE public.client_integration_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  integration_type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  date_ref DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, integration_type, date_ref)
);
ALTER TABLE public.client_integration_metrics ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_client_integration_metrics_updated_at BEFORE UPDATE ON public.client_integration_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Owners can view all client_integration_metrics" ON public.client_integration_metrics FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can view assigned client_integration_metrics" ON public.client_integration_metrics FOR SELECT TO authenticated USING (public.is_assigned_to_client(auth.uid(), client_id));
CREATE POLICY "Owners can manage client_integration_metrics" ON public.client_integration_metrics FOR ALL TO authenticated USING (public.is_owner(auth.uid()));
