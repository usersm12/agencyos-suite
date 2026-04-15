-- ============ TASK CHECKLISTS ============
CREATE TABLE IF NOT EXISTS public.task_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  item_text TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view checklists" ON public.task_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert checklists" ON public.task_checklists FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update checklists" ON public.task_checklists FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete checklists" ON public.task_checklists FOR DELETE TO authenticated USING (true);

-- ============ SOP GUIDES ============
CREATE TABLE IF NOT EXISTS public.sop_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL,
  task_template_name TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  video_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sop_guides ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_sop_guides_updated_at BEFORE UPDATE ON public.sop_guides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated can view SOPs" ON public.sop_guides FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can manage SOPs" ON public.sop_guides FOR ALL TO authenticated USING (public.is_owner(auth.uid()));

-- ============ TASK ATTACHMENTS ============
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view task attachments" ON public.task_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert task attachments" ON public.task_attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete task attachments" ON public.task_attachments FOR DELETE TO authenticated USING (true);

-- ============ CLIENT DOCUMENTS ============
CREATE TABLE IF NOT EXISTS public.client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('contract', 'report', 'creative', 'other')),
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view all client docs" ON public.client_documents FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can view assigned client docs" ON public.client_documents FOR SELECT TO authenticated USING (public.is_assigned_to_client(auth.uid(), client_id));
CREATE POLICY "Authenticated can insert client docs" ON public.client_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Owners can delete client docs" ON public.client_documents FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can delete assigned client docs" ON public.client_documents FOR DELETE TO authenticated USING (public.is_assigned_to_client(auth.uid(), client_id));

-- ============ TIME LOGS ============
CREATE TABLE IF NOT EXISTS public.time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view all time logs" ON public.time_logs FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can view assigned time logs" ON public.time_logs FOR SELECT TO authenticated USING (
  client_id IS NULL OR public.is_assigned_to_client(auth.uid(), client_id)
);
CREATE POLICY "Users can view own time logs" ON public.time_logs FOR SELECT TO authenticated USING (
  user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Authenticated can insert time logs" ON public.time_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update own time logs" ON public.time_logs FOR UPDATE TO authenticated USING (
  user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR public.is_owner(auth.uid())
);
CREATE POLICY "Authenticated can delete own time logs" ON public.time_logs FOR DELETE TO authenticated USING (
  user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR public.is_owner(auth.uid())
);

-- ============ SEED SOP GUIDES ============
INSERT INTO public.sop_guides (service_type, task_template_name, title, content) VALUES

('seo', 'backlink_building', 'SEO Backlink Building',
'## How to Build Quality Backlinks

### What is a quality backlink?
A quality backlink comes from a website with DA 30+ that is relevant to the client''s niche, is DoFollow, and is placed naturally within content.

### Step by step process:
1. **Find target sites**: Use Google search ''[client niche] + write for us'' or ''[client niche] + guest post''. Also check competitor backlink profiles in Ahrefs.
2. **Qualify the site**: Check DA/PA using MozBar Chrome extension. Must be DA 30+ to count toward monthly target.
3. **Send outreach**: Use the email template in Settings > Templates. Personalise the first line with something specific about their site.
4. **Follow up**: If no reply after 5 days, send one follow up. If no reply after that, move on.
5. **Place the link**: Once approved, write or provide the content. Ensure the anchor text matches what was agreed.
6. **Verify and log**: Check the link is live, is DoFollow, and log all details in the backlink log immediately.

### Common mistakes to avoid:
- Never build links from sites with DA under 20
- Never use exact match anchor text more than 20% of the time — use branded or natural anchors
- Never build more than 5 links from the same domain
- Always check the site has real traffic before reaching out'),

('google_ads', 'campaign_review', 'Google Ads Campaign Review',
'## How to Review a Google Ads Campaign

### Before you start:
Make sure you have access to the Google Ads account and know the client''s target CPA/ROAS.

### Step by step process:
1. **Check top-level metrics**: Compare this month''s CTR, CPC, conversions, and ROAS vs last month and vs target.
2. **Search terms report**: Find irrelevant search terms and add them as negatives. Find high-performing terms and create dedicated ad groups for them.
3. **Quality scores**: Any keyword below Quality Score 6 needs attention — fix the ad copy, landing page, or keyword match.
4. **Budget pacing**: Is spend on track? If underspending, check bids. If overspending, reduce bids or tighten targeting.
5. **Ad copy**: Rotate in one new ad variant per ad group per month. Pause worst performer.
6. **Landing pages**: Check landing page load speed and conversion rate.

### What to report to manager:
- Overall ROAS this month vs target
- Top 3 wins
- Top 3 issues found and fixed
- Recommendation for next month'),

('meta_ads', 'campaign_review', 'Meta Ads Campaign Review',
'## How to Review a Meta Ads Campaign

### Before you start:
Have the Ads Manager open and know the client''s target ROAS and monthly budget.

### Step by step process:
1. **Review ROAS vs target**: Is the campaign hitting the agreed return? Compare week-on-week.
2. **Check frequency**: If frequency is above 3.0, creative fatigue is likely. Flag for new creatives.
3. **Audience overlap**: Use the Audience Overlap tool to check if ad sets are competing with each other.
4. **Creative performance**: Identify the top and bottom performing creatives. Pause bottom 20%.
5. **Placement breakdown**: Check if certain placements (Reels, Feed, Stories) are pulling results. Shift budget accordingly.
6. **Pixel check**: Verify the pixel is firing on all key events (Purchase, Add to Cart, etc.).

### Common issues to watch for:
- High frequency + declining CTR = creative fatigue
- Low ROAS from broad audiences = tighten targeting
- Pixel not firing = conversion tracking broken, pause and fix immediately'),

('social_media', 'monthly_posts', 'Social Media Monthly Posts',
'## How to Manage Monthly Social Posts

### Before the month starts:
- Confirm the content calendar is approved by the client in writing
- Ensure all assets (images, videos) are received at least 5 days before scheduling

### Step by step process:
1. **Schedule all posts**: Use the scheduling tool to queue every post for the month. Do not post manually.
2. **Quality check each post**: Correct dimensions, no typos, correct hashtags, correct links.
3. **First 24h monitoring**: Check every post within 24 hours of going live. Reply to comments.
4. **Log metrics**: At month end, log all post URLs, likes, reach, and engagement rate in the system.

### Platform specs:
- Instagram Feed: 1080x1080 or 1080x1350
- Instagram Reels: 1080x1920
- Facebook: 1200x630
- LinkedIn: 1200x627
- Twitter/X: 1200x675'),

('web_dev', 'new_project', 'Web Development New Project',
'## How to Deliver a Web Development Project

### Phase 1 — Discovery
1. Collect all brand assets: logo (SVG), brand colours, fonts, photography
2. Confirm sitemap and page structure in writing with client
3. Set up staging environment before writing a single line of code

### Phase 2 — Development
1. Get design approval (Figma or mockup) before development starts — no exceptions
2. Build on staging, not live server
3. Use semantic HTML, ensure accessibility (WCAG 2.1 AA minimum)

### Phase 3 — QA
1. Test on Chrome, Firefox, Safari, Edge
2. Test on real iOS and Android devices (not just emulator)
3. Run GTmetrix — score must be 80+ before delivery
4. Test all forms end-to-end
5. Check SSL is active and HTTP redirects to HTTPS

### Phase 4 — Handover
1. Submit sitemap to Google Search Console
2. Hand over login credentials via secure channel (not email)
3. Record a Loom walkthrough for the client');

-- ============ DEFAULT CHECKLIST TEMPLATES (stored as function for task creation) ============
-- These are referenced by application code when creating tasks by service_type
