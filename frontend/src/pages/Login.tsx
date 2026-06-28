import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MonitorSmartphone, Lock, Eye, EyeOff, Shield } from 'lucide-react';
import { apiRequest, resetAuthRedirectState } from '../lib/api';
import { getPreferredPortalPath, getShortName, normalizeAuthUser, normalizeLoginIdentifier, setStoredSession } from '../lib/session';
import { normalizeAuthErrorMessage } from './loginUtils';

interface LoginResponse {
  token: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
    fullName?: string;
    full_name?: string;
    role: string;
    defaultPortal?: string;
    default_portal?: string;
    portals?: string[];
  };
  mfaRequired?: boolean;
  message?: string;
}

interface AuthProvidersResponse {
  google?: {
    enabled: boolean;
    clientId?: string;
  };
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string>) => void;
        };
      };
    };
  }
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleScript() {
  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-identity="true"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')), { once: true });
      if (window.google) {
        resolve();
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export default function Login() {
  const navigate = useNavigate();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [credentialFieldsReady, setCredentialFieldsReady] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    resetAuthRedirectState();
  }, []);

  const handleSuccessfulLogin = useCallback((response: LoginResponse) => {
    const user = normalizeAuthUser(response.user);
    const shortName = getShortName(user.fullName, user.role);

    setStoredSession({
      token: response.token,
      user,
      shortName,
    });

    localStorage.setItem('itms_role', user.role);
    localStorage.setItem('itms_short', shortName);

    navigate(getPreferredPortalPath(user), { replace: true });
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;

    const loadProviders = async () => {
      try {
        const providers = await apiRequest<AuthProvidersResponse>('/api/auth/providers');
        if (cancelled) {
          return;
        }
        setGoogleEnabled(Boolean(providers.google?.enabled));
        setGoogleClientId(providers.google?.clientId || '');
      } catch {
        if (!cancelled) {
          setGoogleEnabled(false);
          setGoogleClientId('');
        }
      }
    };

    void loadProviders();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!googleEnabled || !googleClientId || !googleButtonRef.current) {
      return;
    }

    let cancelled = false;

    const setupGoogle = async () => {
      try {
        await loadGoogleScript();
        if (cancelled || !googleButtonRef.current || !window.google) {
          return;
        }

        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (googleResponse) => {
            if (!googleResponse.credential) {
              setError('Google Sign-In did not return a credential');
              return;
            }

            try {
              setGoogleLoading(true);
              setError('');
              const response = await apiRequest<LoginResponse>('/api/auth/google', {
                method: 'POST',
                body: JSON.stringify({ idToken: googleResponse.credential }),
              });
              handleSuccessfulLogin(response);
            } catch (requestError) {
				setError(requestError instanceof Error ? normalizeAuthErrorMessage(requestError.message) : 'Google Sign-In failed');
            } finally {
              setGoogleLoading(false);
            }
          },
        });

        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          text: 'signin_with',
          shape: 'rectangular',
          width: '320',
        });
      } catch (setupError) {
        if (!cancelled) {
          setError(setupError instanceof Error ? setupError.message : 'Failed to initialize Google Sign-In');
        }
      }
    };

    void setupGoogle();

    return () => {
      cancelled = true;
    };
  }, [googleClientId, googleEnabled, handleSuccessfulLogin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError('');
      setSupportMessage('');

      const normalizedEmail = normalizeLoginIdentifier(email);
      const response = await apiRequest<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });
      
      // Check if MFA is required
      if (response.mfaRequired) {
        setMfaRequired(true);
        setUserEmail(normalizedEmail);
        setError('');
      } else {
        handleSuccessfulLogin(response);
      }
    } catch (requestError) {
		setError(requestError instanceof Error ? normalizeAuthErrorMessage(requestError.message) : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMFAVerification = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError('');

      const response = await apiRequest<LoginResponse>('/api/auth/login/verify-mfa', {
        method: 'POST',
        body: JSON.stringify({
          email: userEmail,
          code: mfaCode.trim(),
        }),
      });
      handleSuccessfulLogin(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? normalizeAuthErrorMessage(requestError.message) : 'MFA verification failed');
      setMfaCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setMfaRequired(false);
    setMfaCode('');
    setPassword('');
    setError('');
  };

  const handleForgotPassword = useCallback(() => {
    setError('');
    setSupportMessage('Password resets are handled by IT or a super admin. Contact IT for a reset or account review.');
  }, []);

  const enableCredentialFields = useCallback(() => {
    setCredentialFieldsReady(true);
  }, []);

  const revealPasswordForm = useCallback(() => {
    setShowPasswordForm(true);
    setCredentialFieldsReady(true);
  }, []);

  const handleSSOLogin = useCallback(() => {
    setSsoLoading(true);
    setError('');
    
    // Redirect to Keycloak authorization endpoint
    // IMPORTANT: Update these values to match your Keycloak configuration
    const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8081';
    const keycloakRealm = import.meta.env.VITE_KEYCLOAK_REALM || 'itms';
    const keycloakClientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'itms-frontend';
    const redirectUri = `${window.location.origin}/login/callback`;
    
    // Build OAuth2 authorization URL
    const authUrl = new URL(`${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/auth`);
    authUrl.searchParams.set('client_id', keycloakClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('state', Math.random().toString(36).substring(7));
    
    // Redirect to Keycloak login page
    window.location.href = authUrl.toString();
    
    // TODO: Implement callback handler at /login/callback route
    // 1. Extract 'code' from query params
    // 2. POST to /api/auth/sso/callback with code
    // 3. Backend exchanges code for tokens with Keycloak
    // 4. Backend validates user and issues ITMS JWT
    // 5. handleSuccessfulLogin(response)
  }, []);

  // Check if SSO is enabled (would be loaded from /api/auth/providers)
  useEffect(() => {
    // For now, enable SSO if VITE_KEYCLOAK_URL is set
    const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL;
    setSsoEnabled(Boolean(keycloakUrl));
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center mb-8">
          <img 
            src="/itms-logo-light.svg"
            alt="ITMS - IT Management System - Zerodha" 
            className="h-16 w-auto object-contain dark:hidden"
          />
          <img 
            src="/itms-logo-dark.svg"
            alt="ITMS - IT Management System - Zerodha" 
            className="h-16 w-auto object-contain hidden dark:block"
          />
        </div>
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Sign in to your portal
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-zinc-900 py-10 px-6 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          {mfaRequired ? (
            <form className="space-y-5" onSubmit={handleMFAVerification}>
              <div>
                <h2 className="text-lg font-medium text-zinc-900 dark:text-white mb-1">Two-Factor Authentication</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Enter the 6-digit code from your authenticator app.
                </p>
              </div>

              <div>
                <label htmlFor="mfa-code" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Verification Code
                </label>
                <input
                  id="mfa-code"
                  name="mfa-code"
                  type="text"
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  placeholder="000000"
                  className="block w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent text-center text-lg tracking-widest transition"
                />
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Use your authenticator app or 10-digit backup code
                </p>
              </div>

              {error ? (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              ) : null}

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 dark:focus:ring-white disabled:opacity-50 transition"
                >
                  {loading ? 'Verifying...' : 'Verify Code'}
                </button>

                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="w-full py-3 px-4 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-300 transition"
                >
                  Back to Login
                </button>
              </div>
            </form>
          ) : !showPasswordForm ? (
            <div className="space-y-4">
              {error ? (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              ) : null}
              <button
                type="button"
                onClick={revealPasswordForm}
                className="w-full py-3 px-4 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 dark:focus:ring-white transition"
              >
                Continue with email
              </button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center leading-relaxed">
                Opens password form when needed
              </p>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleLogin} autoComplete="on" action="/login" method="post" data-bwignore="true">
              <div className="hidden" aria-hidden="true">
                <input tabIndex={-1} name="username" autoComplete="username" data-bwignore="true" data-1p-ignore="true" data-lpignore="true" />
                <input tabIndex={-1} name="password" type="password" autoComplete="current-password" data-bwignore="true" data-1p-ignore="true" data-lpignore="true" />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Email / Employee ID
                </label>
                <input
                  id="email"
                  name="login_identifier"
                  type="text"
                  required
                  readOnly={!credentialFieldsReady}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={enableCredentialFields}
                  onPointerDown={enableCredentialFields}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label="Email or Employee ID"
                  data-bwignore="true"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  className="block w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent transition"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="login_secret"
                    type={passwordVisible ? 'text' : 'password'}
                    required
                    readOnly={!credentialFieldsReady}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={enableCredentialFields}
                    onPointerDown={enableCredentialFields}
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-label="Password"
                    data-bwignore="true"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    className="block w-full px-4 py-3 pr-12 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((current) => !current)}
                    className="absolute inset-y-0 right-0 flex items-center px-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
                    aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                  >
                    {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center cursor-pointer">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 focus:ring-zinc-900 dark:focus:ring-white"
                  />
                  <span className="ml-2 text-sm text-zinc-700 dark:text-zinc-300">
                    Remember me
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition"
                >
                  Forgot password?
                </button>
              </div>

              {error ? (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              ) : null}

              {supportMessage ? (
                <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
                  {supportMessage}
                </div>
              ) : null}

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 dark:focus:ring-white disabled:opacity-50 transition"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center leading-relaxed">
                  Sign in with your employee email or ID. Contact IT for account issues.
                </p>
              </div>
            </form>
          )}

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {googleEnabled ? (
                <div className="space-y-2">
                  <div ref={googleButtonRef} className="flex justify-center [&>div]:w-full" />
                  {googleLoading ? <p className="text-xs text-center text-zinc-500 dark:text-zinc-400">Signing in with Google...</p> : null}
                </div>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 px-4 rounded-xl inline-flex justify-center items-center text-sm font-medium text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 cursor-not-allowed"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  <span>Google SSO not configured</span>
                </button>
              )}
              
              {ssoEnabled ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleSSOLogin}
                    disabled={ssoLoading}
                    className="w-full py-3 px-4 rounded-xl inline-flex justify-center items-center text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    <span>{ssoLoading ? 'Redirecting...' : 'Enterprise SSO'}</span>
                  </button>
                  {ssoLoading ? <p className="text-xs text-center text-zinc-500 dark:text-zinc-400">Redirecting to SSO provider...</p> : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
