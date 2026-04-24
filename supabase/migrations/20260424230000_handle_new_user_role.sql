-- ============================================================
-- Update handle_new_user trigger to read role from user_metadata
-- This lets the create-user edge function pass the role at creation
-- time via user_metadata, so the SECURITY DEFINER trigger sets it
-- directly — no separate REST UPDATE (which hits RLS) is needed.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role public.app_role;
BEGIN
  -- Read role from metadata if provided, default to team_member
  BEGIN
    v_role := COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.app_role,
      'team_member'
    );
  EXCEPTION WHEN invalid_text_representation THEN
    v_role := 'team_member';
  END;

  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    v_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
