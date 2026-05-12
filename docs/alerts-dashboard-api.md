# Alerts Dashboard API

The Alerts dashboard now uses a dedicated backend summary endpoint for Wazuh, Hardening / OpenSCAP, and ClamScan.

## Endpoints

- `GET /api/alerts/dashboard?source=wazuh`
- `GET /api/me/alerts/dashboard?source=wazuh`

`source` supports `wazuh`, `openscap`, and `clamav`.

## Response Shape

```json
{
  "source": "wazuh",
  "sourceLabel": "Wazuh",
  "filters": {
    "department": "",
    "search": "",
    "status": "all"
  },
  "moduleCards": [
    {
      "source": "wazuh",
      "label": "Wazuh Alerts",
      "moduleLabel": "Wazuh",
      "totalSystemsScanned": 42,
      "cleanSystemsCount": 31,
      "errorSystemsCount": 11,
      "lastUpdated": "2026-05-02T08:42:15Z",
      "statusColor": "yellow"
    },
    {
      "source": "openscap",
      "label": "Hardening / OpenSCAP Alerts",
      "moduleLabel": "Hardening / OpenSCAP",
      "totalSystemsScanned": 38,
      "cleanSystemsCount": 29,
      "errorSystemsCount": 9,
      "lastUpdated": "2026-05-02T07:10:00Z",
      "statusColor": "yellow"
    },
    {
      "source": "clamav",
      "label": "ClamScan Alerts",
      "moduleLabel": "ClamScan",
      "totalSystemsScanned": 35,
      "cleanSystemsCount": 34,
      "errorSystemsCount": 1,
      "lastUpdated": "2026-05-02T06:55:11Z",
      "statusColor": "yellow"
    }
  ],
  "trend": {
    "dailyBuckets": [
      { "date": "2026-04-26", "count": 1 },
      { "date": "2026-04-27", "count": 0 },
      { "date": "2026-04-28", "count": 3 },
      { "date": "2026-04-29", "count": 2 },
      { "date": "2026-04-30", "count": 4 },
      { "date": "2026-05-01", "count": 2 },
      { "date": "2026-05-02", "count": 1 }
    ],
    "last7DaysTotal": 13,
    "previous7Days": 9,
    "trendDirection": "up",
    "trendDelta": 4,
    "trendPercent": 44.4
  },
  "departments": [
    {
      "key": "IT Operations",
      "name": "IT Operations",
      "totalSystems": 10,
      "cleanCount": 8,
      "errorCount": 2,
      "lastUpdated": "2026-05-02T08:42:15Z"
    }
  ],
  "systems": [
    {
      "key": "asset-001",
      "assetId": "asset-001",
      "assetTag": "LAP-0001",
      "hostname": "itms-laptop-01",
      "username": "Asha Kumar",
      "userEmail": "asha@example.com",
      "department": "IT Operations",
      "module": "wazuh",
      "moduleLabel": "Wazuh",
      "status": "error",
      "errorCount": 3,
      "errorDetails": [
        "Authentication failure threshold exceeded",
        "Unexpected privileged command execution"
      ],
      "lastScanAt": "2026-05-02T08:42:15Z",
      "latestAlertId": "5d2254f9-b63a-4c8a-b301-7b3df96fbd18",
      "latestTitle": "Authentication failure threshold exceeded",
      "latestDetail": "Five failed logins were detected in the last 10 minutes."
    }
  ],
  "report": {
    "generatedAt": "2026-05-02T08:45:00Z",
    "departmentSummary": [],
    "systemStatuses": [],
    "errorDetails": [],
    "last7DaysTrend": {
      "dailyBuckets": [],
      "last7DaysTotal": 13,
      "previous7Days": 9,
      "trendDirection": "up",
      "trendDelta": 4,
      "trendPercent": 44.4
    },
    "module": "wazuh",
    "moduleLabel": "Wazuh",
    "selectedDepartment": ""
  }
}
```

## Frontend Usage

- The top Alerts hero uses `moduleCards` for summary cards.
- The source dashboard uses `trend`, `departments`, `systems`, and `report`.
- CSV export uses `systems` or `report.systemStatuses`.
- PDF export uses the `report` block.