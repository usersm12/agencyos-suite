-- ============================================================
-- DROP the old 4-parameter overload of create_client.
-- The new 6-parameter version (with p_is_multisite + p_properties)
-- was added in 20260426001000 but CREATE OR REPLACE with new params
-- creates a second overload instead of replacing — PostgREST then
-- throws "could not choose the best candidate function", which causes
-- managers (and in some cache states, owners) to get a 400 error
-- when trying to create a client.
-- The identical fix was already applied to update_client in
-- migration 20260426003000.
-- ============================================================
DROP FUNCTION IF EXISTS public.create_client(TEXT, TEXT, TEXT, UUID[]);

NOTIFY pgrst, 'reload schema';
