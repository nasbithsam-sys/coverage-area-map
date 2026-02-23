
-- Create city_centroids table
CREATE TABLE public.city_centroids (
  city text NOT NULL,
  state text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT city_centroids_pkey PRIMARY KEY (city, state)
);

-- Enable RLS
ALTER TABLE public.city_centroids ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read
CREATE POLICY "Authenticated users can read city centroids"
  ON public.city_centroids
  FOR SELECT
  USING (true);

-- Admin/processor can insert
CREATE POLICY "CSR can insert city centroids"
  ON public.city_centroids
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'processor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
