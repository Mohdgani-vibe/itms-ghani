import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import SshTerminalView from '../components/SshTerminalView';
import { apiRequest } from '../lib/api';
import { getSshBlockedReason, shouldRecordSshTerminalSession } from './sshTerminalPageUtils';

interface DeviceLifecycleStatusResponse {
  status?: string | null;
}

export default function SshTerminalPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const embedded = new URLSearchParams(location.search).get('embedded') === '1';
  const sessionRecordedAssetIdRef = useRef('');
  const [statusLoading, setStatusLoading] = useState(true);
  const [blockedReason, setBlockedReason] = useState('');

  useEffect(() => {
    if (!id) {
      setStatusLoading(false);
      setBlockedReason(getSshBlockedReason(id));
      return;
    }

    let cancelled = false;

    const loadDeviceStatus = async () => {
      try {
        setStatusLoading(true);
        setBlockedReason('');
        const device = await apiRequest<DeviceLifecycleStatusResponse>(`/api/devices/${encodeURIComponent(id)}`);
        if (!cancelled) {
          setBlockedReason(getSshBlockedReason(id, device.status));
        }
      } catch {
        if (!cancelled) {
          setBlockedReason('');
        }
      } finally {
        if (!cancelled) {
          setStatusLoading(false);
        }
      }
    };

    void loadDeviceStatus();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!shouldRecordSshTerminalSession(embedded, id, blockedReason, statusLoading, sessionRecordedAssetIdRef.current)) {
      return;
    }

    let cancelled = false;

    const recordTerminalSession = async () => {
      try {
        await apiRequest('/api/ssh/session', {
          method: 'POST',
          body: JSON.stringify({ deviceId: id }),
        });
        if (!cancelled) {
          sessionRecordedAssetIdRef.current = id;
        }
      } catch {
        return;
      }
    };

    void recordTerminalSession();

    return () => {
      cancelled = true;
    };
  }, [blockedReason, embedded, id, statusLoading]);

  if (blockedReason) {
    return (
      <div className={`${embedded ? 'h-full' : 'min-h-screen'} bg-zinc-950 text-zinc-100`}>
        <div className={`mx-auto flex ${embedded ? 'h-full max-w-none flex-col px-0 py-0' : 'min-h-screen max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8'}`}>
          <div className="rounded-2xl border border-amber-700/60 bg-zinc-900/90 px-5 py-5 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">SSH Terminal</div>
            <h1 className="mt-2 text-2xl font-black text-white">Access blocked</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">{blockedReason}</p>
            {!embedded ? (
              <button type="button" onClick={() => navigate(-1)} className="mt-5 inline-flex items-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-zinc-800">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (statusLoading) {
    return (
      <div className={`${embedded ? 'h-full' : 'min-h-screen'} bg-zinc-950 text-zinc-100`}>
        <div className={`mx-auto flex ${embedded ? 'h-full max-w-none flex-col px-0 py-0' : 'min-h-screen max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8'}`}>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 px-5 py-5 text-sm text-zinc-300 shadow-sm">
            Checking SSH terminal access...
          </div>
        </div>
      </div>
    );
  }

  return <SshTerminalView assetId={id} embedded={embedded} onBack={embedded ? undefined : () => navigate(-1)} />;
}