import { supabase } from "@/integrations/supabase/client";

export const initializeDatabase = async () => {
  const sql = `
    ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS industry TEXT,
    ADD COLUMN IF NOT EXISTS contract_start_date DATE,
    ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'retainer',
    ADD COLUMN IF NOT EXISTS monthly_retainer_value NUMERIC,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'green',
    ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    
    ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'adhoc' CHECK (task_type IN ('template', 'adhoc')),
    ADD COLUMN IF NOT EXISTS client_requested BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS notes TEXT;

    ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 30,
    ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

    ALTER TABLE public.flags
    ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS flag_type TEXT DEFAULT 'system',
    ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'warning',
    ADD COLUMN IF NOT EXISTS triggered_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS resolved_date TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS resolved_note TEXT,
    ADD COLUMN IF NOT EXISTS assigned_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS seen_by_owner BOOLEAN DEFAULT false;

    CREATE TABLE IF NOT EXISTS public.task_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
      profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
    );

    CREATE TABLE IF NOT EXISTS public.task_deliverables (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
      deliverable_type TEXT NOT NULL,
      data JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
    );
    
    CREATE TABLE IF NOT EXISTS public.backlink_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
      source_url TEXT NOT NULL,
      target_url TEXT NOT NULL,
      da INTEGER,
      pa INTEGER,
      dofollow BOOLEAN DEFAULT false,
      anchor_text TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
    );

    CREATE TABLE IF NOT EXISTS public.activity_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id UUID,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
    );
    
    NOTIFY pgrst, 'reload schema';
  `;

  try {
    // Attempt to execute via RPC. This assumes an 'execute_sql' or similar admin RPC exists
    // since standard postgrest doesn't allow direct DDL over REST.
    const { error } = await supabase.rpc('execute_sql', { query: sql });
    
    if (error) {
      console.warn("Could not auto-add columns via RPC on app init. This is totally normal if execute_sql is disabled. Please run the SQL manually:", error.message);
    } else {
      console.log("Successfully ran schema column initialization via RPC");
    }
  } catch (err) {
    console.warn("Failed RPC init:", err);
  }
};
