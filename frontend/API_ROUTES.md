# ITMS API Routes Documentation

## API Base URL
- Local: `http://localhost:3001/api`
- Production: `http://10.10.20.203:3001/api`

## Authentication
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## 🔐 Authentication Endpoints

### POST /api/auth/login
Login with email and password
```typescript
{ email: string, password: string }
// Returns: { token: string, user: User } or { mfaRequired: true }
```

### POST /api/auth/login/verify-mfa
Verify MFA code after login
```typescript
{ email: string, code: string }
// Returns: { token: string, user: User }
```

### POST /api/auth/google
Login with Google ID token
```typescript
{ idToken: string, email: string }
// Returns: { token: string, user: User }
```

### GET /api/auth/me
Get current user info (requires auth)

### POST /api/auth/logout
Logout current session (requires auth)

---

## 👥 Users API

### GET /api/users
List all users with filters
```typescript
Query params: {
  page?: number
  page_size?: number
  entity?: string
  dept?: string
  location?: string
  role?: string | string[]
  status?: 'active' | 'inactive'
  search?: string
  department_label?: string
}
// Returns: { items: User[], total: number, page: number, pageSize: number, summary: {...} }
```

### GET /api/users/meta/options
Get meta options for user filters
```typescript
// Returns: { roles: [], entities: [], departments: [], locations: [] }
```

### GET /api/users/:id
Get single user by ID

### POST /api/users
Create new user (admin only)

### PATCH /api/users/:id
Update user (admin only)

### DELETE /api/users/:id
Deactivate user (admin only)

### GET /api/users/:id/assets
Get assets assigned to user

### GET /api/users/export
Export users to CSV

### POST /api/users/import
Import users from CSV

---

## 📦 Inventory API

### GET /api/inventory
List inventory items
```typescript
Query params: {
  page?: number
  page_size?: number
  category?: string
  status?: string
  branch_id?: string
  search?: string
}
// Returns: { items: InventoryItem[], total: number }
```

### POST /api/inventory
Create inventory item

### PATCH /api/inventory/:id
Update inventory item

### DELETE /api/inventory/:id
Delete inventory item

### POST /api/inventory/:id/allocate
Allocate item to user

### POST /api/inventory/:id/return
Return item from user

### POST /api/inventory/:id/retire
Retire inventory item

### GET /api/inventory/module/options
Get module options (branches, categories, etc.)

### GET /api/inventory/module/assets
List module assets

### GET /api/inventory/module/items
List stock items

### GET /api/inventory/module/sub-items
List sub-items

### GET /api/inventory/export
Export inventory to CSV

### POST /api/inventory/import
Import inventory from CSV

---

## 🚨 Alerts API

### GET /api/alerts/dashboard
Get alerts dashboard summary
```typescript
// Returns: {
//   summary: { total, critical, high, medium, low, acknowledged, resolved },
//   by_source: [],
//   by_severity: [],
//   recent: Alert[]
// }
```

### GET /api/alerts
List all alerts
```typescript
Query params: {
  page?: number
  page_size?: number
  source?: string (wazuh, openscap, clamav)
  severity?: string
  acknowledged?: boolean
  resolved?: boolean
  search?: string
}
// Returns: { items: Alert[], total: number }
```

### PUT /api/alerts/:id/acknowledge
Acknowledge an alert

### PUT /api/alerts/:id/resolve
Resolve an alert

### GET /api/me/alerts/dashboard
Get my alerts dashboard (employee view)

### GET /api/me/alerts
List my alerts (employee view)

---

## 🔧 Patch Management API

### GET /api/patch/dashboard
Get patch dashboard summary
```typescript
// Returns: {
//   summary: { total_devices, pending_updates, up_to_date, last_scan },
//   by_department: [],
//   by_os: [],
//   recent_patches: []
// }
```

### GET /api/patch/devices
List devices with patch status
```typescript
Query params: {
  page?: number
  page_size?: number
  department?: string
  os?: string
  status?: string
  search?: string
}
// Returns: { items: PatchDevice[], total: number }
```

### GET /api/patch/jobs
List patch jobs

### POST /api/patch/run
Run patch update on target
```typescript
{ target: string, patches?: string[] }
// Returns: { job_id: string }
```

### GET /api/patch/reports
List patch run reports

### GET /api/patch/reports/:id
Get single patch report

### POST /api/patch/reports
Create patch report

---

## 📋 Requests API

### GET /api/requests
List all requests (IT team view)
```typescript
Query params: {
  page?: number
  page_size?: number
  type?: string
  status?: string
  priority?: string
  assignee?: string
  search?: string
}
// Returns: { items: Request[], total: number }
```

### PUT /api/requests/:id/status
Update request status
```typescript
{ status: string }
```

### POST /api/requests/:id/assign
Assign request to user
```typescript
{ assignee_id: string }
```

### GET /api/me/requests
List my requests (employee view)

### POST /api/me/requests
Create new request
```typescript
{ title: string, type: string, description: string, priority?: string }
```

### GET /api/me/requests/:id
Get my request details

### POST /api/me/requests/:id/comment
Add comment to my request
```typescript
{ comment: string }
```

---

## 💻 Assets/Devices API

### GET /api/devices
List all devices (legacy compat endpoint)

### GET /api/devices/:id
Get device details (legacy compat endpoint)

### GET /api/devices/:id/alerts
Get device alerts

### GET /api/assets
List all assets
```typescript
Query params: {
  page?: number
  page_size?: number
  category?: string
  entity?: string
  department?: string
  location?: string
  status?: string
  is_compute?: boolean
  search?: string
}
```

### POST /api/assets
Create asset

### GET /api/assets/:id
Get asset details

### PATCH /api/assets/:id
Update asset

### DELETE /api/assets/:id
Delete asset

### POST /api/assets/:id/assign
Assign asset to user

### POST /api/assets/:id/unassign
Unassign asset

### GET /api/assets/:id/history
Get asset history

### GET /api/assets/:id/alerts
Get asset alerts

### GET /api/me/assets
Get my assigned assets (employee view)

---

## 🎫 Gatepass API

### GET /api/gatepass
List gatepasses

### POST /api/gatepass
Create gatepass

### PUT /api/gatepass/:id/approve
Approve gatepass

### PUT /api/gatepass/:id/reject
Reject gatepass

### POST /api/gatepass/:id/complete
Mark gatepass complete

---

## 📢 Announcements API

### GET /api/announcements
List announcements

### POST /api/announcements
Create announcement (admin only)

### POST /api/announcements/:id/read
Mark announcement as read

---

## 💬 Chat API

### GET /api/chat/channels
List chat channels

### POST /api/chat/channels
Create chat channel

### POST /api/chat/channels/:id/members
Add members to channel

### DELETE /api/chat/channels/:id/members/:userId
Remove member from channel

### PUT /api/chat/channels/:id/close
Close channel

### GET /api/chat/channels/:id/messages
List channel messages

---

## 📚 Documentation API

### GET /api/docs/categories
List doc categories

### POST /api/docs/categories
Create doc category

### GET /api/docs/pages
List doc pages

### GET /api/docs/pages/:id
Get doc page

### POST /api/docs/pages
Create doc page

### PUT /api/docs/pages/:id
Update doc page

### DELETE /api/docs/pages/:id
Delete doc page

---

## 🔐 Vault API

### GET /api/vault
List vault credentials

### POST /api/vault
Create vault credential

### POST /api/vault/:id/reveal
Reveal credential value

### DELETE /api/vault/:id
Delete credential

### GET /api/vault/:id/access-log
Get credential access log

---

## 🖥️ Terminal/SSH API

### GET /api/terminal/targets/:minionId
Get terminal target info

### POST /api/terminal/targets/:minionId/execute
Execute shell command

### POST /api/terminal/targets/:minionId/function
Execute Salt function

### GET /api/ssh/assets/:id
Get SSH target info

### POST /api/ssh/session
Create SSH session

---

## 🧂 Salt Workspace API

### GET /api/salt/workspace
Get Salt workspace status

### GET /api/salt/workspace/templates
Get workspace templates

### PUT /api/salt/workspace/templates
Update workspace templates

### POST /api/salt/workspace/execute
Execute Salt action

---

## 🏢 Organization API

### GET /api/entities
List entities

### PATCH /api/entities/:id
Update entity

### GET /api/locations
List locations

### POST /api/locations
Create location

### PATCH /api/locations/:id
Update location

### GET /api/departments
List departments

### POST /api/departments
Create department

### PATCH /api/departments/:id
Update department

### DELETE /api/departments/:id
Delete department

---

## 📊 Settings & Audit

### GET /api/settings/workflow
Get workflow settings

### PUT /api/settings/workflow
Update workflow settings

### GET /api/audit
List audit logs

### GET /api/audit/:id
Get audit log entry

### GET /api/audit/export
Export audit logs

---

## 🔌 WebSocket Endpoints

### WS /ws/chat
Real-time chat websocket

### WS /ws/announcements
Real-time announcements websocket

### WS /ws/ssh/assets/:id
SSH session websocket

---

## Usage Examples

### Fetch Users with Filters
```typescript
import { fetchUsers } from './lib/usersApi';

const users = await fetchUsers({
  page: 1,
  page_size: 20,
  role: 'it_team',
  status: 'active',
  search: 'john'
});
```

### Fetch Alerts Dashboard
```typescript
import { fetchAlertsDashboard } from './lib/alertsApi';

const dashboard = await fetchAlertsDashboard();
console.log(dashboard.summary.critical); // Number of critical alerts
```

### Create Request
```typescript
import { createMyRequest } from './lib/requestsApi';

const request = await createMyRequest({
  title: 'Need new laptop',
  type: 'Laptop change',
  description: 'Current laptop battery is failing',
  priority: 'High'
});
```

### Fetch Inventory Items
```typescript
import { fetchInventory } from './lib/inventoryApi';

const inventory = await fetchInventory({
  category: 'Laptop',
  status: 'In stock',
  branch_id: '123'
});
```
