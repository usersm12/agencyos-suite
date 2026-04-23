-- ============================================================
-- Fix 1: Ensure at least one owner exists
--        If no profile has role = 'owner', make the oldest one owner.
--        Safe to run multiple times — only acts if no owner exists.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'owner') THEN
    UPDATE public.profiles
    SET role = 'owner'
    WHERE id = (
      SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1
    );
  END IF;
END;
$$;

-- ============================================================
-- Fix 2: SECURITY DEFINER RPC for updating a profile
--        Bypasses RLS entirely. Allows:
--          - Any user to update their OWN full_name / role
--          - Owners to update ANY user's full_name / role
--        Returns the error message on failure instead of crashing.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_profile_by_id(
  p_profile_id  UUID,
  p_full_name   TEXT,
  p_role        TEXT
)
RETURNS TEXT   -- returns 'ok' on success, error message on failure
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid      UUID;
  v_target_user_id  UUID;
  v_caller_is_owner BOOLEAN;
BEGIN
  v_caller_uid := auth.uid();

  -- Get the Supabase auth.uid that owns the target profile row
  SELECT user_id INTO v_target_user_id
    FROM public.profiles WHERE id = p_profile_id;

  IF v_target_user_id IS NULL THEN
    RETURN 'Profile not found';
  END IF;

  -- Check if caller is owner
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = v_caller_uid AND role = 'owner'
  ) INTO v_caller_is_owner;

  -- Authorization check
  IF v_target_user_id != v_caller_uid AND NOT v_caller_is_owner THEN
    RETURN 'Unauthorized: only owners can edit other profiles';
  END IF;

  UPDATE public.profiles
  SET
    full_name  = p_full_name,
    role       = p_role::public.app_role,
    updated_at = now()
  WHERE id = p_profile_id;

  RETURN 'ok';
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.update_profile_by_id(UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
