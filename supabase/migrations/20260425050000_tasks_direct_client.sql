-- ============================================================
-- Remove the project middle-layer from tasks.
-- Tasks now link directly to clients.
-- project_id is kept (nullable) for web-project-phases compatibility.
-- ============================================================

-- 1. Add client_id to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- 2. Backfill client_id from the existing project → client chain
UPDATE public.tasks t
SET    client_id = p.client_id
FROM   public.projects p
WHERE  t.project_id = p.id
  AND  t.client_id IS NULL;

-- 3. Make project_id nullable (was NOT NULL)
ALTER TABLE public.tasks ALTER COLUMN project_id DROP NOT NULL;

-- 4. Add RLS SELECT policy for tasks based on direct client_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tasks' AND policyname = 'Assigned users can view client tasks'
  ) THEN
    CREATE POLICY "Assigned users can view client tasks"
      ON public.tasks FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid() AND p.role = 'owner'
        )
        OR
        EXISTS (
          SELECT 1 FROM public.team_assignments ta
          JOIN public.profiles p ON p.id = ta.user_id
          WHERE ta.client_id = tasks.client_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 5. RPC: delete_client — owners only, cascades naturally via FK ON DELETE CASCADE
CREATE OR REPLACE FUNCTION public.delete_client(p_client_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF NOT public.is_owner(auth.uid()) THEN
    RETURN jsonb_build_object('error', 'Only owners can delete clients');
  END IF;

  DELETE FROM public.clients WHERE id = p_client_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_client(UUID) TO authenticated;
