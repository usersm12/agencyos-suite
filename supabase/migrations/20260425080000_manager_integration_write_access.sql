-- ============================================================
-- Managers could only SELECT from client_integrations and
-- client_integration_metrics — no INSERT/UPDATE/DELETE.
-- This meant clicking "Connect" (upsert OAuth token) and any
-- metric sync would silently fail for managers.
-- ============================================================

-- ── client_integrations ──────────────────────────────────────
CREATE POLICY "Managers can insert assigned client_integrations"
  ON public.client_integrations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_assigned_to_client(auth.uid(), client_id));

CREATE POLICY "Managers can update assigned client_integrations"
  ON public.client_integrations
  FOR UPDATE TO authenticated
  USING (public.is_assigned_to_client(auth.uid(), client_id));

CREATE POLICY "Managers can delete assigned client_integrations"
  ON public.client_integrations
  FOR DELETE TO authenticated
  USING (public.is_assigned_to_client(auth.uid(), client_id));

-- ── client_integration_metrics ───────────────────────────────
CREATE POLICY "Managers can insert assigned client_integration_metrics"
  ON public.client_integration_metrics
  FOR INSERT TO authenticated
  WITH CHECK (public.is_assigned_to_client(auth.uid(), client_id));

CREATE POLICY "Managers can update assigned client_integration_metrics"
  ON public.client_integration_metrics
  FOR UPDATE TO authenticated
  USING (public.is_assigned_to_client(auth.uid(), client_id));
