-- ============================================================
-- Comment mentions — track who was @-mentioned per comment
-- ============================================================
CREATE TABLE public.comment_mentions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id         UUID REFERENCES public.task_comments(id) ON DELETE CASCADE NOT NULL,
  mentioned_user_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  seen               BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view mentions"
  ON public.comment_mentions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert mentions"
  ON public.comment_mentions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update mentions"
  ON public.comment_mentions FOR UPDATE TO authenticated USING (true);

CREATE INDEX comment_mentions_user_idx    ON public.comment_mentions (mentioned_user_id);
CREATE INDEX comment_mentions_comment_idx ON public.comment_mentions (comment_id);

-- ============================================================
-- In-app notifications
-- ============================================================
CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type        TEXT NOT NULL
                CHECK (type IN ('mention', 'task_assigned', 'subtask_assigned', 'task_overdue')),
  title       TEXT NOT NULL,
  body        TEXT,
  task_id     UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  comment_id  UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,
  seen        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX notifications_user_id_idx    ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_seen_idx       ON public.notifications (user_id, seen) WHERE seen = false;

NOTIFY pgrst, 'reload schema';
