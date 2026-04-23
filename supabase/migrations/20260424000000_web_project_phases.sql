-- ============================================================
-- Web Project Phase Checklist System
-- ============================================================

-- Phase tracking per task
CREATE TABLE public.web_project_phases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  phase_number  INTEGER NOT NULL CHECK (phase_number BETWEEN 1 AND 6),
  phase_name    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'not_started'
                  CHECK (status IN ('not_started','in_progress','completed')),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, phase_number)
);
ALTER TABLE public.web_project_phases ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_web_project_phases_updated_at
  BEFORE UPDATE ON public.web_project_phases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated can view web phases" ON public.web_project_phases
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert web phases" ON public.web_project_phases
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update web phases" ON public.web_project_phases
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete web phases" ON public.web_project_phases
  FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- Checklist items per phase (project-specific)
CREATE TABLE public.web_phase_checklist_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id      UUID REFERENCES public.web_project_phases(id) ON DELETE CASCADE NOT NULL,
  category      TEXT NOT NULL,
  item_text     TEXT NOT NULL,
  priority      TEXT NOT NULL DEFAULT 'required'
                  CHECK (priority IN ('required','optional')),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','received','not_applicable')),
  notes         TEXT,
  file_url      TEXT,
  file_name     TEXT,
  completed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at  TIMESTAMPTZ,
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.web_phase_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_web_phase_checklist_items_updated_at
  BEFORE UPDATE ON public.web_phase_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated can view checklist items" ON public.web_phase_checklist_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert checklist items" ON public.web_phase_checklist_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update checklist items" ON public.web_phase_checklist_items
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete checklist items" ON public.web_phase_checklist_items
  FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- Template table — seed once, copy per-project on init
CREATE TABLE public.web_phase_item_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_number  INTEGER NOT NULL CHECK (phase_number BETWEEN 1 AND 6),
  category      TEXT NOT NULL,
  item_text     TEXT NOT NULL,
  priority      TEXT NOT NULL DEFAULT 'required'
                  CHECK (priority IN ('required','optional')),
  position      INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.web_phase_item_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view templates" ON public.web_phase_item_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can manage templates" ON public.web_phase_item_templates
  FOR ALL TO authenticated USING (public.is_owner(auth.uid()));

-- ============================================================
-- SEED: Phase 1 — Discovery & Client Onboarding
-- ============================================================
INSERT INTO public.web_phase_item_templates (phase_number, category, item_text, priority, position) VALUES
(1,'BUSINESS INFORMATION','Client full business name and legal entity','required',0),
(1,'BUSINESS INFORMATION','Industry, niche, and target audience','required',1),
(1,'BUSINESS INFORMATION','Business goals for the website','required',2),
(1,'BUSINESS INFORMATION','Competitor websites to reference','optional',3),
(1,'BUSINESS INFORMATION','Unique selling proposition (USP)','required',4),
(1,'BUSINESS INFORMATION','Existing website URL (if redesign)','optional',5),
(1,'BRAND ASSETS','Primary logo (PNG, SVG, AI, EPS formats)','required',6),
(1,'BRAND ASSETS','Logo variations (dark, light, icon-only)','optional',7),
(1,'BRAND ASSETS','Brand color palette (hex codes)','required',8),
(1,'BRAND ASSETS','Typography – primary and secondary fonts','required',9),
(1,'BRAND ASSETS','Brand guidelines document','optional',10),
(1,'BRAND ASSETS','Tone of voice document','optional',11),
(1,'BRAND ASSETS','Existing marketing materials','optional',12),
(1,'TECHNICAL ACCESS','Domain name (existing or to be registered)','required',13),
(1,'TECHNICAL ACCESS','Hosting account credentials or preference','required',14),
(1,'TECHNICAL ACCESS','Access to existing CMS admin panel','optional',15),
(1,'TECHNICAL ACCESS','Email hosting preferences','optional',16);

-- ============================================================
-- SEED: Phase 2 — Strategy & Design Planning
-- ============================================================
INSERT INTO public.web_phase_item_templates (phase_number, category, item_text, priority, position) VALUES
(2,'SITEMAP & STRUCTURE','Approved sitemap (all pages and hierarchy)','required',0),
(2,'SITEMAP & STRUCTURE','Page priority list','optional',1),
(2,'SITEMAP & STRUCTURE','Navigation structure and menu labels','required',2),
(2,'SITEMAP & STRUCTURE','Footer content and links','required',3),
(2,'DESIGN DIRECTION','Mood board or visual inspiration references','optional',4),
(2,'DESIGN DIRECTION','Wireframes for key pages','required',5),
(2,'DESIGN DIRECTION','Mobile-first layout decisions confirmed','required',6),
(2,'DESIGN DIRECTION','Design mockups approved by client','required',7),
(2,'DESIGN DIRECTION','Accessibility requirements noted','optional',8),
(2,'FUNCTIONALITY SCOPE','Feature list confirmed (blog, shop, booking)','required',9),
(2,'FUNCTIONALITY SCOPE','Third-party integrations identified','optional',10),
(2,'FUNCTIONALITY SCOPE','Multi-language requirements','optional',11),
(2,'FUNCTIONALITY SCOPE','User login / member area needed','optional',12);

-- ============================================================
-- SEED: Phase 3 — Content Preparation
-- ============================================================
INSERT INTO public.web_phase_item_templates (phase_number, category, item_text, priority, position) VALUES
(3,'TEXT CONTENT','Homepage headline, subheadline & body copy','required',0),
(3,'TEXT CONTENT','About Us page (story, team bios, mission)','required',1),
(3,'TEXT CONTENT','Services or offerings page copy','required',2),
(3,'TEXT CONTENT','Contact page (address, phone, email, map)','required',3),
(3,'TEXT CONTENT','Privacy policy and terms & conditions','required',4),
(3,'TEXT CONTENT','FAQ content','optional',5),
(3,'TEXT CONTENT','Blog articles or initial posts','optional',6),
(3,'TEXT CONTENT','SEO meta titles and descriptions per page','required',7),
(3,'PRODUCT/SERVICE DETAILS','Product or service titles','required',8),
(3,'PRODUCT/SERVICE DETAILS','Product descriptions (short and long)','required',9),
(3,'PRODUCT/SERVICE DETAILS','Pricing (individual items, packages, variants)','required',10),
(3,'PRODUCT/SERVICE DETAILS','SKUs, categories, and tags','optional',11),
(3,'PRODUCT/SERVICE DETAILS','Stock or inventory data','optional',12),
(3,'PRODUCT/SERVICE DETAILS','Delivery / service area information','optional',13),
(3,'VISUAL CONTENT','Professional product/service photography','required',14),
(3,'VISUAL CONTENT','Team or staff headshots','optional',15),
(3,'VISUAL CONTENT','Office, store, or location photos','optional',16),
(3,'VISUAL CONTENT','Video content or reels','optional',17),
(3,'VISUAL CONTENT','Icons or illustrations','optional',18),
(3,'VISUAL CONTENT','Image alt text for all visuals','required',19);

-- ============================================================
-- SEED: Phase 4 — Development & Integration
-- ============================================================
INSERT INTO public.web_phase_item_templates (phase_number, category, item_text, priority, position) VALUES
(4,'DEVELOPMENT SETUP','CMS platform selected and installed','required',0),
(4,'DEVELOPMENT SETUP','Theme or base template selected','required',1),
(4,'DEVELOPMENT SETUP','Staging/development environment live','required',2),
(4,'DEVELOPMENT SETUP','Version control configured (Git)','optional',3),
(4,'E-COMMERCE & PAYMENTS','Payment gateway selected','optional',4),
(4,'E-COMMERCE & PAYMENTS','Payment gateway credentials and API keys','optional',5),
(4,'E-COMMERCE & PAYMENTS','GST/tax configuration','optional',6),
(4,'E-COMMERCE & PAYMENTS','Currency and locale settings','optional',7),
(4,'E-COMMERCE & PAYMENTS','Shipping zones and rates configured','optional',8),
(4,'E-COMMERCE & PAYMENTS','Order confirmation email templates','optional',9),
(4,'INTEGRATIONS','Google Analytics / Tag Manager installed','required',10),
(4,'INTEGRATIONS','Facebook Pixel / Meta tracking installed','optional',11),
(4,'INTEGRATIONS','Contact form connected to email or CRM','required',12),
(4,'INTEGRATIONS','Email marketing platform connected','optional',13),
(4,'INTEGRATIONS','WhatsApp chat widget configured','optional',14),
(4,'INTEGRATIONS','Google Maps embed configured','optional',15),
(4,'INTEGRATIONS','Social media profile links added','required',16);

-- ============================================================
-- SEED: Phase 5 — Testing & Quality Assurance
-- ============================================================
INSERT INTO public.web_phase_item_templates (phase_number, category, item_text, priority, position) VALUES
(5,'CROSS-DEVICE TESTING','Desktop (Chrome, Firefox, Safari, Edge)','required',0),
(5,'CROSS-DEVICE TESTING','Mobile (Android and iOS)','required',1),
(5,'CROSS-DEVICE TESTING','Tablet layout reviewed','required',2),
(5,'CROSS-DEVICE TESTING','All images loading and correctly sized','required',3),
(5,'FUNCTIONALITY CHECKS','All forms submit and send correctly','required',4),
(5,'FUNCTIONALITY CHECKS','All links and buttons working – no 404s','required',5),
(5,'FUNCTIONALITY CHECKS','Payment flow tested end-to-end','optional',6),
(5,'FUNCTIONALITY CHECKS','Search functionality working','optional',7),
(5,'FUNCTIONALITY CHECKS','Login / account creation flow tested','optional',8),
(5,'PERFORMANCE & SEO','Page speed tested (Google PageSpeed)','required',9),
(5,'PERFORMANCE & SEO','Images compressed and optimized','required',10),
(5,'PERFORMANCE & SEO','SSL certificate active (HTTPS)','required',11),
(5,'PERFORMANCE & SEO','Sitemap.xml generated and submitted','required',12),
(5,'PERFORMANCE & SEO','robots.txt configured correctly','required',13),
(5,'PERFORMANCE & SEO','All meta tags and OG tags verified','required',14),
(5,'PERFORMANCE & SEO','Favicon uploaded','required',15);

-- ============================================================
-- SEED: Phase 6 — Launch & Handover
-- ============================================================
INSERT INTO public.web_phase_item_templates (phase_number, category, item_text, priority, position) VALUES
(6,'PRE-LAUNCH','Final client sign-off received (written)','required',0),
(6,'PRE-LAUNCH','DNS settings pointed to live server','required',1),
(6,'PRE-LAUNCH','Staging site taken offline','required',2),
(6,'PRE-LAUNCH','Backup of full site created','required',3),
(6,'POST-LAUNCH','Live site reviewed on all devices','required',4),
(6,'POST-LAUNCH','Analytics confirmed receiving live data','required',5),
(6,'POST-LAUNCH','Google Search Console property verified','required',6),
(6,'POST-LAUNCH','Client login credentials handed over','required',7),
(6,'POST-LAUNCH','Training session or walkthrough provided','optional',8),
(6,'POST-LAUNCH','Maintenance plan or retainer discussed','optional',9),
(6,'POST-LAUNCH','Invoice issued and payment collected','required',10);

NOTIFY pgrst, 'reload schema';
