-- ============================================================
-- Approval workflow for tasks and subtasks
-- ============================================================

-- 1. Add columns to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS needs_approval   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. Add columns to subtasks
ALTER TABLE public.subtasks
  ADD COLUMN IF NOT EXISTS needs_approval   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 3. Add subtask_id to notifications (so we can link subtask approvals)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS subtask_id UUID REFERENCES public.subtasks(id) ON DELETE CASCADE;

-- 4. Expand the notifications type CHECK to include approval types
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'mention',
      'task_assigned',
      'subtask_assigned',
      'task_overdue',
      'approval_requested',
      'task_approved',
      'task_rejected',
      'subtask_approval_requested',
      'subtask_approved',
      'subtask_rejected'
    )
  );

-- ============================================================
-- RPC: request_task_approval
-- Any authenticated user can submit their task for approval.
-- Notifies: client's assigned manager + all owners.
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_task_approval(p_task_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID;
  v_task        RECORD;
BEGIN
  SELECT id INTO v_caller_id FROM profiles WHERE user_id = auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT t.id, t.title, t.client_id, t.assigned_to,
         c.manager_id, c.name AS client_name
    INTO v_task
    FROM tasks t
    LEFT JOIN clients c ON c.id = t.client_id
   WHERE t.id = p_task_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Task not found');
  END IF;

  -- Update task status
  UPDATE tasks SET status = 'pending_approval', rejection_reason = NULL
   WHERE id = p_task_id;

  -- Notify client's assigned manager (if different from submitter)
  IF v_task.manager_id IS NOT NULL AND v_task.manager_id <> v_caller_id THEN
    INSERT INTO notifications (user_id, type, title, body, task_id)
    VALUES (
      v_task.manager_id,
      'approval_requested',
      'Task awaiting your approval',
      v_task.title || ' · ' || COALESCE(v_task.client_name, 'No client'),
      p_task_id
    );
  END IF;

  -- Notify all owners (excluding the submitter and already-notified manager)
  INSERT INTO notifications (user_id, type, title, body, task_id)
  SELECT p.id,
         'approval_requested',
         'Task awaiting your approval',
         v_task.title || ' · ' || COALESCE(v_task.client_name, 'No client'),
         p_task_id
    FROM profiles p
   WHERE p.role = 'owner'
     AND p.id <> v_caller_id
     AND p.id IS DISTINCT FROM v_task.manager_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_task_approval(UUID) TO authenticated;

-- ============================================================
-- RPC: resolve_task_approval
-- Only managers/owners can approve or reject.
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_task_approval(
  p_task_id  UUID,
  p_approved BOOLEAN,
  p_reason   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller  RECORD;
  v_task    RECORD;
BEGIN
  SELECT id, role::TEXT INTO v_caller FROM profiles WHERE user_id = auth.uid();
  IF v_caller.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;
  IF v_caller.role NOT IN ('manager', 'owner') THEN
    RETURN jsonb_build_object('error', 'Forbidden: only managers and owners can approve tasks');
  END IF;

  SELECT id, title, assigned_to, client_id FROM tasks INTO v_task WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Task not found');
  END IF;

  UPDATE tasks SET
    status           = CASE WHEN p_approved THEN 'completed' ELSE 'in_progress' END,
    rejection_reason = CASE WHEN NOT p_approved THEN p_reason ELSE NULL END
  WHERE id = p_task_id;

  -- Notify the assignee (if different from reviewer)
  IF v_task.assigned_to IS NOT NULL AND v_task.assigned_to <> v_caller.id THEN
    INSERT INTO notifications (user_id, type, title, body, task_id)
    VALUES (
      v_task.assigned_to,
      CASE WHEN p_approved THEN 'task_approved' ELSE 'task_rejected' END,
      CASE WHEN p_approved THEN 'Task approved ✓' ELSE 'Task needs revision' END,
      v_task.title || CASE WHEN NOT p_approved AND p_reason IS NOT NULL THEN ' — ' || p_reason ELSE '' END,
      p_task_id
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'approved', p_approved);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_task_approval(UUID, BOOLEAN, TEXT) TO authenticated;

-- ============================================================
-- RPC: request_subtask_approval
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_subtask_approval(p_subtask_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_sub       RECORD;
BEGIN
  SELECT id INTO v_caller_id FROM profiles WHERE user_id = auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT s.id, s.title, s.parent_task_id, s.assigned_to,
         t.client_id, c.manager_id, c.name AS client_name
    INTO v_sub
    FROM subtasks s
    JOIN tasks t ON t.id = s.parent_task_id
    LEFT JOIN clients c ON c.id = t.client_id
   WHERE s.id = p_subtask_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Subtask not found');
  END IF;

  UPDATE subtasks SET status = 'pending_approval', rejection_reason = NULL
   WHERE id = p_subtask_id;

  -- Notify client's assigned manager
  IF v_sub.manager_id IS NOT NULL AND v_sub.manager_id <> v_caller_id THEN
    INSERT INTO notifications (user_id, type, title, body, task_id, subtask_id)
    VALUES (
      v_sub.manager_id,
      'subtask_approval_requested',
      'Subtask awaiting your approval',
      v_sub.title || ' · ' || COALESCE(v_sub.client_name, 'No client'),
      v_sub.parent_task_id,
      p_subtask_id
    );
  END IF;

  -- Notify all owners
  INSERT INTO notifications (user_id, type, title, body, task_id, subtask_id)
  SELECT p.id,
         'subtask_approval_requested',
         'Subtask awaiting your approval',
         v_sub.title || ' · ' || COALESCE(v_sub.client_name, 'No client'),
         v_sub.parent_task_id,
         p_subtask_id
    FROM profiles p
   WHERE p.role = 'owner'
     AND p.id <> v_caller_id
     AND p.id IS DISTINCT FROM v_sub.manager_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_subtask_approval(UUID) TO authenticated;

-- ============================================================
-- RPC: resolve_subtask_approval
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_subtask_approval(
  p_subtask_id UUID,
  p_approved   BOOLEAN,
  p_reason     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller RECORD;
  v_sub    RECORD;
BEGIN
  SELECT id, role::TEXT INTO v_caller FROM profiles WHERE user_id = auth.uid();
  IF v_caller.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;
  IF v_caller.role NOT IN ('manager', 'owner') THEN
    RETURN jsonb_build_object('error', 'Forbidden: only managers and owners can approve subtasks');
  END IF;

  SELECT s.id, s.title, s.assigned_to, s.parent_task_id
    INTO v_sub
    FROM subtasks s
   WHERE s.id = p_subtask_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Subtask not found');
  END IF;

  UPDATE subtasks SET
    status           = CASE WHEN p_approved THEN 'completed' ELSE 'in_progress' END,
    rejection_reason = CASE WHEN NOT p_approved THEN p_reason ELSE NULL END
  WHERE id = p_subtask_id;

  IF v_sub.assigned_to IS NOT NULL AND v_sub.assigned_to <> v_caller.id THEN
    INSERT INTO notifications (user_id, type, title, body, task_id, subtask_id)
    VALUES (
      v_sub.assigned_to,
      CASE WHEN p_approved THEN 'subtask_approved' ELSE 'subtask_rejected' END,
      CASE WHEN p_approved THEN 'Subtask approved ✓' ELSE 'Subtask needs revision' END,
      v_sub.title || CASE WHEN NOT p_approved AND p_reason IS NOT NULL THEN ' — ' || p_reason ELSE '' END,
      v_sub.parent_task_id,
      p_subtask_id
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'approved', p_approved);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_subtask_approval(UUID, BOOLEAN, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
