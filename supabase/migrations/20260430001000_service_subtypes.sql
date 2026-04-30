-- ============================================================
-- SERVICE SUBTYPES
-- Two-level hierarchy: services → service_subtypes
-- Goals, tasks, and SOPs are tied to subtypes, not services
-- ============================================================

-- 1. Create table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_subtypes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    UUID        NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  slug          TEXT        NOT NULL UNIQUE,
  is_count_based BOOLEAN    NOT NULL DEFAULT FALSE,
  description   TEXT,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_subtypes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subtypes_select" ON public.service_subtypes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "subtypes_insert" ON public.service_subtypes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_owner(auth.uid()));

CREATE POLICY "subtypes_update" ON public.service_subtypes
  FOR UPDATE TO authenticated
  USING (public.is_manager_or_owner(auth.uid()));

CREATE POLICY "subtypes_delete" ON public.service_subtypes
  FOR DELETE TO authenticated
  USING (public.is_manager_or_owner(auth.uid()));


-- 2. Add service_subtype_id FK to tasks ───────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS service_subtype_id UUID
    REFERENCES public.service_subtypes(id) ON DELETE SET NULL;


-- 3. Add service_subtype_id FK to service_goal_types ──────────
--    Goals now live at subtype level. The old service_id column
--    is kept (nullable) for backward compat with existing records.
ALTER TABLE public.service_goal_types
  ADD COLUMN IF NOT EXISTS service_subtype_id UUID
    REFERENCES public.service_subtypes(id) ON DELETE CASCADE;

ALTER TABLE public.service_goal_types
  ALTER COLUMN service_id DROP NOT NULL;

-- Also expand RLS on service_goal_types so managers can manage them
DROP POLICY IF EXISTS "Owners can insert goal types" ON public.service_goal_types;
DROP POLICY IF EXISTS "Owners can update goal types" ON public.service_goal_types;
DROP POLICY IF EXISTS "Owners can delete goal types" ON public.service_goal_types;

CREATE POLICY "Managers can insert goal types" ON public.service_goal_types
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_owner(auth.uid()));

CREATE POLICY "Managers can update goal types" ON public.service_goal_types
  FOR UPDATE TO authenticated
  USING (public.is_manager_or_owner(auth.uid()));

CREATE POLICY "Managers can delete goal types" ON public.service_goal_types
  FOR DELETE TO authenticated
  USING (public.is_manager_or_owner(auth.uid()));

-- Expand RLS on service_task_templates so managers can manage them
DROP POLICY IF EXISTS "Owners can insert templates" ON public.service_task_templates;
DROP POLICY IF EXISTS "Owners can update templates" ON public.service_task_templates;
DROP POLICY IF EXISTS "Owners can delete templates" ON public.service_task_templates;

CREATE POLICY "Managers can insert templates" ON public.service_task_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_owner(auth.uid()));

CREATE POLICY "Managers can update templates" ON public.service_task_templates
  FOR UPDATE TO authenticated
  USING (public.is_manager_or_owner(auth.uid()));

CREATE POLICY "Managers can delete templates" ON public.service_task_templates
  FOR DELETE TO authenticated
  USING (public.is_manager_or_owner(auth.uid()));

-- Expand RLS on services so managers can manage them
DROP POLICY IF EXISTS "Owners can insert services" ON public.services;
DROP POLICY IF EXISTS "Owners can update services" ON public.services;
DROP POLICY IF EXISTS "Owners can delete services" ON public.services;

CREATE POLICY "Managers can insert services" ON public.services
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_owner(auth.uid()));

CREATE POLICY "Managers can update services" ON public.services
  FOR UPDATE TO authenticated
  USING (public.is_manager_or_owner(auth.uid()));

CREATE POLICY "Managers can delete services" ON public.services
  FOR DELETE TO authenticated
  USING (public.is_manager_or_owner(auth.uid()));


-- 4. Seed default subtypes ────────────────────────────────────
DO $$
DECLARE
  v_seo_id         UUID;
  v_social_id      UUID;
  v_web_id         UUID;
  v_google_ads_id  UUID;
  v_meta_ads_id    UUID;
  v_email_id       UUID;
BEGIN
  -- Locate (or create) parent services by name
  SELECT id INTO v_seo_id        FROM public.services WHERE LOWER(name) LIKE '%seo%' LIMIT 1;
  SELECT id INTO v_social_id     FROM public.services WHERE LOWER(name) LIKE '%social%' LIMIT 1;
  SELECT id INTO v_web_id        FROM public.services WHERE LOWER(name) LIKE '%web%' OR LOWER(name) LIKE '%development%' LIMIT 1;
  SELECT id INTO v_google_ads_id FROM public.services WHERE LOWER(name) LIKE '%google%' LIMIT 1;
  SELECT id INTO v_meta_ads_id   FROM public.services WHERE LOWER(name) LIKE '%meta%' OR LOWER(name) LIKE '%facebook%' LIMIT 1;
  SELECT id INTO v_email_id      FROM public.services WHERE LOWER(name) LIKE '%email%' LIMIT 1;

  -- Create missing parent services
  IF v_seo_id IS NULL THEN
    INSERT INTO public.services (name, description) VALUES ('SEO', 'Search Engine Optimisation') RETURNING id INTO v_seo_id;
  END IF;
  IF v_social_id IS NULL THEN
    INSERT INTO public.services (name, description) VALUES ('Social Media', 'Social media management') RETURNING id INTO v_social_id;
  END IF;
  IF v_web_id IS NULL THEN
    INSERT INTO public.services (name, description) VALUES ('Web Development', 'Website design and development') RETURNING id INTO v_web_id;
  END IF;
  IF v_google_ads_id IS NULL THEN
    INSERT INTO public.services (name, description) VALUES ('Google Ads', 'Google paid search and display') RETURNING id INTO v_google_ads_id;
  END IF;
  IF v_meta_ads_id IS NULL THEN
    INSERT INTO public.services (name, description) VALUES ('Meta Ads', 'Facebook and Instagram advertising') RETURNING id INTO v_meta_ads_id;
  END IF;
  IF v_email_id IS NULL THEN
    INSERT INTO public.services (name, description) VALUES ('Email Marketing', 'Email campaigns and automation') RETURNING id INTO v_email_id;
  END IF;

  -- SEO subtypes
  INSERT INTO public.service_subtypes (service_id, name, slug, is_count_based, description, sort_order) VALUES
    (v_seo_id, 'Backlinks',       'backlinks',       TRUE,  'Link building and outreach',                   1),
    (v_seo_id, 'Content Writing', 'content_writing', TRUE,  'Article and blog content production',          2),
    (v_seo_id, 'On-Page SEO',     'onpage_seo',      FALSE, 'Title tags, meta descriptions, internal links',3),
    (v_seo_id, 'Technical SEO',   'technical_seo',   FALSE, 'Site speed, crawlability, structured data',    4)
  ON CONFLICT (slug) DO NOTHING;

  -- Social Media subtypes
  INSERT INTO public.service_subtypes (service_id, name, slug, is_count_based, description, sort_order) VALUES
    (v_social_id, 'Monthly Posts',   'social_media',    TRUE,  'Regular social media posting schedule',  1),
    (v_social_id, 'Stories & Reels', 'social_stories',  FALSE, 'Short-form video and story content',     2)
  ON CONFLICT (slug) DO NOTHING;

  -- Web Development subtypes
  INSERT INTO public.service_subtypes (service_id, name, slug, is_count_based, description, sort_order) VALUES
    (v_web_id, 'New Project',   'web_dev',          FALSE, 'New website or application build',     1),
    (v_web_id, 'Maintenance',   'web_maintenance',  FALSE, 'Ongoing maintenance and updates',      2),
    (v_web_id, 'Landing Page',  'web_landing_page', FALSE, 'Standalone landing page build',        3)
  ON CONFLICT (slug) DO NOTHING;

  -- Google Ads subtypes
  INSERT INTO public.service_subtypes (service_id, name, slug, is_count_based, description, sort_order) VALUES
    (v_google_ads_id, 'Search Campaigns',      'google_ads',     FALSE, 'Google Search advertising campaigns',    1),
    (v_google_ads_id, 'Display & Performance', 'google_display', FALSE, 'Google Display and Performance Max',     2)
  ON CONFLICT (slug) DO NOTHING;

  -- Meta Ads subtypes
  INSERT INTO public.service_subtypes (service_id, name, slug, is_count_based, description, sort_order) VALUES
    (v_meta_ads_id, 'Ad Campaigns', 'meta_ads',        FALSE, 'Facebook and Instagram ad campaigns',   1),
    (v_meta_ads_id, 'Retargeting',  'meta_retargeting',FALSE, 'Retargeting and lookalike audiences',   2)
  ON CONFLICT (slug) DO NOTHING;

  -- Email Marketing subtypes
  INSERT INTO public.service_subtypes (service_id, name, slug, is_count_based, description, sort_order) VALUES
    (v_email_id, 'Campaigns',  'email_marketing',  FALSE, 'Newsletter and campaign sends',    1),
    (v_email_id, 'Automation', 'email_automation', FALSE, 'Drip and automated sequences',     2)
  ON CONFLICT (slug) DO NOTHING;
END $$;


-- 5. Migrate existing tasks ───────────────────────────────────
--    Map service_type text → service_subtype_id
UPDATE public.tasks t
SET service_subtype_id = st.id
FROM public.service_subtypes st
WHERE t.service_subtype_id IS NULL
  AND t.service_type IS NOT NULL
  AND (
    (LOWER(t.service_type) = 'backlinks'        AND st.slug = 'backlinks')        OR
    (LOWER(t.service_type) = 'content writing'  AND st.slug = 'content_writing')  OR
    (LOWER(t.service_type) = 'on-page seo'      AND st.slug = 'onpage_seo')       OR
    (LOWER(t.service_type) = 'technical seo'    AND st.slug = 'technical_seo')    OR
    (LOWER(t.service_type) = 'google ads'       AND st.slug = 'google_ads')       OR
    (LOWER(t.service_type) = 'meta ads'         AND st.slug = 'meta_ads')         OR
    (LOWER(t.service_type) = 'social media'     AND st.slug = 'social_media')     OR
    (LOWER(t.service_type) = 'web development'  AND st.slug = 'web_dev')
  );
