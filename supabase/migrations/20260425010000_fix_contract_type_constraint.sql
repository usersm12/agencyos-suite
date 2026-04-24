-- Drop old constraint (only allowed 'One-time' | 'Retainer', wrong case + missing 'hourly')
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_contract_type_check;

-- Add new constraint that matches the form values
ALTER TABLE public.clients
  ADD CONSTRAINT clients_contract_type_check
  CHECK (contract_type IN ('retainer', 'one-time', 'hourly', 'Retainer', 'One-time'));

-- Normalise any existing rows that used the old capitalised values
UPDATE public.clients SET contract_type = 'retainer'  WHERE contract_type = 'Retainer';
UPDATE public.clients SET contract_type = 'one-time'  WHERE contract_type = 'One-time';

NOTIFY pgrst, 'reload schema';
