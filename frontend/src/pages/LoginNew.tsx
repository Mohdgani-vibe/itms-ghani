import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Shield } from 'lucide-react';
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
    <div className="min-h-screen flex relative overflow-hidden" style={{ fontFamily: 'Inter, sans-serif' }}>
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
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              {/* Logo Mark */}
              <div 
                className="relative flex items-center justify-center rounded-xl"
                style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: '#2667E8',
                }}
              >
                <span className="text-white font-bold text-2xl">IT</span>
                {/* Z Badge */}
                <div 
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: '#0F1B2D',
                    color: 'white',
                  }}
                >
                  Z
                </div>
              </div>
              {/* ITMS Wordmark */}
              <span className="text-3xl font-bold" style={{ color: '#0F1B2D', letterSpacing: '-0.02em' }}>
                ITMS
              </span>
            </div>
            <div className="text-xs font-medium tracking-wider" style={{ color: '#8C96A4' }}>
              IT MANAGEMENT SYSTEM / POWERED BY ZERODHA
            </div>
          </div>

          {/* Divider */}
          <div className="border-t mb-8" style={{ borderColor: '#E7EBF1' }} />

          {/* Welcome Heading */}
          <h1 className="text-2xl font-semibold text-center mb-8" style={{ color: '#0F1B2D' }}>
            Welcome back
          </h1>

          {!showPasswordForm ? (
            <div className="space-y-4">
              {/* Continue with Email Button */}
              <button
                type="button"
                onClick={() => setShowPasswordForm(true)}
                className="w-full py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200"
                style={{
                  color: '#2667E8',
                  backgroundColor: 'white',
                  border: '1.5px solid #2667E8',
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
              <p className="text-sm text-center" style={{ color: '#8C96A4' }}>
                Sign in with your Zerodha credentials
              </p>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" style={{ borderColor: '#E7EBF1' }} />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white" style={{ color: '#8C96A4' }}>
                    Or continue with
                  </span>
                </div>
              </div>

              {/* Google SSO Disabled Button */}
              <button
                type="button"
                disabled
                className="w-full py-3 px-4 rounded-xl inline-flex justify-center items-center text-sm font-medium cursor-not-allowed"
                style={{
                  color: '#8C96A4',
                  backgroundColor: '#F1F4F9',
                  border: '1px solid #E7EBF1',
                }}
              >
                <Lock className="w-4 h-4 mr-2" />
                <span>Google SSO not configured</span>
              </button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleLogin}>
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: '#0F1B2D' }}>
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
                  className="block w-full px-4 py-3 rounded-xl transition-all duration-200 focus:outline-none"
                  style={{
                    backgroundColor: '#F1F4F9',
                    border: '1px solid #E7EBF1',
                    color: '#0F1B2D',
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
                <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: '#0F1B2D' }}>
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
                  className="block w-full px-4 py-3 rounded-xl transition-all duration-200 focus:outline-none"
                  style={{
                    backgroundColor: '#F1F4F9',
                    border: '1px solid #E7EBF1',
                    color: '#0F1B2D',
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
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{
                    backgroundColor: '#FEE2E2',
                    border: '1px solid #E5484D',
                    color: '#E5484D',
                  }}
                >
                  {error}
                </div>
              )}

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl text-sm font-medium text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#2667E8',
                  boxShadow: '0 2px 8px rgba(38, 103, 232, 0.25)',
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
                className="w-full py-2 text-sm font-medium transition-all duration-200"
                style={{ color: '#8C96A4' }}
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
          <div className="mt-10 text-center text-xs" style={{ color: '#8C96A4' }}>
            © 2026 ITMS · Powered by Zerodha
          </div>
        </div>
      </div>
    </div>
  );
}
