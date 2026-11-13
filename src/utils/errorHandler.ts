/**
 * Error response structure from backend
 */
export interface ErrorResponse {
  timestamp?: string;
  status: number;
  error: string;
  message: string;
  path?: string;
  validationErrors?: string[];
}

/**
 * Extracts a user-friendly error message from various error types
 */
export function extractErrorMessage(error: unknown): string {
  // If it's already a string, return it
  if (typeof error === 'string') {
    return error;
  }

  // If it's an Error object with a message
  if (error instanceof Error) {
    return error.message;
  }

  // If it's a backend ErrorResponse object
  if (error && typeof error === 'object') {
    const e = error as { validationErrors?: unknown; message?: unknown; error?: unknown };
    // Check for validation errors first (most specific)
    if (e.validationErrors && Array.isArray(e.validationErrors) && e.validationErrors.length > 0) {
      return e.validationErrors.join(', ');
    }

    // Check for message field (this is the main error message from backend)
    if (e.message && typeof e.message === 'string' && e.message.trim()) {
      return e.message.trim();
    }

    // Check for error field (fallback)
    if (e.error && typeof e.error === 'string' && e.error.trim()) {
      return e.error.trim();
    }
  }

  // Default fallback
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Formats error messages to be more user-friendly
 */
export function formatErrorMessage(message: string): string {
  // Capitalize first letter
  if (message.length === 0) return message;
  
  let formatted = message.charAt(0).toUpperCase() + message.slice(1);
  
  // Add period if missing
  if (!formatted.endsWith('.') && !formatted.endsWith('!') && !formatted.endsWith('?')) {
    formatted += '.';
  }
  
  return formatted;
}

/**
 * Gets a user-friendly error message from an error
 */
export function getErrorMessage(error: unknown): string {
  const message = extractErrorMessage(error);
  return formatErrorMessage(message);
}

