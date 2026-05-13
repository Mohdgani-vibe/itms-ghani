export interface DeviceAlertRecord {
  id: string;
  source: string;
  severity: string;
  title: string;
  detail: string;
  acknowledged: boolean;
  resolved: boolean;
  createdAt: string;
}

export interface DevicePatchJobRecord {
  id: string;
  jid: string;
  status: string;
  scope: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DeviceTerminalSessionRecord {
  id: string;
  deviceId?: string;
  status: string;
  createdAt: string;
  requestedBy: string;
}

export interface DeviceVolumeRecord {
  name: string;
  path?: string | null;
  size?: string | null;
  filesystem?: string | null;
  device_type?: string | null;
  mountpoint?: string | null;
  available?: string | null;
  used_percent?: string | null;
  uuid?: string | null;
  parent?: string | null;
  encrypted?: boolean;
  encryption?: string | null;
}

export interface DeviceNetworkInterfaceRecord {
  mtu?: number | null;
  state?: string | null;
  mac?: string | null;
  addresses?: string[];
}

export interface DeviceNetworkSummaryItem {
  label: string;
  value: string;
}