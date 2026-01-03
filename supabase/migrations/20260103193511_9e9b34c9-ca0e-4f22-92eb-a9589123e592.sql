-- Add RLS policy to allow property owners to view access logs for their properties
CREATE POLICY "Property owners can view access logs for their properties"
  ON public.access_logs 
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE properties.id = access_logs.property_id
        AND properties.owner_id = auth.uid()
    )
  );