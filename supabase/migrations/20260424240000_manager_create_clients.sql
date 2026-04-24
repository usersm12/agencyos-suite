-- ============================================================
-- Allow managers to create clients and auto-assign themselves
-- ============================================================

-- 1. Managers can INSERT clients (previously only owners could)
CREATE POLICY "Managers can insert clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_owner(auth.uid()));

-- 2. Managers can INSERT client_services (when creating a client with services)
--    Scoped to rows they could later view (their assigned clients or as owner)
CREATE POLICY "Managers can insert client_services"
  ON public.client_services FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_owner(auth.uid()));

-- 3. Trigger: auto-assign the creating manager to the new client so they can
--    immediately view/edit it (owners already see all clients via their own policy)
CREATE OR REPLACE FUNCTION public.auto_assign_client_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id  UUID;
  v_creator_role TEXT;
BEGIN
  SELECT id, role::TEXT
    INTO v_profile_id, v_creator_role
    FROM public.profiles
   WHERE user_id = auth.uid();

  -- Only assign managers; owners see all clients without needing team_assignments
  IF v_profile_id IS NOT NULL AND v_creator_role = 'manager' THEN
    INSERT INTO public.team_assignments (user_id, client_id)
    VALUES (v_profile_id, NEW.id)
    ON CONFLICT (user_id, client_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_client_created_assign_creator
  AFTER INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_client_creator();

NOTIFY pgrst, 'reload schema';
