-- ============================================================
-- Projects: RLS SELECT policies + SECURITY DEFINER RPCs
-- ============================================================

-- 1. Ensure owners can see all projects
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects' AND policyname = 'Owners can view all projects'
  ) THEN
    CREATE POLICY "Owners can view all projects"
      ON public.projects FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid() AND p.role = 'owner'
        )
      );
  END IF;
END $$;

-- 2. Managers/team members can see projects for clients they are assigned to
-- (team_assignments.user_id references profiles.id, not auth.users.id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects' AND policyname = 'Assigned users can view client projects'
  ) THEN
    CREATE POLICY "Assigned users can view client projects"
      ON public.projects FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.team_assignments ta
          JOIN public.profiles p ON p.id = ta.user_id
          WHERE ta.client_id = projects.client_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================
-- RPC: get_all_projects — bypasses RLS for the projects dropdown
-- Returns all projects with their client name for any authenticated user
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_all_projects()
RETURNS TABLE(
  id         UUID,
  name       TEXT,
  client_id  UUID,
  client_name TEXT
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
      pr.client_id,
      c.name AS client_name
    FROM public.projects pr
    JOIN public.clients c ON c.id = pr.client_id
    ORDER BY pr.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_projects() TO authenticated;

-- ============================================================
-- RPC: get_projects_for_client — bypasses RLS for a specific client
-- Used by QuickLogButton when creating tasks
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_projects_for_client(p_client_id UUID)
RETURNS TABLE(
  id   UUID,
  name TEXT
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
    SELECT pr.id, pr.name
    FROM public.projects pr
    WHERE pr.client_id = p_client_id
    ORDER BY pr.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_projects_for_client(UUID) TO authenticated;
