
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'team_member');

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role app_role NOT NULL DEFAULT 'team_member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Role check function (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_owner(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND role = 'owner')
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_owner(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND role IN ('owner', 'manager'))
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ SERVICES (Master) ============
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated can view services" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert services" ON public.services FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owners can update services" ON public.services FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Owners can delete services" ON public.services FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- ============ SERVICE TASK TEMPLATES ============
CREATE TABLE public.service_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  template_name TEXT NOT NULL,
  deliverable_fields JSONB NOT NULL DEFAULT '[]',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_task_templates ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_service_task_templates_updated_at BEFORE UPDATE ON public.service_task_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated can view templates" ON public.service_task_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert templates" ON public.service_task_templates FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owners can update templates" ON public.service_task_templates FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Owners can delete templates" ON public.service_task_templates FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- ============ SERVICE GOAL TYPES ============
CREATE TABLE public.service_goal_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  goal_name TEXT NOT NULL,
  goal_config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_goal_types ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_service_goal_types_updated_at BEFORE UPDATE ON public.service_goal_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated can view goal types" ON public.service_goal_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert goal types" ON public.service_goal_types FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owners can update goal types" ON public.service_goal_types FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Owners can delete goal types" ON public.service_goal_types FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- ============ CLIENTS ============
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'onboarding')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TEAM ASSIGNMENTS (manager <-> client) ============
CREATE TABLE public.team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, client_id)
);
ALTER TABLE public.team_assignments ENABLE ROW LEVEL SECURITY;

-- Function to check if user is assigned to a client
CREATE OR REPLACE FUNCTION public.is_assigned_to_client(_user_id UUID, _client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_assignments ta
    JOIN public.profiles p ON p.id = ta.user_id
    WHERE p.user_id = _user_id AND ta.client_id = _client_id
  )
$$;

-- Clients policies
CREATE POLICY "Owners can view all clients" ON public.clients FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can view assigned clients" ON public.clients FOR SELECT TO authenticated USING (public.is_assigned_to_client(auth.uid(), id));
CREATE POLICY "Owners can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owners can update clients" ON public.clients FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can update assigned clients" ON public.clients FOR UPDATE TO authenticated USING (public.is_assigned_to_client(auth.uid(), id));
CREATE POLICY "Owners can delete clients" ON public.clients FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- Team assignments policies
CREATE POLICY "Owners can view all assignments" ON public.team_assignments FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can view own assignments" ON public.team_assignments FOR SELECT TO authenticated USING (
  user_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Owners can manage assignments" ON public.team_assignments FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owners can update assignments" ON public.team_assignments FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Owners can delete assignments" ON public.team_assignments FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- ============ CLIENT SERVICES ============
CREATE TABLE public.client_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, service_id)
);
ALTER TABLE public.client_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view all client_services" ON public.client_services FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can view assigned client_services" ON public.client_services FOR SELECT TO authenticated USING (public.is_assigned_to_client(auth.uid(), client_id));
CREATE POLICY "Owners can manage client_services" ON public.client_services FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owners can update client_services" ON public.client_services FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Owners can delete client_services" ON public.client_services FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- ============ CLIENT GOALS ============
CREATE TABLE public.client_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  service_goal_type_id UUID REFERENCES public.service_goal_types(id) ON DELETE CASCADE NOT NULL,
  target_value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_goals ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_client_goals_updated_at BEFORE UPDATE ON public.client_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Owners can view all client_goals" ON public.client_goals FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can view assigned client_goals" ON public.client_goals FOR SELECT TO authenticated USING (public.is_assigned_to_client(auth.uid(), client_id));
CREATE POLICY "Owners can manage client_goals" ON public.client_goals FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owners can update client_goals" ON public.client_goals FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Owners can delete client_goals" ON public.client_goals FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- ============ PROJECTS ============
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Owners can view all projects" ON public.projects FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can view assigned projects" ON public.projects FOR SELECT TO authenticated USING (public.is_assigned_to_client(auth.uid(), client_id));
CREATE POLICY "Owners can insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Managers can insert projects for assigned clients" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.is_assigned_to_client(auth.uid(), client_id));
CREATE POLICY "Owners can update projects" ON public.projects FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can update assigned projects" ON public.projects FOR UPDATE TO authenticated USING (public.is_assigned_to_client(auth.uid(), client_id));
CREATE POLICY "Owners can delete projects" ON public.projects FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- ============ TASKS ============
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'review', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE,
  service_template_id UUID REFERENCES public.service_task_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check task access for team members
CREATE OR REPLACE FUNCTION public.is_task_assignee(_user_id UUID, _task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.profiles p ON p.id = t.assigned_to
    WHERE t.id = _task_id AND p.user_id = _user_id
  )
$$;

CREATE POLICY "Owners can view all tasks" ON public.tasks FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can view tasks for assigned clients" ON public.tasks FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.is_assigned_to_client(auth.uid(), p.client_id))
);
CREATE POLICY "Team members can view assigned tasks" ON public.tasks FOR SELECT TO authenticated USING (
  assigned_to = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Owners can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Managers can insert tasks for assigned clients" ON public.tasks FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.is_assigned_to_client(auth.uid(), p.client_id))
);
CREATE POLICY "Owners can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can update tasks for assigned clients" ON public.tasks FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.is_assigned_to_client(auth.uid(), p.client_id))
);
CREATE POLICY "Team members can update assigned tasks" ON public.tasks FOR UPDATE TO authenticated USING (
  assigned_to = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Owners can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- ============ TASK DELIVERABLES ============
CREATE TABLE public.task_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  deliverable_name TEXT NOT NULL,
  value TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_deliverables ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_task_deliverables_updated_at BEFORE UPDATE ON public.task_deliverables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Owners can view all deliverables" ON public.task_deliverables FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can view deliverables for assigned tasks" ON public.task_deliverables FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    WHERE t.id = task_id AND public.is_assigned_to_client(auth.uid(), p.client_id)
  )
);
CREATE POLICY "Team members can view own task deliverables" ON public.task_deliverables FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.assigned_to = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
);
CREATE POLICY "Owners can manage deliverables" ON public.task_deliverables FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Owners can update deliverables" ON public.task_deliverables FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Team members can update own deliverables" ON public.task_deliverables FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.assigned_to = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
);
CREATE POLICY "Owners can delete deliverables" ON public.task_deliverables FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- ============ BACKLINK LOG ============
CREATE TABLE public.backlink_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  anchor_text TEXT,
  da_score NUMERIC,
  pa_score NUMERIC,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'lost', 'pending')),
  logged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.backlink_log ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_backlink_log_updated_at BEFORE UPDATE ON public.backlink_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Owners can view all backlinks" ON public.backlink_log FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can view assigned backlinks" ON public.backlink_log FOR SELECT TO authenticated USING (public.is_assigned_to_client(auth.uid(), client_id));
CREATE POLICY "Owners can manage backlinks" ON public.backlink_log FOR INSERT TO authenticated WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "Managers can insert backlinks for assigned clients" ON public.backlink_log FOR INSERT TO authenticated WITH CHECK (public.is_assigned_to_client(auth.uid(), client_id));
CREATE POLICY "Owners can update backlinks" ON public.backlink_log FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can update assigned backlinks" ON public.backlink_log FOR UPDATE TO authenticated USING (public.is_assigned_to_client(auth.uid(), client_id));
CREATE POLICY "Owners can delete backlinks" ON public.backlink_log FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));

-- ============ FLAGS ============
CREATE TABLE public.flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  raised_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.flags ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_flags_updated_at BEFORE UPDATE ON public.flags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Owners can view all flags" ON public.flags FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can view assigned flags" ON public.flags FOR SELECT TO authenticated USING (public.is_assigned_to_client(auth.uid(), client_id));
CREATE POLICY "Team members can view flags they raised" ON public.flags FOR SELECT TO authenticated USING (
  raised_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Authenticated can insert flags" ON public.flags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Owners can update flags" ON public.flags FOR UPDATE TO authenticated USING (public.is_owner(auth.uid()));
CREATE POLICY "Managers can update assigned flags" ON public.flags FOR UPDATE TO authenticated USING (public.is_assigned_to_client(auth.uid(), client_id));
CREATE POLICY "Owners can delete flags" ON public.flags FOR DELETE TO authenticated USING (public.is_owner(auth.uid()));
