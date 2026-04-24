-- ============================================================
-- SECURITY DEFINER RPC for updating a client
-- Same pattern as create_client / update_profile_by_id —
-- bypasses PostgREST plan-cache RLS issues entirely.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_client(
  p_client_id               UUID,
  p_name                    TEXT,
  p_email                   TEXT       DEFAULT NULL,
  p_phone                   TEXT       DEFAULT NULL,
  p_company                 TEXT       DEFAULT NULL,
  p_website_url             TEXT       DEFAULT NULL,
  p_industry                TEXT       DEFAULT NULL,
  p_contract_type           TEXT       DEFAULT NULL,
  p_contract_start_date     DATE       DEFAULT NULL,
  p_monthly_retainer_value  NUMERIC    DEFAULT NULL,
  p_currency                TEXT       DEFAULT 'USD',
  p_manager_id              UUID       DEFAULT NULL,
  p_status                  TEXT       DEFAULT 'active',
  p_notes                   TEXT       DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid  UUID;
  v_profile_id  UUID;
  v_role        TEXT;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT id, role::TEXT
    INTO v_profile_id, v_role
    FROM public.profiles
   WHERE user_id = v_caller_uid;

  -- Owners can edit any client; managers can edit their assigned clients
  IF v_role = 'owner' THEN
    NULL; -- allowed
  ELSIF v_role = 'manager' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.team_assignments
       WHERE user_id = v_profile_id AND client_id = p_client_id
    ) THEN
      RETURN jsonb_build_object('error', 'Forbidden: you are not assigned to this client');
    END IF;
  ELSE
    RETURN jsonb_build_object('error', 'Forbidden: insufficient permissions');
  END IF;

  UPDATE public.clients SET
    name                   = p_name,
    email                  = p_email,
    phone                  = p_phone,
    company                = p_company,
    website_url            = p_website_url,
    industry               = p_industry,
    contract_type          = p_contract_type,
    contract_start_date    = p_contract_start_date,
    monthly_retainer_value = p_monthly_retainer_value,
    currency               = COALESCE(p_currency, 'USD'),
    manager_id             = p_manager_id,
    status                 = COALESCE(p_status, 'active'),
    notes                  = p_notes,
    updated_at             = now()
  WHERE id = p_client_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_client(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DATE,NUMERIC,TEXT,UUID,TEXT,TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
