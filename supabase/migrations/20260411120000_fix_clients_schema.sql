-- Fix for missing clients schema columns
-- Use IF NOT EXISTS to prevent errors if they were partially applied

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS website_url TEXT,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS contract_start_date DATE,
ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'Retainer' CHECK (contract_type IN ('One-time', 'Retainer')),
ADD COLUMN IF NOT EXISTS monthly_retainer_value NUMERIC,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Force postgREST to reload its schema cache so the JS client recognizes the new columns immediately
NOTIFY pgrst, 'reload schema';
