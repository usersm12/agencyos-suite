-- Add target_count to tasks for tracking deliverable goals
-- e.g. "build 50 backlinks", "write 8 articles", "post 20 social posts"
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS target_count INTEGER;
