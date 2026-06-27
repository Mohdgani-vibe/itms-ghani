import { useState } from 'react';
import { Wrench, X, Calendar } from 'lucide-react';
import { apiRequest } from '../../lib/api';

interface MaintenancePanelProps {
  deviceId: string;
  maintenanceUntil?: string | null;
  onMaintenanceUpdated: (maintenanceUntil: string | null) => void;
  canOperate: boolean;
}

export default function MaintenancePanel({ deviceId, maintenanceUntil, onMaintenanceUpdated, canOperate }: MaintenancePanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isInMaintenance = maintenanceUntil && new Date(maintenanceUntil) > new Date();

  const handleSetMaintenance = async (duration: string) => {
    try {
      setSaving(true);
      setError('');
      
      let targetDate: string;
      if (duration === 'custom' && customDate) {
        targetDate = new Date(customDate).toISOString();
      } else {
        const now = new Date();
        now.setHours(now.getHours() + parseInt(duration));
        targetDate = now.toISOString();
      }

      await apiRequest(`/api/assets/${deviceId}/maintenance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maintenance_until: targetDate }),
      });

      onMaintenanceUpdated(targetDate);
      setIsEditing(false);
      setCustomDate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set maintenance mode');
    } finally {
      setSaving(false);
    }
  };

  const handleClearMaintenance = async () => {
    try {
      setSaving(true);
      setError('');

      await apiRequest(`/api/assets/${deviceId}/maintenance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maintenance_until: null }),
      });

      onMaintenanceUpdated(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear maintenance mode');
    } finally {
      setSaving(false);
    }
  };

  const formatMaintenanceUntil = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffMs < 0) return 'Expired';
    if (diffHours < 1) return `${diffMins} minutes remaining`;
    if (diffHours < 24) return `${diffHours} hours ${diffMins} minutes remaining`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ${diffHours % 24} hours remaining`;
  };

  if (!canOperate) {
    return isInMaintenance ? (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <Wrench className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-amber-900">Maintenance Mode Active</div>
            <div className="text-sm text-amber-700 mt-1">
              Until: {new Date(maintenanceUntil).toLocaleString()}
            </div>
            <div className="text-xs text-amber-600 mt-0.5">
              {formatMaintenanceUntil(maintenanceUntil)}
            </div>
          </div>
        </div>
      </div>
    ) : null;
  }

  return (
    <div className="space-y-3">
      {isInMaintenance && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <Wrench className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-amber-900">Maintenance Mode Active</div>
              <div className="text-sm text-amber-700 mt-1">
                Until: {new Date(maintenanceUntil).toLocaleString()}
              </div>
              <div className="text-xs text-amber-600 mt-0.5">
                {formatMaintenanceUntil(maintenanceUntil)}
              </div>
              <div className="text-xs text-amber-600 mt-2">
                Alerts are suppressed while in maintenance mode
              </div>
            </div>
            <button
              onClick={handleClearMaintenance}
              disabled={saving}
              className="inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              <X className="h-3 w-3 mr-1" />
              End Maintenance
            </button>
          </div>
        </div>
      )}

      {!isInMaintenance && (
        <>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50"
            >
              <Wrench className="mr-2 h-4 w-4" />
              Enable Maintenance Mode
            </button>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Set Maintenance Window</div>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setError('');
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="text-xs text-slate-600">
                Alerts will be suppressed during the maintenance window
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-700">Quick Duration:</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSetMaintenance('1')}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    1 Hour
                  </button>
                  <button
                    onClick={() => handleSetMaintenance('2')}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    2 Hours
                  </button>
                  <button
                    onClick={() => handleSetMaintenance('4')}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    4 Hours
                  </button>
                  <button
                    onClick={() => handleSetMaintenance('8')}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    8 Hours
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-700">Or specify exact time:</div>
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                  <button
                    onClick={() => handleSetMaintenance('custom')}
                    disabled={saving || !customDate}
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center"
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    Set
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-xs text-rose-700 bg-rose-50 px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
