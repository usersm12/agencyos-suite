-- ============================================================
-- Update create_client RPC to:
--   1. Accept is_multisite flag + properties array
--   2. Always create at least one primary property after insert
--      (the migration backfilled existing clients; new clients
--       need the same treatment going forward)
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_client(
  p_name          TEXT,
  p_website_url   TEXT    DEFAULT NULL,
  p_status        TEXT    DEFAULT 'active',
  p_service_ids   UUID[]  DEFAULT '{}',
  p_is_multisite  BOOLEAN DEFAULT false,
  p_properties    JSONB   DEFAULT '[]'   -- [{name, url, property_type}]
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
  v_prop         JSONB;
  v_prop_count   INT;
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
  INSERT INTO public.clients (name, website_url, status, is_multisite)
  VALUES (p_name, p_website_url, p_status, p_is_multisite)
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

  -- ── Create properties ──────────────────────────────────────
  v_prop_count := jsonb_array_length(COALESCE(p_properties, '[]'::jsonb));

  IF p_is_multisite AND v_prop_count > 0 THEN
    -- Multisite: create all provided properties; first one is primary
    FOR v_prop IN SELECT * FROM jsonb_array_elements(p_properties)
    LOOP
      INSERT INTO public.properties (
        client_id, name, url, property_type, is_primary
      ) VALUES (
        v_client_id,
        v_prop->>'name',
        NULLIF(v_prop->>'url', ''),
        COALESCE(v_prop->>'property_type', 'website')::public.property_type,
        -- first element → is_primary
        (v_prop->>'is_primary')::boolean IS NOT DISTINCT FROM true
      );
    END LOOP;
  ELSE
    -- Single-site (or multisite with no properties provided):
    -- create one primary property from the client name + website_url
    INSERT INTO public.properties (client_id, name, url, property_type, is_primary)
    VALUES (v_client_id, p_name, p_website_url, 'website', true);
  END IF;

  RETURN jsonb_build_object('id', v_client_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_client(TEXT, TEXT, TEXT, UUID[], BOOLEAN, JSONB)
  TO authenticated;

-- ── Also: manage_client_properties RPC ───────────────────────
-- Add / edit / delete properties on an existing client.
-- Used by the Properties tab on the client profile.
CREATE OR REPLACE FUNCTION public.upsert_property(
  p_client_id     UUID,
  p_property_id   UUID    DEFAULT NULL,  -- NULL = create new
  p_name          TEXT    DEFAULT NULL,
  p_url           TEXT    DEFAULT NULL,
  p_property_type TEXT    DEFAULT 'website',
  p_is_primary    BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_caller_role public.app_role;
  v_new_id UUID;
BEGIN
  v_caller_uid := auth.uid();

  SELECT role INTO v_caller_role
    FROM public.profiles WHERE user_id = v_caller_uid;

  -- Auth check
  IF v_caller_role IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;
  IF v_caller_role = 'team_member' THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;
  IF v_caller_role = 'manager'
     AND NOT public.is_assigned_to_client(v_caller_uid, p_client_id)
  THEN
    RETURN jsonb_build_object('error', 'Not assigned to this client');
  END IF;

  -- If making this property primary, demote others
  IF p_is_primary THEN
    UPDATE public.properties
      SET is_primary = false
    WHERE client_id = p_client_id
      AND (p_property_id IS NULL OR id != p_property_id);
  END IF;

  IF p_property_id IS NULL THEN
    -- Insert
    INSERT INTO public.properties (client_id, name, url, property_type, is_primary)
    VALUES (p_client_id, p_name, NULLIF(p_url,''), p_property_type::public.property_type, p_is_primary)
    RETURNING id INTO v_new_id;
  ELSE
    -- Update
    UPDATE public.properties
    SET name          = COALESCE(p_name, name),
        url           = COALESCE(NULLIF(p_url,''), url),
        property_type = COALESCE(p_property_type::public.property_type, property_type),
        is_primary    = p_is_primary,
        updated_at    = now()
    WHERE id = p_property_id AND client_id = p_client_id;
    v_new_id := p_property_id;
  END IF;

  RETURN jsonb_build_object('id', v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_property(UUID, UUID, TEXT, TEXT, TEXT, BOOLEAN)
  TO authenticated;

-- ── delete_property RPC ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_property(p_property_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid  UUID;
  v_caller_role public.app_role;
  v_client_id   UUID;
BEGIN
  v_caller_uid := auth.uid();

  SELECT role INTO v_caller_role
    FROM public.profiles WHERE user_id = v_caller_uid;

  SELECT client_id INTO v_client_id
    FROM public.properties WHERE id = p_property_id;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Property not found');
  END IF;

  IF v_caller_role = 'team_member' THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;
  IF v_caller_role = 'manager'
     AND NOT public.is_assigned_to_client(v_caller_uid, v_client_id)
  THEN
    RETURN jsonb_build_object('error', 'Not assigned to this client');
  END IF;

  -- Prevent deleting the only property
  IF (SELECT COUNT(*) FROM public.properties WHERE client_id = v_client_id) <= 1 THEN
    RETURN jsonb_build_object('error', 'Cannot delete the only property');
  END IF;

  DELETE FROM public.properties WHERE id = p_property_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_property(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
