import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw, ShieldCheck, TerminalSquare } from 'lucide-react';
import { FitAddon } from 'xterm-addon-fit';
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';

import { apiRequest, resolveWebSocketUrl } from '../lib/api';
import { getStoredSession } from '../lib/session';

interface SSHTargetResponse {
  assetId: string;
  assetTag: string;
  hostname: string;
  address: string;
  username: string;
  usernames?: string[];
  port: number;
  reachable: boolean;
  keyFingerprint?: string;
}

interface SSHMessage {
  type: string;
  data?: string;
  message?: string;
  username?: string;
}

interface SshTerminalViewProps {
  assetId: string;
  embedded?: boolean;
  onBack?: () => void;
}

function encodeProtocolToken(token: string) {
  return btoa(token).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function sshSocketProtocols(token: string) {
  return ['itms.ssh.v1', `bearer.${encodeProtocolToken(token)}`];
}

function buildSshSocketUrl(assetId: string) {
  return new URL(resolveWebSocketUrl(`/ws/ssh/assets/${encodeURIComponent(assetId)}`), window.location.origin).toString();
}

export default function SshTerminalView({ assetId, embedded = false, onBack }: SshTerminalViewProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [target, setTarget] = useState<SSHTargetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [connectionNonce, setConnectionNonce] = useState(0);
  const targetAddress = target?.address || '';
  const targetPort = target?.port || 0;

  const reconnectSession = () => {
    setError('');
    setConnected(false);
    setConnectionNonce((current) => current + 1);
  };

  useEffect(() => {
    let cancelled = false;

    const loadTarget = async () => {
      try {
        setLoading(true);
        setError('');
        setConnected(false);
        const data = await apiRequest<SSHTargetResponse>(`/api/ssh/assets/${encodeURIComponent(assetId)}`);
        if (!cancelled) {
          setTarget(data);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Failed to load SSH target');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (assetId) {
      void loadTarget();
    } else {
      setLoading(false);
      setError('SSH target is missing.');
    }

    return () => {
      cancelled = true;
    };
  }, [assetId]);

  useEffect(() => {
    if (!shellRef.current || !targetAddress || !targetPort) {
      return;
    }

    const session = getStoredSession();
    if (!session?.token) {
      setError('Your session has expired. Sign in again.');
      return;
    }

    setError('');
    setConnected(false);

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
      fontSize: 14,
      theme: {
        background: '#09090b',
        foreground: '#f4f4f5',
        cursor: '#34d399',
        selectionBackground: 'rgba(52, 211, 153, 0.28)',
      },
      scrollback: 3000,
      allowProposedApi: false,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(shellRef.current);
    fitAddon.fit();
    terminal.focus();
    terminal.writeln(`Connecting to ${target?.username || ''}@${targetAddress}:${targetPort}...`);

    const socket = new WebSocket(buildSshSocketUrl(assetId), sshSocketProtocols(session.token));
    socketRef.current = socket;
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const sendResize = () => {
      if (socket.readyState !== WebSocket.OPEN) {
        return;
      }
      socket.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
    };

    socket.onopen = () => {
      setConnected(true);
      sendResize();
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as SSHMessage;
        if (message.type === 'output' && message.data) {
          terminal.write(message.data);
          return;
        }
        if (message.type === 'ready') {
          terminal.writeln('');
          terminal.writeln(message.message || 'SSH session ready.');
          return;
        }
        if (message.type === 'error') {
          terminal.writeln('');
          terminal.writeln(`ERROR: ${message.message || 'SSH session error.'}`);
          setError(message.message || 'SSH session error.');
          return;
        }
        if (message.type === 'exit') {
          terminal.writeln('');
          terminal.writeln(message.message || 'SSH session closed.');
          setConnected(false);
        }
      } catch {
        terminal.write(typeof event.data === 'string' ? event.data : '');
      }
    };

    socket.onerror = () => {
      setError('SSH websocket connection failed.');
      setConnected(false);
    };

    socket.onclose = () => {
      setConnected(false);
      terminal.writeln('');
      terminal.writeln('SSH connection closed.');
    };

    const inputDisposable = terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    const handleWindowResize = () => {
      fitAddon.fit();
      sendResize();
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      inputDisposable.dispose();
      resizeDisposable.dispose();
      socket.close();
      terminal.dispose();
      socketRef.current = null;
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [assetId, connectionNonce, target?.username, targetAddress, targetPort]);

  return (
    <div className={`${embedded ? 'h-full' : 'min-h-screen'} bg-zinc-950 text-zinc-100`}>
      <div className={`mx-auto flex ${embedded ? 'h-full max-w-none flex-col px-0 py-0' : 'min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8'}`}>
        {!embedded ? (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-5 py-4 shadow-sm backdrop-blur">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-emerald-400">
                <TerminalSquare className="h-4 w-4" /> SSH Terminal
              </div>
              <h1 className="mt-2 truncate text-2xl font-black text-white">{target?.hostname || 'SSH Terminal'}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
                <span>{target?.assetTag || 'Asset pending'}</span>
                <span>{target ? `${target.username}@${target.address}:${target.port}` : 'Connecting...'}</span>
                <span className={connected ? 'text-emerald-400' : 'text-amber-400'}>{connected ? 'Connected' : loading ? 'Connecting' : 'Disconnected'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={reconnectSession} disabled={loading || !targetAddress || !targetPort} className="inline-flex items-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60">
                <RotateCcw className="mr-2 h-4 w-4" /> Reconnect
              </button>
              {onBack ? (
                <button type="button" onClick={onBack} className="inline-flex items-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-zinc-800">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {embedded ? (
          <div className="mb-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-300">
                <span className="font-semibold text-white">{target?.hostname || 'SSH Terminal'}</span>
                <span>{target?.assetTag || 'Asset pending'}</span>
                <span className="break-all">{target ? `${target.username}@${target.address}:${target.port}` : 'Connecting...'}</span>
                <span className={connected ? 'text-emerald-400' : 'text-amber-400'}>{connected ? 'Connected' : loading ? 'Connecting' : 'Disconnected'}</span>
              </div>
              <button type="button" onClick={reconnectSession} disabled={loading || !targetAddress || !targetPort} className="inline-flex items-center rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60">
                <RotateCcw className="mr-2 h-4 w-4" /> Reconnect
              </button>
            </div>
            {error ? <div className="mt-3 rounded-xl border border-rose-900 bg-rose-950/60 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
          </div>
        ) : null}

        <div className={`grid min-h-0 flex-1 gap-5 ${embedded ? 'grid-cols-1' : 'mt-5 lg:grid-cols-[320px_minmax(0,1fr)]'}`}>
          {!embedded ? (
          <aside className="min-h-0 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> SSH Session
            </div>
            <div className="mt-4 space-y-3 text-sm text-zinc-300">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Access</div>
                <div className="mt-1">Server-side SSH with shared key authentication.</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Endpoint</div>
                <div className="mt-1 break-all">{target ? `${target.username}@${target.address}:${target.port}` : 'Loading target...'}</div>
              </div>
              {target?.usernames?.length ? (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Username Candidates</div>
                  <div className="mt-1 break-all">{target.usernames.join(', ')}</div>
                </div>
              ) : null}
              {target?.keyFingerprint ? (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Configured Key</div>
                  <div className="mt-1 break-all text-xs text-zinc-400">{target.keyFingerprint}</div>
                </div>
              ) : null}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Mode</div>
                <div className="mt-1">Interactive PTY shell streamed over websocket.</div>
              </div>
            </div>
            {error ? <div className="mt-5 rounded-xl border border-rose-900 bg-rose-950/60 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
          </aside>
          ) : null}

          <section className="min-h-0 overflow-hidden rounded-2xl border border-zinc-800 bg-[#09090b] shadow-sm">
            <div ref={shellRef} className={`${embedded ? 'h-full min-h-[680px]' : 'h-[72vh]'} w-full px-4 py-4`} />
          </section>
        </div>
      </div>
    </div>
  );
}