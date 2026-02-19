
-- Create zip_centroids table to cache ZIP code centroid coordinates
CREATE TABLE public.zip_centroids (
  zip TEXT NOT NULL PRIMARY KEY,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.zip_centroids ENABLE ROW LEVEL SECURITY;

-- Everyone can read (needed during imports)
CREATE POLICY "Authenticated users can read zip centroids"
ON public.zip_centroids FOR SELECT
USING (true);

-- Processors and admins can insert (during geocoding)
CREATE POLICY "CSR can insert zip centroids"
ON public.zip_centroids FOR INSERT
WITH CHECK (has_role(auth.uid(), 'processor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
