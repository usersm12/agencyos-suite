-- ============================================================
-- 1. Allow managers to UPDATE/DELETE tasks with no client
--    (client_id IS NULL = orphaned tasks that need fixing)
-- 2. Add DELETE policy for managers on their assigned clients' tasks
-- ============================================================

-- Drop and recreate manager UPDATE to include null-client tasks
DROP POLICY IF EXISTS "Managers can update tasks for assigned clients" ON public.tasks;
CREATE POLICY "Managers can update tasks for assigned clients"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    public.is_assigned_to_client(auth.uid(), client_id)
    OR (
      client_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles
         WHERE user_id = auth.uid()
           AND role IN ('manager', 'owner')
      )
    )
  );

-- Drop and recreate manager SELECT to include null-client tasks
DROP POLICY IF EXISTS "Managers can view tasks for assigned clients" ON public.tasks;
CREATE POLICY "Managers can view tasks for assigned clients"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    public.is_assigned_to_client(auth.uid(), client_id)
    OR (
      client_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles
         WHERE user_id = auth.uid()
           AND role IN ('manager', 'owner')
      )
    )
  );

-- Add DELETE for managers (their clients' tasks + null-client tasks)
DROP POLICY IF EXISTS "Managers can delete tasks for assigned clients" ON public.tasks;
CREATE POLICY "Managers can delete tasks for assigned clients"
  ON public.tasks FOR DELETE TO authenticated
  USING (
    public.is_assigned_to_client(auth.uid(), client_id)
    OR (
      client_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles
         WHERE user_id = auth.uid()
           AND role IN ('manager', 'owner')
      )
    )
  );
