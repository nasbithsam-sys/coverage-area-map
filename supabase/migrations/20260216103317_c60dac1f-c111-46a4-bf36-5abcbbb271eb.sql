
-- Add TOTP secret column for admin users (Google Authenticator)
ALTER TABLE public.profiles ADD COLUMN totp_secret TEXT;

-- Allow admins to update profiles (for setting totp_secret)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));
