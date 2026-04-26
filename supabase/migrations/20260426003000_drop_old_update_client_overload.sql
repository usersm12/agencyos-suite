-- ============================================================
-- DROP the old 14-parameter overload of update_client.
-- The new 15-parameter version (with p_is_multisite) was added
-- in 20260426002000 but CREATE OR REPLACE with a new param
-- creates a second overload instead of replacing — PostgREST
-- then throws "could not choose the best candidate function".
-- ============================================================
DROP FUNCTION IF EXISTS public.update_client(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, NUMERIC, TEXT, UUID, TEXT, TEXT
);

NOTIFY pgrst, 'reload schema';
