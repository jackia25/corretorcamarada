-- 1) Storage: drop broad SELECT policy on property-photos.
-- Public URLs (storage.../object/public/property-photos/...) keep working because the bucket is public;
-- this only prevents arbitrary listing via the authenticated API.
DROP POLICY IF EXISTS "Public property photos are viewable by everyone" ON storage.objects;

-- 2) Lock down SECURITY DEFINER trigger functions (only the DB engine should call them).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 3) Lock down SECURITY DEFINER helpers from anonymous clients.
-- Authenticated keeps EXECUTE because RLS policies call them with auth.uid().
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_active_agreement(uuid, uuid) FROM PUBLIC, anon;