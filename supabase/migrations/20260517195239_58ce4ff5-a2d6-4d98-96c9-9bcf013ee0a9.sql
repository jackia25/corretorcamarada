ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS source_payload jsonb;
CREATE INDEX IF NOT EXISTS idx_properties_source_payload ON public.properties USING GIN (source_payload);