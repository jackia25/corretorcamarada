-- Create storage bucket for property photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-photos', 
  'property-photos', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Create RLS policies for the bucket
-- Allow authenticated users to upload their own photos
CREATE POLICY "Users can upload property photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'property-photos' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anyone to view public photos
CREATE POLICY "Public property photos are viewable by everyone"
ON storage.objects
FOR SELECT
USING (bucket_id = 'property-photos');

-- Allow users to update their own photos
CREATE POLICY "Users can update their own property photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'property-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own photos
CREATE POLICY "Users can delete their own property photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'property-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);