import { Activity, MonitorSmartphone, Package, ShieldCheck, type LucideIcon } from 'lucide-react';
import { inferBootstrapPlatform } from '../../lib/bootstrap';

export interface DeviceDetailItem {
  label: string;
  value: string;
}

export interface DeviceOverviewCard {
  label: string;
  value: string;
  icon: LucideIcon;
}

export interface DeviceToolStatusEntry {
  status?: 'linked' | 'detected' | 'installed' | 'missing';
  detail?: string | null;
  identifier?: string | null;
  connected?: boolean | null;
}

export interface DeviceRemoteToolStatus {
  label: string;
  status?: DeviceToolStatusEntry;
}

interface DeviceUserSummary {
  fullName?: string | null;
}

interface DeviceNetworkSummary {
  wired_ip?: string | null;
  wireless_ip?: string | null;
  netbird_ip?: string | null;
  gateway?: string | null;
  dns?: string | null;
}

interface DeviceVolumeSummary {
  encrypted?: boolean | null;
}

interface DeviceToolStatusSummary {
  salt?: DeviceToolStatusEntry;
  wazuh?: DeviceToolStatusEntry;
  openscap?: DeviceToolStatusEntry;
  clamav?: DeviceToolStatusEntry;
}

interface DeviceDetailViewDataDevice {
  manufacturer?: string | null;
  model?: string | null;
  deviceType?: string | null;
  processor?: string | null;
  gpu?: string | null;
  memory?: string | null;
  storage?: string | null;
  architecture?: string | null;
  serialNumber?: string | null;
  macAddress?: string | null;
  biosVersion?: string | null;
  warrantyExpiresAt?: string | null;
  osName?: string | null;
  osVersion?: string | null;
  osBuild?: string | null;
  kernelVersion?: string | null;
  display?: string | null;
  hostname: string;
  loggedInUsers?: string[] | null;
  status: string;
  lastBootAt?: string | null;
  lastSeenAt?: string | null;
  assetId: string;
  glpiId?: number | null;
  anydeskId?: string | null;
  rustdeskId?: string | null;
  saltMinionId?: string | null;
  wazuhAgentId?: string | null;
  network?: DeviceNetworkSummary | null;
  toolStatus?: DeviceToolStatusSummary | null;
  volumes?: DeviceVolumeSummary[] | null;
  patchStatus?: string;
  alertStatus?: string;
  complianceScore: number;
  user?: DeviceUserSummary | null;
}

interface BuildDeviceDetailViewDataInput {
  device: DeviceDetailViewDataDevice;
  computeAsset: boolean;
  installedAppCount: number;
  sshTerminalReady: boolean;
  formatDate: (value?: string | null) => string;
  formatDetailValue: (value?: string | null, fallback?: string) => string;
}

export function buildDeviceDetailViewData({
  device,
  computeAsset,
  installedAppCount,
  sshTerminalReady,
  formatDate,
  formatDetailValue,
}: BuildDeviceDetailViewDataInput) {
  const formatStatusValue = (value?: string | null) => {
    const normalizedValue = (value || '').trim();
    return normalizedValue ? normalizedValue.replaceAll('_', ' ') : 'Unknown';
  };
  const sshTarget = device.network?.netbird_ip || device.network?.wired_ip || device.network?.wireless_ip || device.hostname;
  const hardwareDetails: DeviceDetailItem[] = [
    { label: 'Manufacturer', value: formatDetailValue(device.manufacturer, 'Unknown') },
    { label: 'Model', value: formatDetailValue(device.model, 'Unknown') },
    { label: 'Device Type', value: formatDetailValue(device.deviceType, 'Device') },
    { label: 'Hardware Profile', value: formatDetailValue(device.model || device.manufacturer ? [device.manufacturer, device.model].filter(Boolean).join(' ') : device.model, device.model || 'Standard managed asset') },
    { label: 'Processor', value: formatDetailValue(device.processor) },
    { label: 'GPU', value: formatDetailValue(device.gpu) },
    { label: 'Memory', value: formatDetailValue(device.memory) },
    { label: 'Storage', value: formatDetailValue(device.storage) },
    { label: 'Architecture', value: formatDetailValue(device.architecture) },
    { label: 'Serial Number', value: formatDetailValue(device.serialNumber, 'Unavailable') },
    { label: 'MAC Address', value: formatDetailValue(device.macAddress) },
    { label: 'BIOS / Firmware', value: formatDetailValue(device.biosVersion) },
    { label: 'Warranty', value: formatDate(device.warrantyExpiresAt) },
  ];
  const operatingSystemDetails: DeviceDetailItem[] = [
    { label: 'Platform', value: inferBootstrapPlatform(device.osName) },
    { label: 'OS Name', value: formatDetailValue(device.osName, 'Unknown') },
    { label: 'OS Version', value: formatDetailValue(device.osVersion, 'Unknown') },
    { label: 'OS Build', value: formatDetailValue(device.osBuild) },
    { label: 'Kernel Version', value: formatDetailValue(device.kernelVersion) },
    { label: 'Display', value: formatDetailValue(device.display) },
    { label: 'Hostname', value: formatDetailValue(device.hostname) },
    { label: 'Logged In Users', value: device.loggedInUsers?.length ? device.loggedInUsers.join(', ') : 'Not reported' },
    { label: 'Installed Software', value: `${installedAppCount}` },
    { label: 'Status', value: formatDetailValue(device.status) },
    { label: 'Last Boot', value: formatDate(device.lastBootAt) },
    { label: 'Last Seen', value: formatDate(device.lastSeenAt) },
  ];
  const remoteIdentifierDetails: DeviceDetailItem[] = [
    { label: 'Asset ID', value: formatDetailValue(device.assetId) },
    { label: 'GLPI ID', value: device.glpiId ? String(device.glpiId) : 'Not linked' },
    { label: 'AnyDesk ID', value: formatDetailValue(device.anydeskId, 'Not reported') },
    { label: 'RustDesk ID', value: formatDetailValue(device.rustdeskId, 'Not reported') },
    { label: 'Salt Minion ID', value: formatDetailValue(device.saltMinionId, 'Not linked') },
    { label: 'Wazuh Agent ID', value: formatDetailValue(device.wazuhAgentId, 'Not linked') },
    { label: 'NetBird IP', value: formatDetailValue(device.network?.netbird_ip, 'Not linked') },
    { label: 'SSH Target', value: formatDetailValue(sshTarget, 'Unavailable') },
    { label: 'Serial Number', value: formatDetailValue(device.serialNumber, 'Unavailable') },
    { label: 'Hostname', value: formatDetailValue(device.hostname) },
  ];
  const remoteToolStatuses: DeviceRemoteToolStatus[] = [
    { label: 'Salt', status: device.toolStatus?.salt },
    { label: 'Wazuh', status: device.toolStatus?.wazuh },
    { label: 'OpenSCAP', status: device.toolStatus?.openscap },
    { label: 'ClamScan', status: device.toolStatus?.clamav },
    { label: 'SSH', status: { status: sshTerminalReady ? 'installed' : 'missing', detail: sshTerminalReady ? `SSH terminal can use ${sshTarget}` : 'SSH server integration is not configured' } },
  ];
  const networkSummaryItems: DeviceDetailItem[] = [
    { label: 'Wired IP', value: formatDetailValue(device.network?.wired_ip) },
    { label: 'Wireless IP', value: formatDetailValue(device.network?.wireless_ip) },
    { label: 'NetBird IP', value: formatDetailValue(device.network?.netbird_ip) },
    { label: 'Gateway', value: formatDetailValue(device.network?.gateway) },
    { label: 'DNS', value: formatDetailValue(device.network?.dns) },
  ];
  const encryptedVolumeCount = device.volumes?.filter((volume) => volume.encrypted).length || 0;
  const overviewCards: DeviceOverviewCard[] = [
    { label: 'Status', value: device.status, icon: MonitorSmartphone },
    ...(computeAsset
      ? [
          { label: 'Patch Status', value: formatStatusValue(device.patchStatus), icon: Package },
          { label: 'Alert Status', value: formatStatusValue(device.alertStatus), icon: ShieldCheck },
          { label: 'Compliance', value: `${device.complianceScore}%`, icon: Activity },
        ]
      : [
          { label: 'Asset Type', value: device.deviceType || 'Accessory', icon: Package },
          { label: 'Assigned To', value: device.user?.fullName || 'Unassigned', icon: ShieldCheck },
          { label: 'Warranty', value: formatDate(device.warrantyExpiresAt), icon: Activity },
        ]),
  ];

  return {
    encryptedVolumeCount,
    hardwareDetails,
    networkSummaryItems,
    operatingSystemDetails,
    overviewCards,
    remoteIdentifierDetails,
    remoteToolStatuses,
  };
}