export function normalizeAuthErrorMessage(message: string) {
  const normalized = message.trim().toLowerCase();
  if (
    normalized === 'authentication failed'
    || normalized === 'wrong password'
    || normalized === 'unregistered email'
    || normalized === 'user is inactive'
    || normalized === 'only @zerodha.com email addresses are allowed'
    || normalized === 'invalid google token'
    || normalized === 'google token email mismatch'
    || normalized === 'non-zerodha domain is not allowed'
  ) {
    return 'Sign-in failed. Check your email or employee ID and password, or contact IT if you need access help.';
  }
  return message;
}