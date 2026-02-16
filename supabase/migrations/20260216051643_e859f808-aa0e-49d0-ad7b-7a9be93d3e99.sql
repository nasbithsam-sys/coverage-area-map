
-- Fix: Restrict profiles SELECT to own profile only
DROP POLICY IF EXISTS "Users can read all profiles" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Allow admins to read all profiles (for role management)
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Coverage zones: admin-defined colored areas on the map
CREATE TABLE public.coverage_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  zone_type text NOT NULL DEFAULT 'city', -- 'neighborhood', 'city', 'region'
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_miles double precision NOT NULL DEFAULT 5,
  color_level text NOT NULL DEFAULT 'strong', -- 'strong', 'moderate', 'weak'
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coverage_zones ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read zones (for map display)
CREATE POLICY "Authenticated users can read coverage zones"
  ON public.coverage_zones FOR SELECT TO authenticated
  USING (true);

-- Only admins can manage zones
CREATE POLICY "Admins can insert coverage zones"
  ON public.coverage_zones FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update coverage zones"
  ON public.coverage_zones FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete coverage zones"
  ON public.coverage_zones FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_coverage_zones_updated_at
  BEFORE UPDATE ON public.coverage_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
