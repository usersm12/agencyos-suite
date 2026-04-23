-- Create storage bucket for web project file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'web-project-files',
  'web-project-files',
  true,
  52428800, -- 50MB limit
  ARRAY['image/*', 'application/pdf', 'application/zip', 'text/*', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload web project files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'web-project-files');

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read web project files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'web-project-files');

-- Allow public read (since bucket is public)
CREATE POLICY "Public can read web project files"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'web-project-files');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete web project files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'web-project-files');
