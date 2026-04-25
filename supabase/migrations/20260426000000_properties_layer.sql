-- ============================================================
-- PROPERTIES LAYER
-- Adds a "Property" between Client and everything else.
-- One client can have many properties (sites, apps, subdomains).
--
-- SAFE MIGRATION STRATEGY
-- ─────────────────────────
-- • All new columns are NULLABLE — zero breakage on existing rows
-- • Every existing client gets one auto-created primary property
-- • All existing child rows are backfilled with that property_id
-- • Existing unique constraints are preserved; per-property unique
--   constraints added only where property_id is non-null
-- • Single-site clients (is_multisite = false) never see the layer
-- ============================================================

-- ── 1. ENUM ──────────────────────────────────────────────────
CREATE TYPE public.property_type AS ENUM (
  'website', 'app', 'subdomain', 'other'
);

-- ── 2. PROPERTIES TABLE ──────────────────────────────────────
CREATE TABLE public.properties (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  url           TEXT,
  property_type public.property_type NOT NULL DEFAULT 'website',
  is_primary    BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 3. is_multisite FLAG ON CLIENTS ──────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_multisite BOOLEAN NOT NULL DEFAULT false;

-- ── 4. AUTO-CREATE ONE PRIMARY PROPERTY PER EXISTING CLIENT ──
-- Uses the client name + existing website_url.
-- is_primary = true marks it as the default property.
INSERT INTO public.properties (client_id, name, url, property_type, is_primary)
SELECT
  c.id,
  c.name,
  c.website_url,   -- may be null — that's fine
  'website',
  true
FROM public.clients c;

-- ── 5. ADD property_id (NULLABLE) TO ALL CHILD TABLES ────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS property_id UUID
    REFERENCES public.properties(id) ON DELETE SET NULL;

ALTER TABLE public.backlink_log
  ADD COLUMN IF NOT EXISTS property_id UUID
    REFERENCES public.properties(id) ON DELETE SET NULL;

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS property_id UUID
    REFERENCES public.properties(id) ON DELETE SET NULL;

ALTER TABLE public.client_goals
  ADD COLUMN IF NOT EXISTS property_id UUID
    REFERENCES public.properties(id) ON DELETE SET NULL;

-- client_credentials: was UNIQUE(client_id) — drop that to allow
-- one row per property for multisite clients
ALTER TABLE public.client_credentials
  DROP CONSTRAINT IF EXISTS client_credentials_client_id_key;

ALTER TABLE public.client_credentials
  ADD COLUMN IF NOT EXISTS property_id UUID
    REFERENCES public.properties(id) ON DELETE SET NULL;

-- client_integrations: was UNIQUE(client_id, provider) — replace with
-- UNIQUE(property_id, provider) so each property can have its own GSC/GA4
ALTER TABLE public.client_integrations
  DROP CONSTRAINT IF EXISTS client_integrations_client_id_provider_key;

ALTER TABLE public.client_integrations
  ADD COLUMN IF NOT EXISTS property_id UUID
    REFERENCES public.properties(id) ON DELETE SET NULL;

-- client_integration_metrics: was UNIQUE(client_id, integration_type, date_ref)
-- replace with property-scoped unique key
ALTER TABLE public.client_integration_metrics
  DROP CONSTRAINT IF EXISTS client_integration_metrics_client_id_integration_type_date_ref_key;

ALTER TABLE public.client_integration_metrics
  ADD COLUMN IF NOT EXISTS property_id UUID
    REFERENCES public.properties(id) ON DELETE SET NULL;

ALTER TABLE public.client_services
  ADD COLUMN IF NOT EXISTS property_id UUID
    REFERENCES public.properties(id) ON DELETE SET NULL;

-- ── 6. BACKFILL property_id ON ALL CHILD TABLES ──────────────
-- Each child row's client_id tells us which (single) primary property to use.

UPDATE public.tasks t
SET    property_id = pr.id
FROM   public.properties pr
WHERE  pr.client_id = t.client_id
  AND  pr.is_primary = true
  AND  t.property_id IS NULL;

UPDATE public.backlink_log bl
SET    property_id = pr.id
FROM   public.properties pr
WHERE  pr.client_id = bl.client_id
  AND  pr.is_primary = true
  AND  bl.property_id IS NULL;

UPDATE public.social_posts sp
SET    property_id = pr.id
FROM   public.properties pr
WHERE  pr.client_id = sp.client_id
  AND  pr.is_primary = true
  AND  sp.property_id IS NULL;

UPDATE public.client_goals cg
SET    property_id = pr.id
FROM   public.properties pr
WHERE  pr.client_id = cg.client_id
  AND  pr.is_primary = true
  AND  cg.property_id IS NULL;

UPDATE public.client_credentials cc
SET    property_id = pr.id
FROM   public.properties pr
WHERE  pr.client_id = cc.client_id
  AND  pr.is_primary = true
  AND  cc.property_id IS NULL;

UPDATE public.client_integrations ci
SET    property_id = pr.id
FROM   public.properties pr
WHERE  pr.client_id = ci.client_id
  AND  pr.is_primary = true
  AND  ci.property_id IS NULL;

UPDATE public.client_integration_metrics cim
SET    property_id = pr.id
FROM   public.properties pr
WHERE  pr.client_id = cim.client_id
  AND  pr.is_primary = true
  AND  cim.property_id IS NULL;

UPDATE public.client_services cs
SET    property_id = pr.id
FROM   public.properties pr
WHERE  pr.client_id = cs.client_id
  AND  pr.is_primary = true
  AND  cs.property_id IS NULL;

-- ── 7. ADD PROPERTY-SCOPED UNIQUE CONSTRAINTS ─────────────────
-- Only enforced when property_id IS NOT NULL (PostgreSQL NULLs
-- are not equal in UNIQUE, so nullable rows are not constrained).

-- One credentials row per property
ALTER TABLE public.client_credentials
  ADD CONSTRAINT client_credentials_property_id_key
    UNIQUE (property_id);

-- One integration per (property, provider)
ALTER TABLE public.client_integrations
  ADD CONSTRAINT client_integrations_property_id_provider_key
    UNIQUE (property_id, provider);

-- One metric snapshot per (property, integration_type, date)
ALTER TABLE public.client_integration_metrics
  ADD CONSTRAINT client_integration_metrics_property_type_date_key
    UNIQUE (property_id, integration_type, date_ref);

-- ── 8. RLS POLICIES FOR PROPERTIES ───────────────────────────

-- Owners see all properties
CREATE POLICY "Owners can view all properties"
  ON public.properties FOR SELECT TO authenticated
  USING (public.is_owner(auth.uid()));

-- Users assigned to the parent client can see its properties
CREATE POLICY "Assigned users can view properties"
  ON public.properties FOR SELECT TO authenticated
  USING (public.is_assigned_to_client(auth.uid(), client_id));

-- Task assignees can see the property their task belongs to
CREATE POLICY "Task assignees can view their property"
  ON public.properties FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.tasks t
        JOIN public.profiles p ON p.id = t.assigned_to
       WHERE t.property_id = properties.id
         AND p.user_id = auth.uid()
    )
  );

-- Owners can do everything
CREATE POLICY "Owners can manage properties"
  ON public.properties FOR ALL TO authenticated
  USING (public.is_owner(auth.uid()));

-- Managers can create properties for clients they're assigned to
CREATE POLICY "Managers can insert properties"
  ON public.properties FOR INSERT TO authenticated
  WITH CHECK (public.is_assigned_to_client(auth.uid(), client_id));

-- Managers can edit properties for their assigned clients
CREATE POLICY "Managers can update assigned properties"
  ON public.properties FOR UPDATE TO authenticated
  USING (public.is_assigned_to_client(auth.uid(), client_id));

-- Managers can delete properties for their assigned clients
CREATE POLICY "Managers can delete assigned properties"
  ON public.properties FOR DELETE TO authenticated
  USING (public.is_assigned_to_client(auth.uid(), client_id));

-- ── 9. HELPER: get_properties_for_client RPC ─────────────────
-- SECURITY DEFINER so RLS on properties is bypassed for reads
-- (same pattern used for get_projects_for_client).
CREATE OR REPLACE FUNCTION public.get_properties_for_client(p_client_id UUID)
RETURNS TABLE (
  id            UUID,
  name          TEXT,
  url           TEXT,
  property_type TEXT,
  is_primary    BOOLEAN,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid  UUID;
  v_caller_role public.app_role;
BEGIN
  v_caller_uid := auth.uid();

  SELECT role INTO v_caller_role
    FROM public.profiles WHERE user_id = v_caller_uid;

  -- Owner: sees all properties for any client
  -- Manager / team_member: only if assigned to the client
  IF v_caller_role = 'owner'
     OR public.is_assigned_to_client(v_caller_uid, p_client_id)
     OR EXISTS (
         SELECT 1 FROM public.tasks t
         JOIN public.profiles p ON p.id = t.assigned_to
         WHERE t.client_id = p_client_id AND p.user_id = v_caller_uid
       )
  THEN
    RETURN QUERY
      SELECT pr.id, pr.name, pr.url,
             pr.property_type::TEXT, pr.is_primary, pr.created_at
        FROM public.properties pr
       WHERE pr.client_id = p_client_id
       ORDER BY pr.is_primary DESC, pr.created_at ASC;
  END IF;

  -- No access — return empty
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_properties_for_client(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
