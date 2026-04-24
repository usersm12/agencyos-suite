-- ============================================================
-- SECURITY DEFINER RPC for creating a client
-- Handles auth check, client insert, services and team-assignment
-- in one atomic call — bypasses any RLS edge cases entirely.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_client(
  p_name            TEXT,
  p_website_url     TEXT DEFAULT NULL,
  p_status          TEXT DEFAULT 'active',
  p_service_ids     UUID[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid   UUID;
  v_profile_id   UUID;
  v_role         TEXT;
  v_client_id    UUID;
  v_sid          UUID;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT id, role::TEXT
    INTO v_profile_id, v_role
    FROM public.profiles
   WHERE user_id = v_caller_uid;

  IF v_profile_id IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('error', 'Forbidden: only owners and managers can create clients');
  END IF;

  -- Insert the client
  INSERT INTO public.clients (name, website_url, status)
  VALUES (p_name, p_website_url, p_status)
  RETURNING id INTO v_client_id;

  -- Insert services
  IF array_length(p_service_ids, 1) > 0 THEN
    FOREACH v_sid IN ARRAY p_service_ids LOOP
      INSERT INTO public.client_services (client_id, service_id, is_active)
      VALUES (v_client_id, v_sid, true)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Auto-assign managers (owners see all clients already)
  IF v_role = 'manager' THEN
    INSERT INTO public.team_assignments (user_id, client_id)
    VALUES (v_profile_id, v_client_id)
    ON CONFLICT (user_id, client_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('id', v_client_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_client(TEXT, TEXT, TEXT, UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
