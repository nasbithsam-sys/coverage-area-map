
-- Add OTP code column to profiles
ALTER TABLE public.profiles ADD COLUMN otp_code TEXT;

-- Generate initial OTP codes for existing profiles
UPDATE public.profiles SET otp_code = LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

-- Function to generate a new OTP code
CREATE OR REPLACE FUNCTION public.generate_otp_code()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0')
$$;

-- Function to verify and rotate OTP (called after successful auth)
CREATE OR REPLACE FUNCTION public.verify_and_rotate_otp(_user_id uuid, _otp text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _match boolean;
BEGIN
  SELECT otp_code = _otp INTO _match
  FROM public.profiles
  WHERE user_id = _user_id;
  
  IF _match THEN
    UPDATE public.profiles
    SET otp_code = LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0')
    WHERE user_id = _user_id;
  END IF;
  
  RETURN COALESCE(_match, false);
END;
$$;
