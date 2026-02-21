/**
 * Strip all non-digit characters from a phone string, keeping only digits.
 * If it starts with "1" and has 11 digits, remove the leading "1".
 */
export function stripPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  return digits;
}

/**
 * Format a phone string to (XXX) XXX-XXXX.
 * Returns the raw input if it can't be normalized to 10 digits.
 */
export function formatPhone(raw: string): string {
  const digits = stripPhone(raw);
  if (digits.length !== 10) return raw;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Format phone as user types — progressively builds (XXX) XXX-XXXX.
 */
export function formatPhoneInput(raw: string): string {
  const digits = stripPhone(raw);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}
