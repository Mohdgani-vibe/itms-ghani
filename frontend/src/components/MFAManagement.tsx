import { useEffect, useState } from 'react';
import { Lock, Shield, Check, Copy, X, Eye, EyeOff } from 'lucide-react';
import { apiRequest } from '../lib/api';
import ConfirmDialog from './ConfirmDialog';

interface MFAStatus {
  enabled: boolean;
  backupCodesCount: number;
}

interface MFASetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export default function MFAManagement() {
  const [status, setStatus] = useState<MFAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupMode, setSetupMode] = useState(false);
  const [verifyMode, setVerifyMode] = useState(false);
  const [setupData, setSetupData] = useState<MFASetupResponse | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [copiedItem, setCopiedItem] = useState<string>('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDisable, setConfirmDisable] = useState(false);

  useEffect(() => {
    void loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiRequest<MFAStatus>('/api/auth/mfa/status');
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MFA status');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupMFA = async () => {
    try {
      setError('');
      setSuccess('');
      const data = await apiRequest<MFASetupResponse>('/api/auth/mfa/setup', {
        method: 'POST',
      });
      setSetupData(data);
      setSetupMode(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup MFA');
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      await apiRequest('/api/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({ code: verificationCode.trim() }),
      });
      setSuccess('MFA enabled successfully! Your backup codes have been saved.');
      setSetupMode(false);
      setVerifyMode(false);
      setVerificationCode('');
      setSetupData(null);
      void loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify code');
    }
  };

  const handleDisableMFA = async () => {
    try {
      setError('');
      setSuccess('');
      await apiRequest('/api/auth/mfa/disable', {
        method: 'POST',
      });
      setSuccess('MFA has been disabled.');
      setConfirmDisable(false);
      void loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable MFA');
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(label);
      setTimeout(() => setCopiedItem(''), 2000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  };

  const downloadBackupCodes = () => {
    if (!setupData?.backupCodes) return;
    
    const text = `ITMS Two-Factor Authentication Backup Codes
Generated: ${new Date().toLocaleString()}

IMPORTANT: Save these codes in a secure location.
Each code can only be used once.

${setupData.backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `itms-mfa-backup-codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Loading MFA settings...</p>
      </div>
    );
  }

  if (setupMode && setupData) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-full bg-brand-100 p-2">
            <Shield className="h-5 w-5 text-brand-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Setup Two-Factor Authentication</h3>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!verifyMode ? (
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-slate-900 mb-2">Step 1: Scan QR Code</h4>
              <p className="text-sm text-slate-600 mb-4">
                Open your authenticator app (Google Authenticator, Authy, 1Password, etc.) and scan this QR code:
              </p>
              <div className="flex justify-center p-4 bg-slate-50 rounded-lg border border-slate-200">
                <img src={setupData.qrCodeUrl} alt="MFA QR Code" className="w-48 h-48" />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-slate-900 mb-2">Step 2: Save Secret Key (Optional)</h4>
              <p className="text-sm text-slate-600 mb-2">
                If you can't scan the QR code, manually enter this secret key:
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-sm bg-slate-100 px-3 py-2 rounded border border-slate-200">
                  {showSecret ? setupData.secret : '••••••••••••••••'}
                </div>
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="p-2 text-slate-600 hover:text-slate-900 transition"
                  title={showSecret ? 'Hide secret' : 'Show secret'}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(setupData.secret, 'secret')}
                  className="p-2 text-slate-600 hover:text-slate-900 transition"
                  title="Copy secret"
                >
                  {copiedItem === 'secret' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-slate-900 mb-2">Step 3: Save Backup Codes</h4>
              <p className="text-sm text-slate-600 mb-2">
                Save these backup codes in a secure location. Each can be used once if you lose access to your authenticator:
              </p>
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 mb-3">
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {setupData.backupCodes.map((code, i) => (
                    <div key={i} className="flex items-center justify-between bg-white px-3 py-2 rounded border border-slate-200">
                      <span>{code}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(code, `backup-${i}`)}
                        className="text-slate-400 hover:text-slate-700 transition ml-2"
                      >
                        {copiedItem === `backup-${i}` ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={downloadBackupCodes}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                Download backup codes as text file
              </button>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setVerifyMode(true)}
                className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 transition font-medium"
              >
                Continue to Verification
              </button>
              <button
                type="button"
                onClick={() => {
                  setSetupMode(false);
                  setSetupData(null);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-slate-900 mb-2">Step 4: Verify Your Setup</h4>
              <p className="text-sm text-slate-600 mb-4">
                Enter the 6-digit code from your authenticator app to complete setup:
              </p>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-md text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 transition font-medium"
              >
                Verify and Enable MFA
              </button>
              <button
                type="button"
                onClick={() => setVerifyMode(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition"
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-full bg-brand-100 p-2">
            <Shield className="h-5 w-5 text-brand-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Two-Factor Authentication</h3>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-600 mb-2">
              Add an extra layer of security to your account by requiring a verification code from your phone in addition to your password.
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-slate-900">Status:</span>
              {status?.enabled ? (
                <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded-full font-medium">
                  <Check className="h-3 w-3" />
                  Enabled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                  <Lock className="h-3 w-3" />
                  Disabled
                </span>
              )}
            </div>
            {status?.enabled && status.backupCodesCount > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                You have {status.backupCodesCount} backup code{status.backupCodesCount !== 1 ? 's' : ''} remaining
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200">
            {!status?.enabled ? (
              <button
                type="button"
                onClick={handleSetupMFA}
                className="w-full sm:w-auto px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 transition font-medium"
              >
                Enable Two-Factor Authentication
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDisable(true)}
                  className="px-4 py-2 border border-rose-300 text-rose-700 rounded-md hover:bg-rose-50 transition font-medium"
                >
                  Disable MFA
                </button>
                <p className="text-xs text-slate-500 flex items-center">
                  <X className="h-3 w-3 mr-1" />
                  Disabling MFA will make your account less secure
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmDisable && (
        <ConfirmDialog
          open={true}
          title="Disable Two-Factor Authentication?"
          message="Are you sure you want to disable MFA? This will make your account less secure. You'll only need your password to sign in."
          confirmLabel="Disable MFA"
          tone="danger"
          onConfirm={handleDisableMFA}
          onClose={() => setConfirmDisable(false)}
        />
      )}
    </>
  );
}
