
-- Create task_comments table
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Owners can view all comments"
  ON public.task_comments FOR SELECT
  TO authenticated
  USING (is_owner(auth.uid()));

CREATE POLICY "Managers can view comments on assigned client tasks"
  ON public.task_comments FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.id = task_comments.task_id
    AND is_assigned_to_client(auth.uid(), p.client_id)
  ));

CREATE POLICY "Team members can view comments on assigned tasks"
  ON public.task_comments FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = task_comments.task_id
    AND t.assigned_to = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
  ));

CREATE POLICY "Authenticated users can add comments"
  ON public.task_comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Users can delete their own comments"
  ON public.task_comments FOR DELETE
  TO authenticated
  USING (user_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()));

-- Timestamp trigger
CREATE TRIGGER update_task_comments_updated_at
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
