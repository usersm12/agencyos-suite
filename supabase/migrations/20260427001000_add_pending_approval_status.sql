-- Add 'pending_approval' to the tasks status CHECK constraint
-- and 'pending_approval' to the subtasks status CHECK constraint.

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN (
    'pending', 'not_started', 'in_progress', 'blocked',
    'review', 'completed', 'cancelled', 'pending_approval'
  ));

-- Subtasks constraint (inline CHECK on the column, must recreate via ALTER)
ALTER TABLE public.subtasks DROP CONSTRAINT IF EXISTS subtasks_status_check;
ALTER TABLE public.subtasks
  ADD CONSTRAINT subtasks_status_check
  CHECK (status IN ('not_started', 'in_progress', 'completed', 'pending_approval'));

NOTIFY pgrst, 'reload schema';
