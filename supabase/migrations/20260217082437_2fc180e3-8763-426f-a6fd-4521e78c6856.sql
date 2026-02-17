
-- Use gen_random_uuid() to derive secure random OTP codes
CREATE OR REPLACE FUNCTION public.generate_otp_code()
RETURNS text
LANGUAGE sql
SET search_path = public
AS $$
  SELECT LPAD((abs(('x' || substr(gen_random_uuid()::text, 1, 8))::bit(32)::int) % 1000000)::TEXT, 6, '0')
$$;

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
    SET otp_code = LPAD((abs(('x' || substr(gen_random_uuid()::text, 1, 8))::bit(32)::int) % 1000000)::TEXT, 6, '0')
    WHERE user_id = _user_id;
  END IF;
  
  RETURN COALESCE(_match, false);
END;
$$;
