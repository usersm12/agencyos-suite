-- Replace get_projects_for_client to return full project details
-- Must DROP first because the return type is changing
DROP FUNCTION IF EXISTS public.get_projects_for_client(UUID);

CREATE OR REPLACE FUNCTION public.get_projects_for_client(p_client_id UUID)
RETURNS TABLE(
  id          UUID,
  name        TEXT,
  description TEXT,
  status      TEXT,
  created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      pr.id,
      pr.name,
      pr.description,
      pr.status,
      pr.created_at
    FROM public.projects pr
    WHERE pr.client_id = p_client_id
    ORDER BY pr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_projects_for_client(UUID) TO authenticated;
