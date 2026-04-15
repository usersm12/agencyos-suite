-- ============ EXTEND BACKLINK_LOG ============
ALTER TABLE public.backlink_log
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS target_url TEXT,
  ADD COLUMN IF NOT EXISTS is_dofollow BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS date_built DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Copy existing url to source_url for backward compat
UPDATE public.backlink_log SET source_url = url WHERE source_url IS NULL AND url IS NOT NULL;

-- Drop old status constraint and add new one that includes both old and new values
ALTER TABLE public.backlink_log DROP CONSTRAINT IF EXISTS backlink_log_status_check;
ALTER TABLE public.backlink_log ADD CONSTRAINT backlink_log_status_check
  CHECK (status IN ('live', 'pending', 'rejected', 'active', 'lost'));

-- Update default to 'live'
ALTER TABLE public.backlink_log ALTER COLUMN status SET DEFAULT 'live';

-- ============ SOCIAL POSTS ============
CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'twitter', 'linkedin', 'tiktok', 'youtube', 'pinterest')),
  post_type TEXT NOT NULL DEFAULT 'post' CHECK (post_type IN ('post', 'reel', 'story', 'video', 'carousel')),
  caption TEXT,
  post_url TEXT,
  posted_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'cancelled')),
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  engagement_rate NUMERIC,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_social_posts_updated_at
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Owners can view all social posts" ON public.social_posts
  FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));

CREATE POLICY "Managers can view assigned social posts" ON public.social_posts
  FOR SELECT TO authenticated USING (public.is_assigned_to_client(auth.uid(), client_id));

CREATE POLICY "Owners can manage social posts" ON public.social_posts
  FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Managers can insert social posts" ON public.social_posts
  FOR INSERT TO authenticated WITH CHECK (public.is_assigned_to_client(auth.uid(), client_id));

CREATE POLICY "Owners can update social posts" ON public.social_posts
  FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()));

CREATE POLICY "Managers can update social posts" ON public.social_posts
  FOR UPDATE TO authenticated USING (public.is_assigned_to_client(auth.uid(), client_id));

CREATE POLICY "Owners can delete social posts" ON public.social_posts
  FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

CREATE POLICY "Managers can delete social posts" ON public.social_posts
  FOR DELETE TO authenticated USING (public.is_assigned_to_client(auth.uid(), client_id));
