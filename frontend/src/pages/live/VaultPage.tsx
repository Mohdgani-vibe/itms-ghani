import { useEffect, useState } from 'react';
import { Eye, EyeOff, Key, Lock, Plus, Search, Shield, Trash2, Server, Database, FileKey } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { getStoredSession } from '../../lib/session';
import ConfirmDialog from '../../components/ConfirmDialog';

interface VaultCredential {
  id: string;
  name: string;
  username: string;
  type: string;
  assetId?: string | null;
  assetName?: string | null;
  notes?: string | null;
  createdBy: string;
  createdAt: string;
  lastAccessedAt?: string | null;
  accessCount: number;
}

interface VaultCredentialCreate {
  name: string;
  username: string;
  password: string;
  type: string;
  assetId?: string;
  notes?: string;
}

interface RevealResponse {
  password: string;
}

const CREDENTIAL_TYPES = [
  { value: 'password', label: 'Password', icon: Key },
  { value: 'api_key', label: 'API Key', icon: FileKey },
  { value: 'ssh_key', label: 'SSH Key', icon: Shield },
  { value: 'service_account', label: 'Service Account', icon: Server },
  { value: 'database', label: 'Database', icon: Database },
  { value: 'certificate', label: 'Certificate', icon: Lock },
];

export default function VaultPage() {
  const session = getStoredSession();
  const role = session?.user.role?.toLowerCase() || '';
  const canManage = role === 'super_admin' || role === 'it_team';
  const canReveal = canManage; // Auditors can list but not reveal
  const isAuditor = role === 'auditor';

  const [credentials, setCredentials] = useState<VaultCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<VaultCredential | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState<VaultCredentialCreate>({
    name: '',
    username: '',
    password: '',
    type: 'password',
    assetId: '',
    notes: '',
  });

  useEffect(() => {
    void loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiRequest<VaultCredential[]>('/api/vault');
      setCredentials(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');
      await apiRequest('/api/vault', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setSuccess('Credential created successfully');
      setShowCreateForm(false);
      setFormData({
        name: '',
        username: '',
        password: '',
        type: 'password',
        assetId: '',
        notes: '',
      });
      void loadCredentials();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create credential');
    }
  };

  const handleRevealPassword = async (credentialId: string) => {
    try {
      setRevealingId(credentialId);
      setError('');
      const data = await apiRequest<RevealResponse>(`/api/vault/${credentialId}/reveal`, {
        method: 'POST',
      });
      setRevealedPasswords((prev) => ({ ...prev, [credentialId]: data.password }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reveal password');
    } finally {
      setRevealingId('');
    }
  };

  const handleDeleteCredential = async () => {
    if (!deleteTarget) return;
    try {
      setError('');
      setSuccess('');
      await apiRequest(`/api/vault/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setSuccess('Credential deleted successfully');
      setDeleteTarget(null);
      void loadCredentials();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete credential');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess('Copied to clipboard');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  };

  const filteredCredentials = credentials.filter((cred) =>
    cred.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cred.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cred.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeIcon = (type: string) => {
    const typeConfig = CREDENTIAL_TYPES.find((t) => t.value === type);
    return typeConfig?.icon || Key;
  };

  return (
    <>
    <style>{`
      .vault-page-root,
      .vault-page-root div,
      .vault-page-root span,
      .vault-page-root p,
      .vault-page-root h1,
      .vault-page-root h2,
      .vault-page-root h3,
      .vault-page-root button,
      .vault-page-root a,
      .vault-page-root label,
      .vault-page-root input,
      .vault-page-root select,
      .vault-page-root td,
      .vault-page-root th,
      .vault-page-root li {
        color: #0F1B2D !important;
      }
      .vault-page-root .text-ink { color: #0F1B2D !important; }
      .vault-page-root .text-muted { color: #8C96A4 !important; }
      .vault-page-root .text-primary { color: #2667E8 !important; }
      .vault-page-root .text-white { color: white !important; }
      .vault-page-root .text-success { color: #30A46C !important; }
      .vault-page-root .text-warning { color: #FFB224 !important; }
      .vault-page-root .text-danger { color: #E5484D !important; }
      .vault-page-root .bg-white { background-color: white !important; }
    `}</style>
    <div className="space-y-6 vault-page-root">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center">
            <Shield className="mr-3 h-6 w-6 text-brand-600" />
            Credential Vault
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Securely store and manage passwords, API keys, and credentials with AES-256-GCM encryption.
          </p>
        </div>
        {canManage && !showCreateForm && (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 font-medium"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Credential
          </button>
        )}
      </div>

      {isAuditor && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Auditor access: You can view credential metadata but cannot reveal passwords or create/delete entries.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white shadow-sm rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Create New Credential</h2>
          <form onSubmit={handleCreateCredential} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                  Credential Name *
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Production Database"
                />
              </div>

              <div>
                <label htmlFor="type" className="block text-sm font-medium text-slate-700 mb-1">
                  Type *
                </label>
                <select
                  id="type"
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {CREDENTIAL_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1">
                  Username / Identifier *
                </label>
                <input
                  type="text"
                  id="username"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="admin"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                  Password / Secret *
                </label>
                <input
                  type="password"
                  id="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label htmlFor="assetId" className="block text-sm font-medium text-slate-700 mb-1">
                  Asset ID (Optional)
                </label>
                <input
                  type="text"
                  id="assetId"
                  value={formData.assetId}
                  onChange={(e) => setFormData({ ...formData, assetId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Link to specific device"
                />
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Additional context"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 font-medium"
              >
                Create Credential
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div className="relative rounded-md shadow-sm w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 px-3 border"
              placeholder="Search credentials..."
            />
          </div>
          <div className="text-sm font-medium text-slate-500">
            {filteredCredentials.length} credential{filteredCredentials.length !== 1 ? 's' : ''}
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-slate-500">Loading credentials...</div>
        ) : filteredCredentials.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Shield className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-2 text-sm font-medium text-slate-900">No credentials</h3>
            <p className="mt-1 text-sm text-slate-500">
              {searchQuery ? 'No credentials match your search.' : 'Get started by creating a new credential.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredCredentials.map((cred) => {
              const TypeIcon = getTypeIcon(cred.type);
              const isRevealed = revealedPasswords[cred.id];

              return (
                <div key={cred.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="rounded-lg bg-brand-100 p-2">
                        <TypeIcon className="h-5 w-5 text-brand-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900">{cred.name}</h3>
                        <div className="mt-1 flex items-center gap-4 text-xs text-slate-500">
                          <span>Username: {cred.username}</span>
                          <span className="px-2 py-0.5 bg-slate-100 rounded-full">
                            {CREDENTIAL_TYPES.find((t) => t.value === cred.type)?.label || cred.type}
                          </span>
                          {cred.assetName && <span>Asset: {cred.assetName}</span>}
                        </div>
                        {cred.notes && (
                          <p className="mt-1 text-xs text-slate-600">{cred.notes}</p>
                        )}
                        {isRevealed && (
                          <div className="mt-2 flex items-center gap-2 bg-slate-100 rounded-md px-3 py-2">
                            <code className="text-sm font-mono text-slate-900 flex-1">
                              {revealedPasswords[cred.id]}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(revealedPasswords[cred.id])}
                              className="text-slate-600 hover:text-slate-900 text-xs font-medium"
                            >
                              Copy
                            </button>
                            <button
                              type="button"
                              onClick={() => setRevealedPasswords((prev) => {
                                const next = { ...prev };
                                delete next[cred.id];
                                return next;
                              })}
                              className="text-slate-600 hover:text-slate-900"
                            >
                              <EyeOff className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        <div className="mt-2 text-xs text-slate-400">
                          Created by {cred.createdBy} • {new Date(cred.createdAt).toLocaleDateString()}
                          {cred.lastAccessedAt && ` • Last accessed ${new Date(cred.lastAccessedAt).toLocaleDateString()}`}
                          {cred.accessCount > 0 && ` • ${cred.accessCount} access${cred.accessCount !== 1 ? 'es' : ''}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {canReveal && !isRevealed && (
                        <button
                          type="button"
                          onClick={() => handleRevealPassword(cred.id)}
                          disabled={revealingId === cred.id}
                          className="p-2 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 disabled:opacity-50"
                          title="Reveal password"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(cred)}
                          className="p-2 text-rose-600 hover:text-rose-900 rounded-md hover:bg-rose-50"
                          title="Delete credential"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title="Delete Credential?"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone and the password will be permanently lost.`}
          confirmLabel="Delete Credential"
          tone="danger"
          onConfirm={handleDeleteCredential}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
    </>
  );
}
