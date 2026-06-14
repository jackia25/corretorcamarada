-- Remove default PUBLIC/anon execute on all sensitive functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;

REVOKE EXECUTE ON FUNCTION public.has_active_agreement(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_active_agreement(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_active_agreement(uuid, uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM PUBLIC;