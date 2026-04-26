-- ============================================================
-- get_my_role(): returns the app_role of the calling user.
-- Used by the frontend to resolve the authenticated user's role
-- independently of React context timing.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT
    FROM public.profiles
   WHERE user_id = auth.uid()
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

NOTIFY pgrst, 'reload schema';
