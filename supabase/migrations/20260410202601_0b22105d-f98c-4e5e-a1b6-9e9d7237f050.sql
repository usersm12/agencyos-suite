
DROP POLICY "Authenticated can insert flags" ON public.flags;
CREATE POLICY "Owners can insert flags" ON public.flags FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Managers can insert flags for assigned clients" ON public.flags FOR INSERT TO authenticated WITH CHECK (public.is_assigned_to_client(auth.uid(), client_id));
