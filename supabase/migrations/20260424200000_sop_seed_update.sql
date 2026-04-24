-- ============================================================
-- Add unique constraint to sop_guides for safe upserts
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sop_guides_service_template_key'
      AND conrelid = 'public.sop_guides'::regclass
  ) THEN
    ALTER TABLE public.sop_guides
      ADD CONSTRAINT sop_guides_service_template_key
      UNIQUE (service_type, task_template_name);
  END IF;
END $$;

-- ============================================================
-- Upsert SOPs (insert or update with spec content)
-- ============================================================
INSERT INTO public.sop_guides (service_type, task_template_name, title, content, video_url) VALUES

('seo', 'backlink_building', 'How to Build Quality Backlinks',
'## What counts as a quality backlink?
A backlink from a site with DA 30+ that is relevant to the client niche, is DoFollow, and placed naturally within content.

## Step by step:
1. Find target sites using Google: [niche] + "write for us"
2. Check DA/PA using MozBar extension
3. Must be DA 30+ to count toward target
4. Send personalised outreach email
5. Follow up once after 5 days
6. Once approved, place the link naturally
7. Verify it is live and DoFollow
8. Log ALL details in backlink log immediately

## Rules:
- Never build from sites with DA under 20
- Max 5 links from same domain per client
- Vary anchor text — max 20% exact match', NULL),

('seo', 'technical_audit', 'How to Run a Technical SEO Audit',
'## Tools needed:
- Screaming Frog (free up to 500 URLs)
- Google Search Console
- Google PageSpeed Insights

## Step by step:
1. Crawl site with Screaming Frog
2. Export and fix all 4xx broken links
3. Check page speed on mobile — target 80+
4. Review Core Web Vitals in Search Console
5. Find and fix duplicate meta titles
6. Check XML sitemap is current
7. Verify robots.txt is not blocking pages
8. Document every issue found with severity
9. Fix critical issues before end of month', NULL),

('google_ads', 'campaign_review', 'How to Review a Google Ads Campaign',
'## Before you start:
Know the client target CPA and ROAS.

## Step by step:
1. Check top metrics vs last month and target
2. Run search terms report — add new negatives
3. Find keywords with Quality Score under 6
4. Check budget pacing — over or under?
5. Rotate in one new ad variant per ad group
6. Check landing page speed and conversion rate
7. Document wins, issues, and next month plan

## What to report:
- ROAS this month vs target
- Top 3 wins and top 3 issues
- Recommendation for next month', NULL),

('meta_ads', 'campaign_review', 'How to Review Meta Ads',
'## Step by step:
1. Check ROAS and CPL vs targets
2. Review ad frequency — pause if over 3.0
3. Check for audience overlap between ad sets
4. Identify fatigued creatives — pause worst
5. Review placement performance breakdown
6. Verify Meta Pixel is firing on all pages
7. Refresh lookalike audiences monthly
8. Document performance for client report', NULL),

('social_media', 'monthly_posts', 'How to Manage Monthly Social Posts',
'## Step by step:
1. Get content calendar approved by 5th of month
2. Schedule all posts in advance
3. Check image dimensions per platform:
   - Instagram: 1080x1080 or 1080x1350
   - Facebook: 1200x630
   - LinkedIn: 1200x627
4. Proofread every caption before scheduling
5. Verify all hashtags are relevant
6. Monitor first 24hr engagement per post
7. Log every post URL and metrics in system', NULL)

ON CONFLICT (service_type, task_template_name) DO UPDATE SET
  title   = EXCLUDED.title,
  content = EXCLUDED.content,
  video_url = EXCLUDED.video_url,
  updated_at = now();

NOTIFY pgrst, 'reload schema';
