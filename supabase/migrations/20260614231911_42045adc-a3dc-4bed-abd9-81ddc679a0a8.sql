-- Restore Data API grants wiped by the previous security migration.
-- RLS still controls row visibility; these grants just re-open the Data API.

GRANT SELECT, INSERT ON public.access_logs TO authenticated;
GRANT ALL ON public.access_logs TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.cooperation_agreements TO authenticated;
GRANT ALL ON public.cooperation_agreements TO service_role;

GRANT SELECT, INSERT ON public.crossing_reports TO authenticated;
GRANT ALL ON public.crossing_reports TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_demands TO authenticated;
GRANT ALL ON public.purchase_demands TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- profiles: keep phone protected (column-level SELECT already granted), allow self-update
GRANT UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;