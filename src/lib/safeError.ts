/**
 * Converts database/API errors to safe user-facing messages.
 * Prevents leaking internal schema details, table names, or constraint info.
 */
export function getSafeErrorMessage(error: { code?: string; message?: string } | null): string {
  if (!error) return "An unexpected error occurred. Please try again.";

  // Map common Postgres error codes to safe messages
  switch (error.code) {
    case "23505":
      return "This record already exists.";
    case "23503":
      return "Cannot complete this action: the record is referenced by other data.";
    case "23502":
      return "A required field is missing. Please check your input.";
    case "42501":
      return "You do not have permission to perform this action.";
    case "PGRST301":
      return "You do not have permission to access this data.";
    default:
      return "An error occurred. Please try again or contact support.";
  }
}
