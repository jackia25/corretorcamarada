-- Restore column-level SELECT on non-sensitive profile columns for authenticated users.
-- phone stays protected (only readable via get_my_profile RPC for the owner).
GRANT SELECT (id, full_name, creci, city, state, avatar_url, bio, created_at, updated_at, code_prefix)
  ON public.profiles TO authenticated;

GRANT ALL ON public.profiles TO service_role;