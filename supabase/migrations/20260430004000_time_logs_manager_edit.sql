-- ============================================================
-- Allow managers to edit/delete time logs on their assigned clients
-- ============================================================

-- Drop the old policies that only let owners (or log owners) edit/delete
DROP POLICY IF EXISTS "Authenticated can update own time logs" ON public.time_logs;
DROP POLICY IF EXISTS "Authenticated can delete own time logs" ON public.time_logs;

-- UPDATE: own log  OR  owner  OR  manager on assigned client
CREATE POLICY "Can update time logs"
  ON public.time_logs FOR UPDATE TO authenticated
  USING (
    -- The log belongs to the current user
    user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    -- OR the caller is an owner (sees everything)
    OR public.is_owner(auth.uid())
    -- OR the caller is a manager assigned to this client
    OR (
      (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'manager'
      AND (client_id IS NULL OR public.is_assigned_to_client(auth.uid(), client_id))
    )
  );

-- DELETE: same rules
CREATE POLICY "Can delete time logs"
  ON public.time_logs FOR DELETE TO authenticated
  USING (
    user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR public.is_owner(auth.uid())
    OR (
      (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'manager'
      AND (client_id IS NULL OR public.is_assigned_to_client(auth.uid(), client_id))
    )
  );

NOTIFY pgrst, 'reload schema';
