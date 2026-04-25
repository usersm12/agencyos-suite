-- ============================================================
-- update_project: owners + assigned managers can update
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_project(
  p_project_id  UUID,
  p_name        TEXT,
  p_description TEXT DEFAULT NULL,
  p_status      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_owner  BOOLEAN;
  v_is_assigned BOOLEAN;
  v_client_id UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Get the client_id for this project
  SELECT client_id INTO v_client_id FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Project not found');
  END IF;

  v_is_owner    := public.is_owner(v_caller_id);
  v_is_assigned := public.is_assigned_to_client(v_caller_id, v_client_id);

  IF NOT (v_is_owner OR v_is_assigned) THEN
    RETURN jsonb_build_object('error', 'Permission denied');
  END IF;

  UPDATE public.projects
  SET
    name        = p_name,
    description = COALESCE(p_description, description),
    status      = COALESCE(p_status, status),
    updated_at  = now()
  WHERE id = p_project_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_project(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- delete_project: owners ONLY
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_project(p_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF NOT public.is_owner(v_caller_id) THEN
    RETURN jsonb_build_object('error', 'Only owners can delete projects');
  END IF;

  DELETE FROM public.projects WHERE id = p_project_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_project(UUID) TO authenticated;
