-- ============================================================
-- Fix 1: Expand tasks.status CHECK to include all UI-used values
-- ============================================================
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('pending', 'not_started', 'in_progress', 'blocked', 'review', 'completed', 'cancelled'));

-- ============================================================
-- Fix 2: Allow owners to UPDATE any profile row
--        (needed for role management and editing team member names)
-- ============================================================
DROP POLICY IF EXISTS "Owners can update any profile" ON public.profiles;
CREATE POLICY "Owners can update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_owner(auth.uid()));

-- ============================================================
-- Fix 3: Allow managers to update their OWN profile
--        (The existing "Users can update own profile" already covers this,
--         but let's make it explicit to avoid confusion)
-- ============================================================
-- Already exists: "Users can update own profile" USING (auth.uid() = user_id)

-- ============================================================
-- Fix 4: Ensure health_score and health_status columns exist
--        (were computed client-side but types reference DB columns)
-- ============================================================
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 85,
  ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'green';

-- Back-fill based on open flags (run once)
UPDATE public.clients c
  SET health_score = GREATEST(0, 100 - (
    SELECT COUNT(*) FROM public.flags f
    WHERE f.client_id = c.id AND f.status = 'open'
  ) * 15);

UPDATE public.clients c
  SET health_status = CASE
    WHEN c.health_score >= 80 THEN 'green'
    WHEN c.health_score >= 50 THEN 'amber'
    ELSE 'red'
  END;

NOTIFY pgrst, 'reload schema';
