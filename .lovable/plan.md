

# Fix: Add `autocomplete` Attributes to Login Form

## What's happening
The browser flags a best-practice warning on the login page: input fields should have `autocomplete` attributes for better accessibility and password-manager support.

All other console messages (postMessage origin mismatches, Tailwind CDN warning) come from the preview infrastructure -- they are not from your code and cannot be fixed on your side.

## Changes

**File: `src/pages/Login.tsx`**

Add `autoComplete` props to the three form inputs:

- Email input: `autoComplete="email"`
- Password input: `autoComplete="current-password"`
- OTP input: `autoComplete="one-time-code"`

This is a small, safe change that silences the browser warning and improves usability with password managers.

