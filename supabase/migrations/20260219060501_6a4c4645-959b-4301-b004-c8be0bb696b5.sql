-- Revoke SELECT on sensitive columns from authenticated and anon roles
-- SECURITY DEFINER functions (get_admin_profiles, verify_and_rotate_otp) will still have access
REVOKE SELECT (otp_code, totp_secret) ON public.profiles FROM authenticated;
REVOKE SELECT (otp_code, totp_secret) ON public.profiles FROM anon;