-- Allocated / estimated time per task (stored as minutes for consistency with time_logs)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;
