import { useLocation, useParams, useNavigate } from 'react-router-dom';

import TerminalConsoleView from '../components/TerminalConsoleView';

export default function TerminalConsole() {
  const location = useLocation();
  const navigate = useNavigate();
  const { minionId = '' } = useParams();
  const embedded = new URLSearchParams(location.search).get('embedded') === '1';
  const prefilledCommand = new URLSearchParams(location.search).get('prefill')?.trim() || '';

  return <TerminalConsoleView key={minionId} minionId={minionId} embedded={embedded} prefilledCommand={prefilledCommand} onBack={embedded ? undefined : () => navigate(-1)} />;
}