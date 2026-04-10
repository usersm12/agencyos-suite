import { supabase } from "@/integrations/supabase/client";

export const initializeDatabase = async () => {
  const sql = `
    ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS website_url TEXT,
    ADD COLUMN IF NOT EXISTS industry TEXT,
    ADD COLUMN IF NOT EXISTS contract_start_date DATE,
    ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'Retainer' CHECK (contract_type IN ('One-time', 'Retainer')),
    ADD COLUMN IF NOT EXISTS monthly_retainer_value NUMERIC,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    
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
