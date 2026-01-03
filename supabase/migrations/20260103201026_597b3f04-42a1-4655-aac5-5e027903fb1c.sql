-- Add signature fields to cooperation_agreements table
ALTER TABLE public.cooperation_agreements 
ADD COLUMN IF NOT EXISTS captador_signature_ip text,
ADD COLUMN IF NOT EXISTS buyer_broker_signature_ip text,
ADD COLUMN IF NOT EXISTS contract_template text DEFAULT 'default',
ADD COLUMN IF NOT EXISTS contract_version integer DEFAULT 1;