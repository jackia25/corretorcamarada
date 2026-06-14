ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS code_prefix TEXT;

COMMENT ON COLUMN public.profiles.code_prefix IS 'Sigla/letra do corretor usada para gerar códigos de imóvel (ex.: A -> A01, A02).';