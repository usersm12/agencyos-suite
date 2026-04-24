-- ============================================================
-- Subtasks — child tasks under any parent task
-- ============================================================
CREATE TABLE public.subtasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_task_id  UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  title           TEXT NOT NULL,
  assigned_to     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date        DATE,
  status          TEXT NOT NULL DEFAULT 'not_started'
                    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  priority        TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high')),
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_subtasks_updated_at
  BEFORE UPDATE ON public.subtasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated can view subtasks"
  ON public.subtasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert subtasks"
  ON public.subtasks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update subtasks"
  ON public.subtasks FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete subtasks"
  ON public.subtasks FOR DELETE TO authenticated USING (true);

-- Index for fast lookup by parent task
CREATE INDEX subtasks_parent_task_id_idx ON public.subtasks (parent_task_id);
CREATE INDEX subtasks_assigned_to_idx   ON public.subtasks (assigned_to);

NOTIFY pgrst, 'reload schema';
