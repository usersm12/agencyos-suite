-- ============================================================
-- Full SOP content for all 8 service types
-- ============================================================

INSERT INTO public.sop_guides (service_type, task_template_name, title, content, video_url) VALUES

-- ─────────────────────────────────────────────────────────────
-- 1. BACKLINKS
-- ─────────────────────────────────────────────────────────────
('backlinks', 'link_building', 'How to Build Quality Backlinks',
'## Goal
Build high-quality, relevant backlinks that move the needle on domain authority and organic rankings. Quality always beats quantity — one DA 60 link is worth more than 20 DA 15 links.

## What counts as a quality backlink?
- Domain Authority (DA) 30 or above
- Topically relevant to the client niche
- DoFollow (passes link equity)
- Placed naturally within the body of an article — not in a footer or sidebar
- From a site with real organic traffic (check Ahrefs or SimilarWeb)

## Step-by-step process

### 1. Research prospects
- Google: `[niche] + "write for us"` or `[niche] + "guest post guidelines"`
- Google: `[niche] + "resources"` or `[niche] + "helpful links"`
- Use Ahrefs Site Explorer → Competing domains → find who links to competitors but not to your client
- Use Ahrefs Content Explorer to find recently published articles in the niche

### 2. Qualify every site before outreach
- Install MozBar Chrome extension — check DA on each site
- **Minimum DA: 30** (DA 50+ is excellent, log these separately)
- Check the site has blog content updated in the last 6 months
- Check Ahrefs for organic traffic — at least 500 visits/month
- Avoid: private blog networks (PBNs), link farms, irrelevant niches

### 3. Write the outreach email
- Personalise the opening line — mention a specific article they published
- Offer a unique, valuable article topic (not something they already have)
- Keep it under 150 words — be direct
- Use your work email, not Gmail
- Subject line: `Guest post idea for [their site name]`

### 4. Follow up
- Wait 5 business days before following up
- Send one follow-up only — if no reply, move on
- Keep a prospect log in the deliverables form with status: Contacted / Replied / Declined / Won

### 5. Place and verify the link
- Once approved, write or review the article
- **Anchor text rules:** Max 20% exact match. Use branded ("ClientBrand.com"), natural ("this guide"), or partial match anchors for the rest
- After publishing: check the link is live, is DoFollow (right-click → inspect or use MozBar), and points to the correct target URL
- If the link is nofollow or missing, email the site immediately

### 6. Log in the deliverables form
Every single link must be logged with:
- Source URL (where the link appears)
- Target URL (client page being linked to)
- DA of the source site
- Anchor text used
- Date built
- Status: Live / Pending / Rejected

## Quality standards
| Rating | DA | Traffic | Relevance |
|--------|-----|---------|-----------|
| ⭐⭐⭐ Excellent | 50+ | 10k+/mo | Exact niche |
| ⭐⭐ Good | 35–50 | 1k+/mo | Related niche |
| ⭐ Acceptable | 25–35 | 500+/mo | Broad industry |
| ❌ Reject | Under 25 | Under 500/mo | Any |

## Common mistakes to avoid
- **Never** buy links — Google penalises this
- **Never** use the same anchor text more than 3 times
- **Never** build more than 5 links from the same domain per client
- **Never** log a link as "live" before manually verifying it
- Always disclose guest post relationships if the site requires it

## Tools you need
- **MozBar** (Chrome extension) — check DA/PA instantly
- **Ahrefs** — competitor backlink analysis, prospecting
- **Hunter.io** — find contact emails for sites
- **BuzzStream** — manage outreach at scale (optional)',
'https://www.youtube.com/watch?v=mk2YM9uFwbA'),

-- ─────────────────────────────────────────────────────────────
-- 2. CONTENT WRITING
-- ─────────────────────────────────────────────────────────────
('content_writing', 'article_writing', 'How to Write SEO-Optimised Articles',
'## Goal
Write articles that rank on page 1 of Google for the target keyword, satisfy the reader''s search intent fully, and generate organic traffic month after month.

## Before you write anything — research first

### 1. Confirm the target keyword
- Agree the primary keyword with the manager before starting
- Check monthly search volume in Ahrefs Keywords Explorer or Google Keyword Planner
- Confirm keyword difficulty (KD) — aim for KD under 40 for new sites
- Identify search intent: Is the reader looking for information, a comparison, a how-to guide, or a product?

### 2. Analyse the top 10 results
- Google the keyword in an incognito window
- Open the top 5 results — note: article length, headings used, questions answered, media included
- Use the "People Also Ask" section for sub-topics to cover
- Your article must cover everything the top articles cover, plus add something unique

### 3. Plan the article structure
Use this framework:
```
H1: [Keyword] — [Benefit or Promise]
H2: What is [topic]?
H2: [Main benefit or angle 1]
  H3: Sub-point
  H3: Sub-point
H2: [Main benefit or angle 2]
H2: [Common mistakes / things to avoid]
H2: FAQs
H2: Conclusion / Next steps
```

## Writing the article

### Word count
- Check the average word count of the top 3 results
- Match or slightly exceed it — do not pad with fluff
- Quality over length: a well-written 1,200-word article beats a padded 3,000-word one

### On-page SEO as you write
- **Title tag (H1):** Include the exact keyword, keep under 60 characters
- **Meta description:** 120–155 characters, include keyword, write a compelling reason to click
- **First 100 words:** Use the primary keyword naturally in the opening paragraph
- **Subheadings (H2/H3):** Use related keywords and questions naturally in subheadings
- **Image alt text:** Describe the image and include relevant keywords where natural
- **Internal links:** Link to at least 2–3 other relevant pages on the client''s site
- **External links:** Link to 1–2 authoritative sources (government sites, research papers, major publications)

### Writing quality standards
- Write for the reader first, search engines second
- Use short paragraphs (2–3 sentences max)
- Use bullet points and numbered lists for steps and comparisons
- Avoid passive voice — be direct and active
- Define jargon or technical terms the first time they appear
- Every article must have a clear call-to-action at the end

## After writing — review checklist
- [ ] Primary keyword in H1, first paragraph, and at least 2 H2s
- [ ] Meta title under 60 characters
- [ ] Meta description 120–155 characters
- [ ] At least 2 internal links added
- [ ] All images have descriptive alt text
- [ ] No spelling or grammar errors (run through Grammarly)
- [ ] Fact-checked: all statistics have a source link
- [ ] Article published and URL confirmed live
- [ ] URL submitted to Google Search Console for indexing

## After publishing
1. Log the article URL in the deliverables form immediately
2. Share the URL with the client for their review
3. Submit the URL in Google Search Console (URL Inspection → Request Indexing)
4. Add internal links from other relevant pages on the site pointing to this new article
5. Monitor rankings in the next monthly keyword report

## Tools
- **Surfer SEO** — content optimisation score (optional but recommended)
- **Grammarly** — grammar and readability check
- **Hemingway Editor** — readability (aim for Grade 8 or lower)
- **Google Keyword Planner / Ahrefs** — keyword research
- **Google Search Console** — submit for indexing, monitor rankings',
'https://www.youtube.com/watch?v=h35eQWhD3uI'),

-- ─────────────────────────────────────────────────────────────
-- 3. ON-PAGE SEO
-- ─────────────────────────────────────────────────────────────
('onpage_seo', 'onpage_audit', 'How to Optimise On-Page SEO',
'## Goal
Ensure every key page on the client site is fully optimised for its target keyword so Google can understand, index, and rank it correctly.

## Monthly on-page SEO workflow

### 1. Identify priority pages
- Pull a list of pages from Google Search Console → Performance
- Sort by **Impressions** (high impressions, low CTR = needs title/meta work)
- Sort by **Position** (positions 5–15 = in striking distance for page 1)
- Focus on the top 5–10 pages that have the most potential to move

### 2. Optimise title tags and meta descriptions
**Title tag rules:**
- Include the primary keyword near the start
- Keep under 60 characters (or ~580px — check with serpsim.com)
- Add a power word or benefit: "Complete Guide", "In 2025", "Step-by-Step"
- Format: `Primary Keyword — Secondary Benefit | Brand Name`

**Meta description rules:**
- 120–155 characters
- Include the primary keyword naturally
- Write a compelling reason to click — treat it like an ad
- Include a soft call-to-action: "Learn how", "Find out", "Get started"

### 3. Optimise heading structure
- Every page must have exactly **one H1** that includes the primary keyword
- H2s should cover the main subtopics and use related keywords naturally
- H3s break down H2 sections — use long-tail variations
- Never skip heading levels (H1 → H3 without an H2)

### 4. Optimise body content
- Primary keyword in the **first 100 words** of the page
- Use **LSI keywords** (related terms): find them in "People Also Ask" and the bottom of Google search results
- Aim for keyword density of 1–2% — not higher (keyword stuffing hurts rankings)
- Add or improve internal links: every page should link to at least 2–3 other relevant pages

### 5. Optimise images
- Every image needs a descriptive alt text that includes keywords where natural
- Compress images to under 150KB (use TinyPNG or Squoosh)
- Use descriptive file names (e.g., `london-seo-agency.jpg` not `IMG_4521.jpg`)
- Add captions where relevant — Google reads these

### 6. Check URL structure
- URLs should be short, lowercase, and use hyphens (not underscores)
- Include the primary keyword in the URL
- Remove stop words (a, the, of, in) from URLs
- Example: `/seo-services-london/` not `/our-seo-services-in-london-2024/`

### 7. Page speed and Core Web Vitals
- Run Google PageSpeed Insights — target 80+ on mobile
- Check Core Web Vitals in Search Console — fix any "Poor" flags
- Common fixes: compress images, remove unused JavaScript, enable browser caching

### 8. Schema markup
- Add FAQ schema to pages with a Q&A section (boosts rich snippets)
- Add LocalBusiness schema to location pages
- Test schema with Google''s Rich Results Test tool

## After completing optimisations
1. Log all pages optimised in the deliverables form
2. Note keyword ranking for each page before changes (for comparison next month)
3. Submit updated URLs in Google Search Console for re-indexing
4. Document all changes made for the client report

## Tools
- **Google Search Console** — performance data, indexing
- **Screaming Frog** — crawl all on-page elements at scale
- **Ahrefs** — keyword tracking, competitor comparison
- **serpsim.com** — preview title tag and meta description in SERP
- **TinyPNG** — compress images
- **Google Rich Results Test** — validate schema markup',
'https://www.youtube.com/watch?v=IkmhIqj6RaI'),

-- ─────────────────────────────────────────────────────────────
-- 4. TECHNICAL SEO
-- ─────────────────────────────────────────────────────────────
('technical_seo', 'technical_audit', 'How to Run a Technical SEO Audit',
'## Goal
Find and fix all technical issues that prevent Google from crawling, indexing, and ranking the client''s site correctly. Technical SEO is the foundation — nothing else works well if the technical base is broken.

## Monthly technical SEO workflow

### 1. Crawl the site with Screaming Frog
- Set Screaming Frog to crawl up to 500 URLs (free plan) or unlimited (paid)
- Wait for crawl to complete — do not interrupt
- Export the full report to a spreadsheet

**Priority issues to find and fix:**
| Issue | Priority | How to find |
|-------|----------|-------------|
| 4xx broken links (404 errors) | 🔴 Critical | Screaming Frog → Response Codes → 4xx |
| 5xx server errors | 🔴 Critical | Screaming Frog → Response Codes → 5xx |
| Redirect chains (3+ hops) | 🔴 Critical | Screaming Frog → Redirects → Redirect Chains |
| Duplicate title tags | 🟡 High | Screaming Frog → Page Titles → Duplicate |
| Missing title tags | 🟡 High | Screaming Frog → Page Titles → Missing |
| Duplicate meta descriptions | 🟡 High | Screaming Frog → Meta Description → Duplicate |
| Missing H1 | 🟡 High | Screaming Frog → H1 → Missing |
| Images over 200KB | 🟠 Medium | Screaming Frog → Images → Over 200KB |
| Non-HTTPS pages | 🔴 Critical | Screaming Frog → Security |

### 2. Check Google Search Console
- **Coverage report:** Fix all Errors first, then Warnings
- Common errors: Submitted URL not found (404), Redirect error, Soft 404
- **Core Web Vitals report:** Fix all pages marked "Poor" — focus on mobile
- **Manual Actions:** Check for any Google penalties (these are rare but critical)

### 3. Check page speed
- Run **Google PageSpeed Insights** on the 5 most important pages
- Run on both mobile and desktop
- **Target score: 80+ on mobile**
- Document current scores in the deliverables form — compare month to month

**Most common speed fixes:**
- Compress images (TinyPNG, Squoosh)
- Enable lazy loading on images
- Remove unused JavaScript and CSS (check with Coverage tool in Chrome DevTools)
- Enable browser caching (set via .htaccess or Cloudflare)
- Use a CDN (Cloudflare free plan works well)

### 4. Check Core Web Vitals
- **LCP (Largest Contentful Paint):** Should be under 2.5 seconds. Usually caused by large images or slow server.
- **FID / INP (Interaction to Next Paint):** Should be under 200ms. Usually caused by heavy JavaScript.
- **CLS (Cumulative Layout Shift):** Should be under 0.1. Usually caused by images without defined dimensions or late-loading ads.

### 5. Check XML sitemap
- Visit `clientsite.com/sitemap.xml` — it must load and list key pages
- Check sitemap is submitted in Google Search Console → Sitemaps
- Remove any 404 or noindex pages from the sitemap
- If using WordPress: Yoast SEO auto-generates and maintains the sitemap

### 6. Check robots.txt
- Visit `clientsite.com/robots.txt` — it must load
- Ensure it is NOT blocking important pages or the entire site
- Common mistake: staging sites with `Disallow: /` accidentally pushed to live
- Ensure the sitemap is referenced in robots.txt

### 7. Check internal linking and crawl depth
- Key pages should be reachable within 3 clicks from the homepage
- Orphan pages (no internal links pointing to them) will not rank — find and link to them
- Use Screaming Frog → Crawl Analysis → Orphan Pages

### 8. Check HTTPS and security
- Every page must load on HTTPS — no mixed content warnings
- SSL certificate must be valid and not expiring within 30 days
- Check with SSL Labs: ssllabs.com/ssltest

## After the audit
1. Create a priority list: Critical → High → Medium → Low
2. Fix all Critical issues in the current month
3. Log page speed scores and issues fixed in deliverables form
4. Document all changes made for the client report
5. Submit all fixed/updated URLs to Google Search Console for re-indexing

## Tools
- **Screaming Frog** (free up to 500 URLs) — crawl all on-page elements
- **Google Search Console** — coverage, Core Web Vitals, manual actions
- **Google PageSpeed Insights** — speed scores
- **SSL Labs** (ssllabs.com) — SSL certificate check
- **TinyPNG / Squoosh** — image compression
- **Ahrefs Site Audit** — comprehensive alternative to Screaming Frog',
'https://www.youtube.com/watch?v=SnxeXZpZkI0'),

-- ─────────────────────────────────────────────────────────────
-- 5. GOOGLE ADS
-- ─────────────────────────────────────────────────────────────
('google_ads', 'campaign_review', 'How to Manage and Review Google Ads',
'## Goal
Maximise ROI from the client''s Google Ads spend by ensuring campaigns are targeting the right people, converting efficiently, and hitting the agreed KPIs (CPA or ROAS targets).

## Before you start each month
- Log in to Google Ads — confirm you have MCC (manager) access
- Note the client''s KPI targets: target CPA, target ROAS, monthly budget
- Pull last month''s performance report to compare against

## Monthly Google Ads review workflow

### 1. Review top-level performance
Compare this month vs last month and vs targets:
- Impressions, Clicks, CTR
- Average CPC
- Conversions and Conversion Rate
- Cost per Conversion (CPA)
- ROAS (Revenue / Ad Spend)

If ROAS is below target: prioritise pausing underperforming keywords and improving landing pages.

### 2. Search terms report — most important task
- Go to: Keywords → Search Terms
- Filter for the last 30 days
- **Add irrelevant terms as negatives** — this is the highest-impact action you can take
- **Add high-performing search terms as exact match keywords** in their own ad groups
- Check for: competitor brand terms (exclude unless running competitor campaigns), irrelevant locations, job seekers (add "jobs", "careers", "salary" as negatives for lead gen clients)

### 3. Quality Score review
- Go to: Keywords → Columns → Add "Quality Score"
- **Target: Quality Score 7+** for all active keywords
- Keywords with QS under 5: improve the ad copy relevance and/or landing page
- Low QS increases CPC — fixing it can reduce cost without losing volume

### 4. Budget pacing
- Check: Is the budget being spent evenly throughout the month?
- Underspending (< 90% of budget used): increase bids or expand keyword targeting
- Overspending or hitting daily limits: add a budget cap or reduce bids on low-value keywords
- Check if Google is using "Optimised" delivery — switch to "Standard" if you want even pacing

### 5. Ad copy performance
- Pause ads with CTR under 2% (for search campaigns)
- Test one new RSA (Responsive Search Ad) variant per ad group per month
- Pin the highest-performing headlines in position 1 and 2
- Ensure all ads have at least 2 active sitelink extensions, callout extensions, and structured snippets

### 6. Bidding strategy review
- Target CPA: use if conversion volume is 30+/month in the campaign
- Target ROAS: use if ecommerce client with clear revenue data
- Maximise Conversions: good for starting out or low-conversion campaigns
- Enhanced CPC: use as a step between manual and smart bidding
- Manual CPC: only use if you want full control and have time to manage bids daily

### 7. Audience and device performance
- Check device breakdown: if mobile has CPA 2x desktop, add a -20% mobile bid adjustment
- Review audience performance under "Audiences" tab — add bid adjustments for high-converting audiences
- Check geographic performance — bid down on locations with poor conversion rates

### 8. Landing page review
- Check landing page conversion rate in Google Analytics or the ads conversion tracking
- Target conversion rate: 5%+ for lead gen, 2%+ for ecommerce
- If conversion rate is low: review page speed, form length, trust signals, and headline relevance

## Monthly reporting checklist
- [ ] ROAS or CPA this month vs target
- [ ] Budget utilisation (% of budget spent)
- [ ] New negative keywords added
- [ ] New ad variants tested
- [ ] Quality Score improvements made
- [ ] Top 3 performing keywords this month
- [ ] Top 3 worst performing keywords (paused or adjusted)
- [ ] Recommendation for next month

## Tools
- **Google Ads Editor** — bulk changes offline
- **Google Analytics 4** — conversion data, user behaviour
- **Google Merchant Center** — for Shopping campaigns
- **Optmyzr** — automated optimisation recommendations (optional)
- **Keywords Everywhere** — quick search volume checks',
'https://www.youtube.com/watch?v=xoVqvSKpHb8'),

-- ─────────────────────────────────────────────────────────────
-- 6. META ADS
-- ─────────────────────────────────────────────────────────────
('meta_ads', 'campaign_review', 'How to Manage and Review Meta Ads',
'## Goal
Generate leads or sales efficiently from Facebook and Instagram ads by testing creatives systematically, managing audience fatigue, and hitting the client''s target ROAS or CPL.

## Campaign structure — the right way
Use the **CBO (Campaign Budget Optimisation)** structure:
```
Campaign (budget here)
  └── Ad Set 1: Broad audience / Interest targeting
  └── Ad Set 2: Lookalike audience (1–3% from customer list)
  └── Ad Set 3: Retargeting (website visitors, engaged users)
      └── Ad 1: Static image
      └── Ad 2: Video (15–30 sec)
      └── Ad 3: Carousel
```

## Monthly Meta Ads review workflow

### 1. Review top-level performance
- ROAS vs target
- CPL (Cost Per Lead) vs target
- CPM (Cost Per 1,000 Impressions) — rising CPM = more competition or creative fatigue
- CTR (Link Click-Through Rate) — healthy is 1–3% for cold audiences
- Landing page conversion rate

### 2. Check for creative fatigue — most important
- Go to Ads Manager → Columns → Add "Frequency"
- **Frequency over 3.0 = ad fatigue.** Audiences are seeing the same ad too many times.
- Action: Pause fatigued ads, refresh creatives, or expand the audience
- Check: "Relevance Score" (or the three quality rankings) — should be Above Average

**Signs of creative fatigue:**
- CTR dropping week over week
- CPC increasing
- Frequency above 3.0
- Negative comments on the ad ("I keep seeing this ad")

### 3. Audience health check
- Go to Ad Sets → check Audience Size — too narrow (<100k) limits delivery
- Check audience overlap between ad sets (Tools → Audience Overlap) — overlap above 30% cannibalises performance
- Refresh lookalike audiences monthly — upload a new customer list if available

### 4. Creative performance analysis
- Sort ads by ROAS (or CPL) — identify clear winners and losers
- **Winners:** Scale budget on these ad sets by 20% every 3–4 days (avoid large jumps that reset the learning phase)
- **Losers:** Pause any ad that has spent 3x the target CPA/CPL with zero conversions

### 5. Check the Meta Pixel
- Go to Events Manager — verify all key events are firing correctly
- Check: PageView, ViewContent, AddToCart (ecomm), Lead (lead gen), Purchase (ecomm)
- Use Meta Pixel Helper Chrome extension on the live website to verify
- Missing pixel events = bidding algorithm flying blind

### 6. Retargeting campaigns
- Ensure retargeting is running for: all website visitors (30 days), video viewers (75%+ watched), engaged Instagram/Facebook followers
- Retargeting CPA should be 3–5x better than cold audiences — if not, check the ad creative and offer
- Exclude recent converters (last 30 days) from all campaigns

### 7. Budget and bidding
- Use CBO (Campaign Budget Optimisation) for most campaigns — Meta''s algorithm distributes budget to best-performing ad sets
- Use ABO (Ad Set Budget Optimisation) when testing new creatives — gives equal spend to each variant
- Avoid touching budgets or turning campaigns off and on — this resets the learning phase (needs 50 conversion events to exit)
- Learning phase takes 1–2 weeks — do not make major changes during this period

## Creative best practices
- **Video ads:** 15–30 seconds, hook in the first 3 seconds, subtitles always on, square (1:1) or vertical (4:5) format
- **Image ads:** Bold headline text overlay (40% text rule is no longer enforced but less text still performs better), high contrast, faces perform well
- **Carousel ads:** Each card should tell part of a story or showcase different products/benefits
- **Copy:** Lead with the pain point or benefit in the first line (this appears before "See more")

## Monthly reporting checklist
- [ ] ROAS or CPL vs target
- [ ] Creatives paused due to fatigue
- [ ] New creatives launched and performance
- [ ] Audience changes made
- [ ] Pixel verified and firing correctly
- [ ] Recommendations for next month

## Tools
- **Meta Business Suite / Ads Manager** — campaign management
- **Meta Pixel Helper** (Chrome extension) — verify pixel events
- **Canva / Adobe Express** — create ad creatives
- **AdEspresso** — A/B testing at scale (optional)
- **Facebook Ad Library** — competitor ad research (ads.facebook.com/ads/library)',
'https://www.youtube.com/watch?v=ABsGVRfkuqY'),

-- ─────────────────────────────────────────────────────────────
-- 7. SOCIAL MEDIA
-- ─────────────────────────────────────────────────────────────
('social_media', 'monthly_posts', 'How to Manage Monthly Social Media',
'## Goal
Build the client''s brand presence, grow their audience, and drive engagement consistently through a planned, high-quality content calendar.

## Monthly content planning workflow

### 1. Plan the content calendar (by the 5th of each month)
- Meet or check in with the client to confirm any promotions, events, or news this month
- Create a content calendar in a shared spreadsheet or Notion page
- Plan the **content mix** — a healthy ratio is:
  - 40% Educational / value-add content
  - 30% Brand / behind-the-scenes / team content
  - 20% Promotional / offer content
  - 10% User-generated content or resharing

### 2. Get client approval before creating anything
- Share the content calendar (topics + captions + hashtag strategy) with the client
- Allow 48 hours for feedback
- Do not start creating until approved — saves rework time
- Track approval status in the task comment thread

### 3. Platform-specific image dimensions
| Platform | Post type | Recommended size |
|----------|-----------|-----------------|
| Instagram | Square post | 1080 x 1080 px |
| Instagram | Portrait post | 1080 x 1350 px |
| Instagram | Story / Reel cover | 1080 x 1920 px |
| Facebook | Feed post | 1200 x 630 px |
| Facebook | Story | 1080 x 1920 px |
| LinkedIn | Post image | 1200 x 627 px |
| TikTok | Video | 1080 x 1920 px (9:16) |
| Twitter/X | Post image | 1600 x 900 px |
| YouTube | Thumbnail | 1280 x 720 px |

### 4. Caption writing guidelines
- **First line is critical** — it must stop the scroll. Ask a question, share a surprising fact, or make a bold statement.
- Write for the platform: LinkedIn = professional and longer, Instagram = casual and punchy, Twitter/X = sharp and short
- Include a clear call-to-action (CTA): "Save this for later", "Tag someone who needs this", "Link in bio"
- Proofread every caption — one typo damages brand credibility
- Emojis: use 3–5 maximum, and only where they add meaning

### 5. Hashtag strategy
- **Instagram:** Use 5–10 hashtags — mix of niche (under 500k posts), medium (500k–2M), and broad (2M+)
- **LinkedIn:** Use 3–5 relevant industry hashtags — overly promotional hashtags reduce reach
- **TikTok:** Use 3–5 trending and niche hashtags — check TikTok Discover for trends
- **Facebook:** 1–2 hashtags maximum — hashtags have minimal impact on Facebook
- Create a saved hashtag set per client — rotate between 3 sets to avoid repetition

### 6. Scheduling posts
- Use a scheduling tool: Buffer, Hootsuite, Later, or Meta Business Suite (for Facebook/Instagram only)
- Post at **optimal times** (check your client''s analytics for their audience''s active hours):
  - Instagram: Tuesday–Friday, 9–11am or 6–8pm
  - LinkedIn: Tuesday–Thursday, 8–10am or 12–1pm
  - Facebook: Wednesday–Friday, 1–3pm
  - TikTok: Tuesday, Thursday, Friday — 7–9pm
- Schedule all posts at least 3 days before they go live

### 7. Monitor and engage (ongoing — not just once a month)
- Check notifications daily — reply to all comments within 24 hours
- Like and respond to DMs within the same day
- Engage with 10–15 posts from relevant accounts every day (increases organic reach)
- Monitor hashtags the client uses — engage with others using the same hashtags

### 8. End-of-month: log results
For every post published, log in the deliverables form:
- Platform
- Post URL
- Post type (image, video, carousel, reel, story)
- Publish date
- Reach, Likes, Comments

## Monthly reporting metrics
- Total posts published vs target
- Total reach across all platforms
- Top 3 performing posts (by reach or engagement)
- Follower growth (start vs end of month)
- Average engagement rate = (Likes + Comments + Shares) / Reach × 100
- Benchmark: 1–3% engagement rate is average, 3–6% is good, 6%+ is excellent

## Tools
- **Buffer / Hootsuite / Later** — scheduling
- **Canva** — create graphics quickly
- **CapCut** — video editing for Reels and TikToks
- **Meta Business Suite** — Facebook and Instagram analytics (free)
- **Sprout Social / Iconosquare** — advanced analytics (paid)
- **TikTok Discover** — trending sounds and hashtags',
'https://www.youtube.com/watch?v=WKsMCFv6vJg'),

-- ─────────────────────────────────────────────────────────────
-- 8. WEB DEVELOPMENT
-- ─────────────────────────────────────────────────────────────
('web_dev', 'new_project', 'How to Deliver a Web Development Project',
'## Goal
Deliver a fast, responsive, accessible website on time and on brief — with the client fully signed off at every stage before progressing to the next.

## Project phases and sign-off gates

### Phase 1: Brief and discovery (Week 1)
**Never start designing without a complete brief.**
- [ ] Collect all brand assets from client: logo (SVG/PNG), fonts, brand colours (hex codes), photography
- [ ] Confirm the full sitemap: list every page that needs to be built
- [ ] Get existing hosting details: domain registrar, hosting provider, login credentials
- [ ] Confirm tech stack: WordPress, Webflow, Shopify, custom build?
- [ ] Agree on the content source: will client provide copy or do we write it?
- [ ] Set up a staging environment before touching the live site
- **Client sign-off required before Phase 2**

### Phase 2: Design (Week 2)
- Build wireframes or mockups in Figma for at least: Homepage, main inner page, Contact page
- Present designs using Figma''s share link — do not send PDFs (hard to comment on)
- Allow one round of revisions per design stage
- Get written approval (email or comment in Figma) before development starts
- Check designs on mobile — 65%+ of web traffic is mobile
- **Client sign-off required before Phase 3**

### Phase 3: Development (Weeks 3–5)
- Build on staging only — never build directly on a live site
- **Development checklist:**
  - [ ] All pages match the approved design
  - [ ] Mobile-responsive on all breakpoints (375px, 768px, 1440px minimum)
  - [ ] All forms tested and submitting to the correct email
  - [ ] All links working (internal and external)
  - [ ] Google Analytics 4 or Tag Manager installed and tracking
  - [ ] SSL certificate active (HTTPS)
  - [ ] Favicon set
  - [ ] 404 page customised
  - [ ] Cookie consent banner installed (GDPR requirement)

### Phase 4: Testing (Week 5)
Test across all major browsers and devices before showing the client:

**Browser testing:**
- Google Chrome (most used)
- Safari (iOS and Mac — often has different rendering)
- Firefox
- Edge

**Device testing:**
- Desktop (1440px)
- Tablet (768px)
- Mobile — iOS Safari and Android Chrome

**Performance testing:**
- Run Google PageSpeed Insights — target 80+ on mobile
- Run GTmetrix — target Grade B or above
- Check all images are compressed (under 150KB each)

**Accessibility testing:**
- Check colour contrast meets WCAG AA standards (use Colour Contrast Checker)
- Ensure all images have alt text
- Check the site is keyboard-navigable (Tab key through all interactive elements)

### Phase 5: Client review and revisions
- Share the staging URL with the client
- Allow 5 business days for feedback
- Limit revisions to changes within the agreed scope — use a change request process for out-of-scope work
- Keep all revision notes in the task comment thread for a clear audit trail
- **Client sign-off on staging required before going live**

### Phase 6: Go live
- [ ] Take a full backup of any existing site before making changes
- [ ] Point the domain to the new hosting (DNS propagation can take 24–48 hours — warn the client)
- [ ] Verify HTTPS is working on the live domain
- [ ] Test all forms again on the live domain (form submissions sometimes break after domain change)
- [ ] Submit sitemap in Google Search Console for the live domain
- [ ] Remove any "Coming Soon" or maintenance mode page
- [ ] Test all pages one final time on the live domain
- [ ] Handover document: provide client with login credentials, hosting details, and a basic how-to guide

## Post-launch (Week after go-live)
- Monitor Google Search Console for crawl errors on the new site
- Confirm all pages are being indexed correctly
- Check Google Analytics is receiving traffic data
- Send the client a launch report: pages built, performance scores, analytics setup confirmation
- Schedule a 2-week check-in to address any issues

## Common mistakes to avoid
- **Never** push changes directly to a live site — always use staging
- **Never** start development before getting written design approval
- **Never** go live without testing on Safari/iOS (it has different CSS behaviour)
- **Always** get client sign-off in writing at each phase gate
- **Always** take a backup before making any live changes

## Tools
- **Figma** — design and prototyping
- **Local by Flywheel / DevKinsta** — local WordPress development
- **Google PageSpeed Insights** — performance testing
- **GTmetrix** — detailed performance report
- **BrowserStack** — cross-browser and device testing (paid, worth it)
- **Google Search Console** — indexing and crawl monitoring
- **UpdraftPlus** — WordPress backup plugin',
'https://www.youtube.com/watch?v=UB1O30fR-EE')

ON CONFLICT (service_type, task_template_name) DO UPDATE SET
  title     = EXCLUDED.title,
  content   = EXCLUDED.content,
  video_url = EXCLUDED.video_url,
  updated_at = now();

NOTIFY pgrst, 'reload schema';
