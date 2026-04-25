-- ============================================================
-- Allow team members to see clients they are assigned to via:
--   1. team_assignments (existing coverage via is_assigned_to_client)
--   2. tasks.assigned_to  ← this was missing
-- ============================================================

-- Policy: any authenticated user who has a task assigned to them
-- for a given client can SELECT that client row.
-- This fixes "No Client" appearing on tasks for team members
-- AND lets them see those clients on the Clients page.
CREATE POLICY "Task assignees can view their client"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.tasks t
        JOIN public.profiles p ON p.id = t.assigned_to
       WHERE t.client_id = clients.id
         AND p.user_id = auth.uid()
    )
  );
