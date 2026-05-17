ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS land_area_m2 numeric,
  ADD COLUMN IF NOT EXISTS garage_spaces integer,
  ADD COLUMN IF NOT EXISTS year_built integer,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS listing_status text DEFAULT 'venda',
  ADD COLUMN IF NOT EXISTS labels text[],
  ADD COLUMN IF NOT EXISTS featured_photo text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS virtual_tour_url text,
  ADD COLUMN IF NOT EXISTS external_code text,
  ADD COLUMN IF NOT EXISTS extra_costs jsonb,
  ADD COLUMN IF NOT EXISTS source_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_source_id_unique ON public.properties(source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_external_code ON public.properties(external_code);