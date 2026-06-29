import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
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

export default function LoginNew() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError('');

      const normalizedEmail = normalizeLoginIdentifier(email);
      const response = await apiRequest<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });
      
      if (response.mfaRequired) {
        setError('MFA is required but not supported in this view. Please contact IT.');
      } else {
        handleSuccessfulLogin(response);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? normalizeAuthErrorMessage(requestError.message) : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Force light mode for login page - override dark mode CSS */}
      <style>{`
        .login-page-root { color: #0F1B2D !important; }
        .login-page-root *, .login-page-root *::before, .login-page-root *::after { color: #0F1B2D !important; }
        .login-page-root .login-text-ink {
          color: #0F1B2D !important;
        }
        .login-page-root .login-text-muted {
          color: #8C96A4 !important;
        }
        .login-page-root .login-text-primary {
          color: #2667E8 !important;
        }
        .login-page-root .login-text-white {
          color: white !important;
        }
        .login-page-root .login-text-error {
          color: #E5484D !important;
        }
      `}</style>
      <div className="min-h-screen flex relative overflow-hidden login-page-root" style={{ fontFamily: 'Inter, sans-serif' }}>
        {/* Split Background */}
        <div className="absolute inset-0 flex">
        {/* Left half - Light Blue */}
        <div className="w-1/2" style={{ backgroundColor: '#CFE0FB' }} />
        {/* Right half - White */}
        <div className="w-1/2 bg-white" />
        {/* Glowing Seam */}
        <div 
          className="absolute left-1/2 top-0 bottom-0 w-px"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgba(38, 103, 232, 0.3) 20%, rgba(38, 103, 232, 0.5) 50%, rgba(38, 103, 232, 0.3) 80%, transparent)',
            boxShadow: '0 0 20px rgba(38, 103, 232, 0.4), 0 0 40px rgba(38, 103, 232, 0.2)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full flex items-center justify-center px-4 py-12">
        <div 
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-10"
          style={{ 
            border: '1px solid #E7EBF1',
            boxShadow: '0 20px 60px rgba(15, 27, 45, 0.15), 0 0 1px rgba(15, 27, 45, 0.1)'
          }}
        >
          {/* Logo Section */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              {/* Logo Mark */}
              <div 
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  width: '48px',
                  height: '48px',
                  backgroundColor: '#2667E8',
                }}
              >
                <span className="login-text-white" style={{ fontWeight: '700', fontSize: '24px', fontFamily: 'Inter, sans-serif' }}>IT</span>
                {/* Z Badge */}
                <div 
                  className="login-text-white"
                  style={{
                    position: 'absolute',
                    bottom: '-4px',
                    right: '-4px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#0F1B2D',
                    fontSize: '12px',
                    fontWeight: '700',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Z
                </div>
              </div>
              {/* ITMS Wordmark */}
              <span className="login-text-ink" style={{ fontSize: '38px', fontWeight: '700', letterSpacing: '-0.02em', fontFamily: 'Inter, sans-serif' }}>
                ITMS
              </span>
            </div>
            <div className="login-text-muted" style={{ fontSize: '9px', fontWeight: '500', letterSpacing: '0.08em', fontFamily: 'Inter, sans-serif' }}>
              IT MANAGEMENT SYSTEM / POWERED BY ZERODHA
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #E7EBF1', marginBottom: '32px' }} />

          {/* Welcome Heading */}
          <h1 className="login-text-ink" style={{ fontSize: '24px', fontWeight: '600', textAlign: 'center', marginBottom: '32px', fontFamily: 'Inter, sans-serif' }}>
            Welcome back
          </h1>

          {!showPasswordForm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Continue with Email Button */}
              <button
                type="button"
                onClick={() => setShowPasswordForm(true)}
                className="login-text-primary"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '500',
                  backgroundColor: 'white',
                  border: '1.5px solid #2667E8',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'Inter, sans-serif',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f9ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                Continue with email
              </button>

              {/* Helper Text */}
              <p className="login-text-muted" style={{ fontSize: '14px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
                Sign in with your Zerodha credentials
              </p>

              {/* Divider */}
              <div style={{ position: 'relative', marginTop: '24px', marginBottom: '24px' }}>
                <div style={{ position: 'absolute', inset: '0', display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '100%', borderTop: '1px solid #E7EBF1' }} />
                </div>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  <span className="login-text-muted" style={{ paddingLeft: '12px', paddingRight: '12px', backgroundColor: 'white', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
                    Or continue with
                  </span>
                </div>
              </div>

              {/* Google SSO Disabled Button */}
              <button
                type="button"
                disabled
                className="login-text-muted"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '14px',
                  fontWeight: '500',
                  backgroundColor: '#F1F4F9',
                  border: '1px solid #E7EBF1',
                  cursor: 'not-allowed',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <Lock className="w-4 h-4" style={{ marginRight: '8px' }} />
                <span>Google SSO not configured</span>
              </button>
            </div>
          ) : (
            <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} onSubmit={handleLogin}>
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="login-text-ink" style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  className="login-text-ink"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    backgroundColor: '#F1F4F9',
                    border: '1px solid #E7EBF1',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    fontFamily: 'Inter, sans-serif',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#2667E8';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(38, 103, 232, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E7EBF1';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  placeholder="your@zerodha.com"
                />
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="login-text-ink" style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="login-text-ink"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    backgroundColor: '#F1F4F9',
                    border: '1px solid #E7EBF1',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    fontFamily: 'Inter, sans-serif',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#2667E8';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(38, 103, 232, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E7EBF1';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  placeholder="••••••••"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div 
                  className="login-text-error"
                  style={{
                    borderRadius: '12px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    backgroundColor: '#FEE2E2',
                    border: '1px solid #E5484D',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {error}
                </div>
              )}

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="login-text-white"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '500',
                  backgroundColor: '#2667E8',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                  boxShadow: '0 2px 8px rgba(38, 103, 232, 0.25)',
                  transition: 'all 0.2s',
                  fontFamily: 'Inter, sans-serif',
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = '#1e56c8';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(38, 103, 232, 0.35)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#2667E8';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(38, 103, 232, 0.25)';
                }}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>

              {/* Back Button */}
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false);
                  setError('');
                  setEmail('');
                  setPassword('');
                }}
                className="login-text-muted"
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'Inter, sans-serif',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#2667E8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#8C96A4';
                }}
              >
                Back
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="login-text-muted" style={{ marginTop: '40px', textAlign: 'center', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
            © 2026 ITMS · Powered by Zerodha
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
