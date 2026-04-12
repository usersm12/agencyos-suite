-- Migration: Add task comments and expand task deliverables

CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: RLS policies would go here if required. Assuming anon/authenticated access is handled elsewhere or default allows.
alter table public.task_comments enable row level security;
create policy "Allow access to task comments" on public.task_comments for all using (true) with check (true);

ALTER TABLE public.task_deliverables 
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
