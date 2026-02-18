
-- Create a secure RPC that returns admin-safe profile data
-- Returns has_totp boolean instead of the actual totp_secret
CREATE OR REPLACE FUNCTION public.get_admin_profiles()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  otp_code text,
  has_totp boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.full_name,
    p.email,
    p.otp_code,
    (p.totp_secret IS NOT NULL AND p.totp_secret <> '') AS has_totp
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
$$;
