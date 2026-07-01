# Patch Dashboard Component

A modern, responsive Patch Dashboard built with React for the ITMS (IT Management System).

## Features

- **Modern Design**: Clean UI with Public Sans font and precise color tokens
- **SVG Charts**: Custom donut charts and sparklines with no external dependencies
- **Responsive Layout**: Adapts to mobile/tablet/desktop (collapses at ~900px)
- **Empty States**: Graceful handling of zero data scenarios
- **Modular Components**: Reusable StatTile, ChartCard, TabSwitcher, etc.

## Files

- `PatchDashboard.tsx` - Main component with empty state (defaults to zeros)
- `PatchDashboardExample.tsx` - Example with sample data populated

## Components

### Main Layout
- **TopBar**: 60px sticky header with logo, nav, and user controls
- **IconRail**: 64px left sidebar with icon navigation
- **TabSwitcher**: Pill-based tab navigation with count badges

### Data Panels
- **SystemsSummary**: 3-tile stats grid (total/online/offline systems)
- **ChartsPanel**: Update activity across 3 time periods
- **ChartCard**: Donut chart + stats + sparkline per period
- **RecentUpdates**: List of recent completed updates

### Charts
- **DonutChart**: SVG donut with percentage in center
  - Calculated using: `dashoffset = circumference * (1 - rate/100)`
- **Sparkline**: SVG bar chart with peak highlighting
  - Tallest bar is primary blue, others are tint
  - Min bar height: 3px, gap: 2px (>12 bars) or 4px

## Usage

```tsx
import PatchDashboard from './pages/PatchDashboard';

// With empty state (all zeros)
<PatchDashboard />

// With data (customize the component)
const summary = { total: 248, online: 231, offline: 17 };
const charts = [
  {
    period: 'LAST 1 DAY',
    runs: 18,
    rate: 94,
    done: 17,
    failed: 1,
    trendLabel: 'RUNS PER HOUR',
    series: [2, 3, 1, 4, 3, 2, 5, 4, 3],
  },
  // ... more periods
];
```

## Data Shape

```typescript
interface SystemsSummary {
  total: number;
  online: number;
  offline: number;
}

interface ChartData {
  period: string;        // e.g., 'LAST 1 DAY'
  runs: number;          // Total completed runs
  rate: number;          // Success rate percentage
  done: number;          // Successful runs
  failed: number;        // Failed runs
  trendLabel: string;    // e.g., 'RUNS PER HOUR'
  series: number[];      // Sparkline data points
}

interface RecentUpdate {
  id: string;
  timestamp: string;
  system: string;
  status: 'success' | 'failed';
}
```

## Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| bg | `#f5f6f8` | Page background |
| surface | `#ffffff` | Card backgrounds |
| border | `#e6e8eb` | Primary borders |
| hairline | `#eef0f2` | Subtle dividers |
| text | `#1a1d21` | Primary text |
| muted | `#6b7280` | Secondary text |
| faint | `#9aa1ab` | Tertiary text |
| primary | `#2563eb` | Active elements |
| primary-tint | `#eef2ff` | Primary backgrounds |
| success | `#16a34a` | Success states |
| success-tint | `#f1fbf5` | Success backgrounds |
| success-border | `#bbe7cd` | Success borders |
| warning | `#b45309` | Warning states |
| warning-tint | `#fdfaf0` | Warning backgrounds |
| warning-border | `#f3e0b5` | Warning borders |
| danger | `#ef4444` | Error states |

## Responsive Behavior

- **Desktop (>900px)**: 3-column grid for charts and stats
- **Tablet/Mobile (<900px)**: Single column stack
- **Icon Rail**: Always 64px wide on left
- **Top Bar**: Always 60px tall, sticky

## Integration

To add to your routing:

```tsx
import PatchDashboard from './pages/PatchDashboard';

// In your routes
<Route path="/patch-dashboard-new" element={<PatchDashboard />} />
```

## Customization

All components accept inline styles or can be modified directly. The component uses:
- Tailwind CSS utility classes
- Inline styles for precise color control
- Lucide React icons
- No external chart libraries

## Example

See `PatchDashboardExample.tsx` for a fully populated dashboard with realistic sample data.
