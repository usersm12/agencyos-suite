-- ============================================================
-- Task INSERT / UPDATE policies still referenced project_id to
-- derive the client. Now that tasks use client_id directly and
-- project_id is NULL on new tasks, those policies always fail.
-- Drop and recreate them using client_id.
-- ============================================================

-- ── DROP old project-based policies ──────────────────────────
DROP POLICY IF EXISTS "Managers can insert tasks for assigned clients" ON public.tasks;
DROP POLICY IF EXISTS "Managers can update tasks for assigned clients" ON public.tasks;

-- Also drop the old view policies that go through projects
-- (kept for safety — they would still work for old tasks with project_id,
--  but we replace them with cleaner client_id-based versions)
DROP POLICY IF EXISTS "Managers can view tasks for assigned clients" ON public.tasks;

-- ── Recreate using client_id ──────────────────────────────────
CREATE POLICY "Managers can view tasks for assigned clients"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    public.is_assigned_to_client(auth.uid(), client_id)
  );

CREATE POLICY "Managers can insert tasks for assigned clients"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.is_assigned_to_client(auth.uid(), client_id)
  );

CREATE POLICY "Managers can update tasks for assigned clients"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    public.is_assigned_to_client(auth.uid(), client_id)
  );
