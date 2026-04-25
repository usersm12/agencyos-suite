-- ============================================================
-- update_profile_by_id: extend to allow managers to edit
-- team_member profiles (name only — role stays team_member).
-- Only owners can change roles.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_profile_by_id(
  p_profile_id  UUID,
  p_full_name   TEXT,
  p_role        TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid       UUID;
  v_caller_role      public.app_role;
  v_target_role      public.app_role;
  v_target_user_id   UUID;
BEGIN
  v_caller_uid := auth.uid();

  -- Get caller's role
  SELECT role INTO v_caller_role
    FROM public.profiles WHERE user_id = v_caller_uid;

  -- Get target's user_id and current role
  SELECT user_id, role INTO v_target_user_id, v_target_role
    FROM public.profiles WHERE id = p_profile_id;

  IF v_target_user_id IS NULL THEN
    RETURN 'Profile not found';
  END IF;

  -- Allow editing own profile (any role)
  IF v_target_user_id = v_caller_uid THEN
    -- Owners can change their own role; others keep current role
    UPDATE public.profiles
    SET
      full_name  = p_full_name,
      role       = CASE WHEN v_caller_role = 'owner' THEN p_role::public.app_role ELSE v_target_role END,
      updated_at = now()
    WHERE id = p_profile_id;
    RETURN 'ok';
  END IF;

  -- Owner: can edit anyone, change any role
  IF v_caller_role = 'owner' THEN
    UPDATE public.profiles
    SET full_name = p_full_name, role = p_role::public.app_role, updated_at = now()
    WHERE id = p_profile_id;
    RETURN 'ok';
  END IF;

  -- Manager: can only edit team_members, cannot change their role
  IF v_caller_role = 'manager' THEN
    IF v_target_role != 'team_member' THEN
      RETURN 'Managers can only edit team members';
    END IF;
    UPDATE public.profiles
    SET full_name = p_full_name, role = 'team_member', updated_at = now()
    WHERE id = p_profile_id;
    RETURN 'ok';
  END IF;

  RETURN 'Unauthorized';
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_profile_by_id(UUID, TEXT, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
