import { AlertTriangle, ArrowRight, Bug, CircleCheckBig, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

import { renderAlertTitle } from './AlertsDisplay';
import type { AlertsClamAVTrend, AlertsListRecord } from './types';

interface ClamScanSummaryPanelProps {
	alerts: AlertsListRecord[];
	basePath: string;
	trend?: AlertsClamAVTrend;
	readOnlyReview?: boolean;
	onSelectAlert: (alert: AlertsListRecord) => void;
}

function normalizeSeverity(value?: string) {
	return (value || '').trim().toLowerCase();
}

function severityBucket(value?: string) {
	const severity = normalizeSeverity(value);
	if (severity === 'critical') {
		return 'critical';
	}
	if (severity === 'high' || severity === 'warning') {
		return 'high';
	}
	if (severity === 'medium') {
		return 'medium';
	}
	if (severity === 'low' || severity === 'info') {
		return 'low';
	}
	return 'unknown';
}

export function ClamScanSummaryPanel({ alerts, basePath, trend, readOnlyReview = false, onSelectAlert }: ClamScanSummaryPanelProps) {
	const criticalCount = alerts.filter((alert) => {
		const severity = normalizeSeverity(alert.severity);
		return severity === 'critical' || severity === 'high';
	}).length;
	const openCount = alerts.filter((alert) => !alert.resolved).length;
	const acknowledgedCount = alerts.filter((alert) => alert.acknowledged && !alert.resolved).length;
	const resolvedCount = alerts.filter((alert) => alert.resolved).length;
	const cleanCount = alerts.filter((alert) => normalizeSeverity(alert.severity) === 'info' || /clean/i.test(renderAlertTitle(alert))).length;
	const severitySummary = [
		{ label: 'Critical', key: 'critical', value: alerts.filter((alert) => severityBucket(alert.severity) === 'critical').length, tone: 'bg-rose-600' },
		{ label: 'High', key: 'high', value: alerts.filter((alert) => severityBucket(alert.severity) === 'high').length, tone: 'bg-orange-500' },
		{ label: 'Medium', key: 'medium', value: alerts.filter((alert) => severityBucket(alert.severity) === 'medium').length, tone: 'bg-amber-400' },
		{ label: 'Low / Clean', key: 'low', value: alerts.filter((alert) => severityBucket(alert.severity) === 'low').length, tone: 'bg-blue-500' },
	];
	const severityTotal = severitySummary.reduce((sum, item) => sum + item.value, 0) || 1;
	const responseSummary = [
		{ label: 'Open', value: openCount, tone: 'border-rose-200 bg-rose-50 text-rose-700' },
		{ label: 'Acknowledged', value: acknowledgedCount, tone: 'border-blue-200 bg-blue-50 text-blue-700' },
		{ label: 'Resolved', value: resolvedCount, tone: 'border-blue-200 bg-blue-50 text-blue-700' },
	];
	const latestFindings = alerts.slice(0, 3);
	const trendSummary = [
		{ label: '24h', value: trend?.last24Hours ?? 0 },
		{ label: '7d', value: trend?.last7Days ?? 0 },
		{ label: '30d', value: trend?.last30Days ?? 0 },
	];
	const trendMax = Math.max(1, ...(trend?.dailyBuckets ?? []).map((bucket) => bucket.count));

	return (
		<section className="overflow-hidden rounded-[24px] border border-blue-200 bg-white shadow-sm">
			<div className="bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_32%),linear-gradient(135deg,_#f7fbff_0%,_#ffffff_55%,_#eef4ff_100%)] px-5 py-5">
				<div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
					<div className="max-w-3xl">
						<div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-blue-700">
							<ShieldAlert className="mr-2 h-3.5 w-3.5" />
							ClamScan Focus
						</div>
						<h2 className="mt-3 text-2xl font-black tracking-tight text-zinc-950">Malware Review Dashboard</h2>
						<p className="mt-2 text-sm leading-6 text-zinc-600">
							{readOnlyReview
								? 'Review the most recent ClamScan findings, prioritize active detections, and open the linked asset context for evidence without taking remediation actions here.'
								: 'Review the most recent ClamScan findings, prioritize active detections, and jump into the linked asset workflow or terminal investigation path.'}
						</p>
					</div>

					<div className="grid grid-cols-2 gap-3 xl:min-w-[440px] xl:grid-cols-4">
						<div className="rounded-2xl border border-white/90 bg-white/90 px-4 py-4 shadow-sm">
							<div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
								<ShieldAlert className="h-3.5 w-3.5 text-blue-600" />
								Total Findings
							</div>
							<div className="mt-2 text-3xl font-black text-zinc-950">{alerts.length}</div>
						</div>
						<div className="rounded-2xl border border-white/90 bg-white/90 px-4 py-4 shadow-sm">
							<div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
								<AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
								High Priority
							</div>
							<div className="mt-2 text-3xl font-black text-zinc-950">{criticalCount}</div>
						</div>
						<div className="rounded-2xl border border-white/90 bg-white/90 px-4 py-4 shadow-sm">
							<div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
								<Bug className="h-3.5 w-3.5 text-amber-600" />
								Open Findings
							</div>
							<div className="mt-2 text-3xl font-black text-zinc-950">{openCount}</div>
						</div>
						<div className="rounded-2xl border border-white/90 bg-white/90 px-4 py-4 shadow-sm">
							<div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
								<CircleCheckBig className="h-3.5 w-3.5 text-blue-600" />
								Clean Signals
							</div>
							<div className="mt-2 text-3xl font-black text-zinc-950">{cleanCount}</div>
						</div>
					</div>
				</div>

				<div className="mt-5 rounded-[22px] border border-blue-100 bg-white/80 p-4 shadow-sm">
					<div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
						<div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm">
							<div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Severity Mix</div>
							<div className="mt-3 flex h-4 overflow-hidden rounded-full bg-zinc-100">
								{severitySummary.map((item) => (
									<div
										key={item.key}
										className={item.tone}
										style={{ width: `${Math.max(item.value > 0 ? 10 : 0, Math.round((item.value / severityTotal) * 100))}%` }}
									/>
								))}
							</div>
							<div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
								{severitySummary.map((item) => (
									<div key={item.key} className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-3">
										<div className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">{item.label}</div>
										<div className="mt-1 text-2xl font-black text-zinc-950">{item.value}</div>
									</div>
								))}
							</div>
						</div>

						<div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm">
							<div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Response Posture</div>
							<div className="mt-4 space-y-3">
								{responseSummary.map((item) => (
									<div key={item.label} className={`flex items-center justify-between rounded-xl border px-3 py-3 text-sm font-bold ${item.tone}`}>
										<span>{item.label}</span>
										<span>{item.value}</span>
									</div>
								))}
							</div>
							<p className="mt-4 text-xs leading-5 text-zinc-500">
								{readOnlyReview
									? 'Audit mode keeps this queue review-only. Use the latest findings below to inspect evidence and asset context.'
									: 'Use the latest findings below to jump into the queue, then move to the linked asset or terminal workflow for investigation.'}
							</p>
						</div>
					</div>

					<div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
							<div>
								<div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Trend Buckets</div>
								<p className="mt-1 text-sm text-zinc-600">Backend-provided ClamScan activity across the current alert scope.</p>
							</div>
							<div className="grid grid-cols-3 gap-2">
								{trendSummary.map((item) => (
									<div key={item.label} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-center">
										<div className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">{item.label}</div>
										<div className="mt-1 text-2xl font-black text-zinc-950">{item.value}</div>
									</div>
								))}
							</div>
						</div>
						<div className="mt-4 grid h-36 grid-cols-7 items-end gap-2">
							{(trend?.dailyBuckets ?? []).map((bucket) => (
								<div key={bucket.date} className="flex h-full flex-col items-center justify-end gap-2">
									<div className="text-[11px] font-bold text-zinc-600">{bucket.count}</div>
									<div className="w-full rounded-t-xl bg-rose-500/85" style={{ height: `${Math.max(bucket.count > 0 ? 14 : 6, Math.round((bucket.count / trendMax) * 100))}%` }} />
									<div className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400">{bucket.date.slice(5)}</div>
								</div>
							))}
						</div>
					</div>

					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Latest Findings</div>
							<p className="mt-1 text-sm text-zinc-600">Open one of the latest ClamScan records directly from this filtered queue.</p>
						</div>
						<Link to={`${basePath}/alerts?source=clamav`} className="inline-flex items-center rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100">
							Open Full ClamScan Queue
							<ArrowRight className="ml-2 h-4 w-4" />
						</Link>
					</div>
					<div className="mt-4 grid gap-3 xl:grid-cols-3">
						{latestFindings.map((alert) => (
							<button
								key={alert.id}
								type="button"
								onClick={() => onSelectAlert(alert)}
								className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50/40"
							>
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<div className="text-sm font-bold text-zinc-950">{renderAlertTitle(alert)}</div>
										<div className="mt-1 line-clamp-2 text-xs text-zinc-500">{alert.detail}</div>
									</div>
									<div className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-700 ring-1 ring-rose-200">
										{alert.severity}
									</div>
								</div>
								<div className="mt-3 text-[11px] font-medium text-zinc-500">
									{alert.assetTag || alert.assetName || alert.hostname || 'Linked asset'}
								</div>
							</button>
						))}
						{latestFindings.length === 0 ? <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-500 xl:col-span-3">No ClamScan findings match the current filter.</div> : null}
					</div>
				</div>
			</div>
		</section>
	);
}