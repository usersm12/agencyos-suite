-- ============================================================
-- Team members who have tasks assigned on a client can now
-- reach that client's profile page (via migration 20260425070000).
-- They need SELECT access on the three integration tables so
-- the GSC / GA4 charts render correctly.
-- Sensitive write access (INSERT/UPDATE/DELETE) stays
-- owner + manager only.
-- ============================================================

-- ── client_credentials (read-only for task assignees) ────────
CREATE POLICY "Task assignees can view client credentials"
  ON public.client_credentials
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.tasks t
        JOIN public.profiles p ON p.id = t.assigned_to
       WHERE t.client_id = client_credentials.client_id
         AND p.user_id = auth.uid()
    )
  );

-- ── client_integrations (read-only for task assignees) ───────
CREATE POLICY "Task assignees can view client integrations"
  ON public.client_integrations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.tasks t
        JOIN public.profiles p ON p.id = t.assigned_to
       WHERE t.client_id = client_integrations.client_id
         AND p.user_id = auth.uid()
    )
  );

-- ── client_integration_metrics (read-only for task assignees)
CREATE POLICY "Task assignees can view client integration metrics"
  ON public.client_integration_metrics
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.tasks t
        JOIN public.profiles p ON p.id = t.assigned_to
       WHERE t.client_id = client_integration_metrics.client_id
         AND p.user_id = auth.uid()
    )
  );
