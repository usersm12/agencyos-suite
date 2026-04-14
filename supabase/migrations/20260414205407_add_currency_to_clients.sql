-- Add currency column to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD'
    CHECK (currency IN ('USD', 'INR', 'EUR', 'AUD', 'SGD', 'GBP', 'AED'));
