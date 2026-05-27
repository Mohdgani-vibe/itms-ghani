import { useEffect, useMemo, useState } from 'react';
import { BarChart3, FileArchive, FilePlus2, PenSquare } from 'lucide-react';
import GatepassCreateForm from '../components/gatepass/GatepassCreateForm';
import GatepassSidebar from '../components/gatepass/GatepassSidebar';
import GatepassReportsSection from '../components/gatepass/GatepassReportsSection';
import { apiRequest } from '../lib/api';
import GatepassPreviewOverlay from '../components/gatepass/GatepassPreviewOverlay';
import { getStoredSession } from '../lib/session';
import {
  createBarcodeGeometry,
  draftGatepassNumber,
  escapeHtml,
  fieldDisplayValue,
  formatDisplayDate,
  formatGatepassValidationMessage,
  formatIssueTime,
  formatStatusLabel,
  gatepassDisplayNumber,
  hasDisplayValue,
  initialsFromName,
  renderBarcodeSvgMarkup,
  todayDate,
  userDisplayName,
  validateGatepassForm,
  type GatepassForm,
  type GatepassFormErrors,
  type GatepassRecord,
  type UserOption,
} from './gatepassUtils';

const RECENT_GATEPASS_PAGE_SIZE = 3;

interface PaginatedGatepassResponse {
  items: GatepassRecord[];
  total: number;
  page: number;
  pageSize: number;
  summary?: {
    pending?: number;
    archived?: number;
  };
}

interface LookupOption {
  id: string;
  name: string;
}

interface UserMetaResponse {
  branches: LookupOption[];
  departments: LookupOption[];
}

interface InventoryItem {
  id: string;
  itemCode: string;
  category: string;
  name: string;
  serialNumber: string;
  specs: string;
  branchId: string;
  assignedUserId: string;
  warrantyExpiresAt: string;
  status: string;
  createdAt: string;
}

interface PaginatedUsersResponse {
  items: UserOption[];
  total: number;
  page: number;
  pageSize: number;
}

interface PaginatedInventoryResponse {
  items: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface PaginatedDevicesResponse {
  items: DeviceRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface DeviceRecord {
  id: string;
  assetId: string;
  hostname: string;
  serialNumber?: string;
  deviceType?: string;
  osName?: string;
  status: string;
  user?: { fullName?: string; employeeCode?: string } | null;
  branch?: { name?: string } | null;
  department?: { name?: string } | null;
}

interface AssetSuggestion {
  key: string;
  assetRef: string;
  label: string;
  description: string;
  assetType?: string;
  serialNumber?: string;
  originBranch: string;
}

type GatepassSection = 'create' | 'pending' | 'records' | 'reports';
const DEFAULT_PURPOSE = 'Work from home';

function BarcodePreview({ value, label, className = '' }: { value: string; label: string; className?: string }) {
  const geometry = createBarcodeGeometry(value);

  return (
    <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} className={className} aria-label={label} role="img" preserveAspectRatio="xMidYMid meet" shapeRendering="crispEdges">
      {geometry.bars.map((bar) => (
        <rect key={`${label}-${bar.x}`} x={bar.x} y={0} width={bar.width} height={28} fill="#111827" />
      ))}
    </svg>
  );
}

async function loadJsPdf() {
  const module = await import('jspdf');
  return module.jsPDF;
}

async function buildGatepassPdf(record: Pick<GatepassRecord, 'id' | 'gatepassNumber' | 'assetRef' | 'assetType' | 'serialNumber' | 'expectedReturn' | 'assetDescription' | 'purpose' | 'originBranch' | 'recipientBranch' | 'issueDate' | 'employeeName' | 'employeeCode' | 'departmentName' | 'contactNumber' | 'status' | 'requesterName' | 'approverName' | 'issuerSignedName' | 'securitySignedName' | 'createdAt'>) {
  const jsPDF = await loadJsPdf();
  const document = new jsPDF({ unit: 'pt', format: 'a4' });
  const gatepassNumber = gatepassDisplayNumber(record);
  const issueDateLabel = formatDisplayDate(record.issueDate);
  const expectedReturnLabel = formatDisplayDate(record.expectedReturn || '');
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 32;
  const contentWidth = pageWidth - (margin * 2);
  const bottomLimit = pageHeight - 72;
  const statusLabel = formatStatusLabel(record.status || 'pending');
  const ink: [number, number, number] = [17, 24, 39];
  const text: [number, number, number] = [55, 65, 81];
  const muted: [number, number, number] = [148, 163, 184];
  const line: [number, number, number] = [226, 232, 240];
  const panel: [number, number, number] = [248, 250, 252];
  const accent: [number, number, number] = [2, 132, 199];
  const accentTint: [number, number, number] = [232, 244, 253];
  const barcodeGeometry = createBarcodeGeometry(gatepassNumber);
  let cursorY = 266;

  const drawPageChrome = () => {
    document.setFillColor(255, 255, 255);
    document.rect(0, 0, pageWidth, pageHeight, 'F');
    document.setDrawColor(...line);
    document.rect(margin, 36, contentWidth, pageHeight - 78);
    document.setDrawColor(...ink);
    document.setLineWidth(1.2);
    document.line(margin, 36, pageWidth - margin, 36);
    document.setLineWidth(1);
    document.setDrawColor(...line);
    document.line(margin, pageHeight - 44, pageWidth - margin, pageHeight - 44);
    document.setFont('helvetica', 'normal');
    document.setFontSize(8);
    document.setTextColor(...muted);
    document.text('System-generated document · Valid only with authorised signatures and stamp', margin, pageHeight - 20);
    document.setFont('helvetica', 'bold');
    document.setTextColor(...text);
    document.text(`ZERODHA · ${gatepassNumber} · A4 LAYOUT V2`, pageWidth - margin, pageHeight - 20, { align: 'right' });
  };

  const ensureSpace = (requiredHeight: number) => {
    if (cursorY + requiredHeight <= bottomLimit) {
      return;
    }
    document.addPage();
    drawPageChrome();
    cursorY = 64;
  };

  const drawSectionHeading = (title: string) => {
    ensureSpace(20);
    document.setFont('helvetica', 'bold');
    document.setFontSize(9);
    document.setTextColor(...text);
    document.text(title.toUpperCase(), margin + 12, cursorY);
    const labelWidth = document.getTextWidth(title.toUpperCase()) + 24;
    document.setDrawColor(...line);
    document.line(margin + labelWidth, cursorY - 4, pageWidth - margin - 12, cursorY - 4);
    cursorY += 11;
  };

  const measureFieldHeight = (value: string, width: number, wide = false) => {
    document.setFont('helvetica', wide ? 'bold' : 'normal');
    document.setFontSize(wide ? 10.5 : 9.75);
    return Math.max(1, document.splitTextToSize(value, width).length) * (wide ? 12 : 11);
  };

  const drawFieldBox = (x: number, y: number, width: number, label: string, value?: string, options?: { height?: number; strong?: boolean }) => {
    const strong = options?.strong ?? true;
    const resolvedValue = fieldDisplayValue(value);
    const innerWidth = width - 20;
    const computedHeight = 18 + measureFieldHeight(resolvedValue, innerWidth, strong) + 14;
    const height = Math.max(options?.height ?? 0, computedHeight, 48);
    document.setFillColor(...panel);
    document.setDrawColor(...line);
    document.roundedRect(x, y, width, height, 6, 6, 'FD');
    document.setDrawColor(...accent);
    document.line(x + 1, y + 1, x + width - 1, y + 1);
    document.setFont('helvetica', 'normal');
    document.setFontSize(8);
    document.setTextColor(...muted);
    document.text(label.toUpperCase(), x + 10, y + 16);
    document.setFont('helvetica', strong ? 'bold' : 'normal');
    document.setFontSize(strong ? 10.5 : 9.75);
    document.setTextColor(...ink);
    const lines = document.splitTextToSize(resolvedValue, innerWidth);
    document.text(lines, x + 10, y + 31);
    return height;
  };

  const drawStatPanel = () => {
    const panelY = 144;
    const panelHeight = 64;
    const sectionWidth = contentWidth / 3;
    document.setFillColor(...panel);
    document.setDrawColor(...line);
    document.rect(margin, panelY, contentWidth, panelHeight, 'FD');
    [1, 2].forEach((index) => {
      const x = margin + (sectionWidth * index);
      document.line(x, panelY + 10, x, panelY + panelHeight - 10);
    });

    const leftX = margin + 14;
    const midX = margin + sectionWidth + 14;
    const rightX = margin + (sectionWidth * 2) + 14;
    const labelY = panelY + 16;
    const valueY = panelY + 27;
    const lowerLabelY = panelY + 38;
    const lowerValueY = panelY + 51;

    document.setFont('helvetica', 'normal');
    document.setFontSize(8);
    document.setTextColor(...muted);
    document.text('PASS NO.', leftX, labelY);
    document.text('VALID UNTIL', midX, labelY);
    document.text('SCAN TO VERIFY GATE PASS', rightX, labelY);
    document.text('EMPLOYEE', leftX, lowerLabelY);
    document.text('STATUS', midX, lowerLabelY);

    document.setFont('helvetica', 'bold');
    document.setFontSize(10.25);
    document.setTextColor(...ink);
    document.text(gatepassNumber, leftX, valueY);
    document.text(expectedReturnLabel, midX, valueY);
    document.text(record.employeeCode || '-', leftX, lowerValueY);
    document.setFillColor(...accentTint);
    document.roundedRect(midX - 4, lowerValueY - 9, 76, 15, 7, 7, 'F');
    document.setTextColor(...accent);
    document.setFontSize(9);
    document.text(statusLabel.toUpperCase(), midX + 34, lowerValueY, { align: 'center' });

    const barcodeScale = 170 / barcodeGeometry.width;
    const barcodeWrapX = rightX - 4;
    const barcodeWrapY = panelY + 15;
    const barcodeWrapWidth = sectionWidth - 24;
    const barcodeWrapHeight = 24;
    document.setFillColor(255, 255, 255);
    document.setDrawColor(...line);
    document.roundedRect(barcodeWrapX, barcodeWrapY, barcodeWrapWidth, barcodeWrapHeight, 4, 4, 'FD');
    const barcodeX = barcodeWrapX + 8;
    const barcodeY = barcodeWrapY + 2;
    document.setFillColor(...ink);
    barcodeGeometry.bars.forEach((bar) => {
      document.rect(barcodeX + (bar.x * barcodeScale), barcodeY, Math.max(0.8, bar.width * barcodeScale), 26, 'F');
    });
    document.setFont('helvetica', 'bold');
    document.setFontSize(7.5);
    document.setTextColor(...text);
    document.text(`${gatepassNumber} · ${record.employeeCode || '-'} · ${issueDateLabel.toUpperCase()}`, pageWidth - margin - 14, panelY + 54, { align: 'right' });
  };

  const drawMetricRow = () => {
    const rowY = 208;
    const rowHeight = 30;
    const columnWidth = contentWidth / 4;
    document.setDrawColor(...line);
    document.rect(margin, rowY, contentWidth, rowHeight);
    [1, 2, 3].forEach((index) => {
      const x = margin + (columnWidth * index);
      document.line(x, rowY + 8, x, rowY + rowHeight - 8);
    });
    const items = [
      { label: 'Issued', value: issueDateLabel },
      { label: 'Return', value: expectedReturnLabel },
      { label: 'Purpose', value: fieldDisplayValue(record.purpose) },
      { label: 'Status', value: formatStatusLabel(record.status || 'pending') },
    ];
    items.forEach((item, index) => {
      const x = margin + (index * columnWidth) + 14;
      document.setFont('helvetica', 'normal');
      document.setFontSize(8);
      document.setTextColor(...muted);
      document.text(item.label.toUpperCase(), x, rowY + 11);
      document.setFont('helvetica', 'bold');
      document.setFontSize(9.25);
      document.setTextColor(...ink);
      const lines = document.splitTextToSize(item.value, columnWidth - 24);
      document.text(lines[0] || '-', x, rowY + 21);
    });
  };

  const drawThreeColumnFields = (fields: Array<{ label: string; value?: string; strong?: boolean }>) => {
    ensureSpace(64);
    const gap = 8;
    const fieldWidth = (contentWidth - (gap * 2)) / 3;
    let maxHeight = 0;
    fields.forEach((field, index) => {
      const x = margin + (index * (fieldWidth + gap));
      const height = drawFieldBox(x, cursorY, fieldWidth, field.label, field.value, { strong: field.strong });
      maxHeight = Math.max(maxHeight, height);
    });
    cursorY += maxHeight + 8;
  };

  const drawFourColumnFields = (fields: Array<{ label: string; value?: string; strong?: boolean }>) => {
    ensureSpace(64);
    const gap = 8;
    const fieldWidth = (contentWidth - (gap * 3)) / 4;
    let maxHeight = 0;
    fields.forEach((field, index) => {
      const x = margin + (index * (fieldWidth + gap));
      const height = drawFieldBox(x, cursorY, fieldWidth, field.label, field.value, { strong: field.strong });
      maxHeight = Math.max(maxHeight, height);
    });
    cursorY += maxHeight + 8;
  };

  const drawFullWidthField = (label: string, value?: string) => {
    ensureSpace(70);
    const height = drawFieldBox(margin, cursorY, contentWidth, label, value, { height: 56, strong: true });
    cursorY += height + 8;
  };

  const drawSignatureRow = () => {
    ensureSpace(70);
    const gap = 20;
    const sectionWidth = (contentWidth - (gap * 2)) / 3;
    const signatures = [
      { title: 'Issued By', subtitle: record.issuerSignedName || record.requesterName || 'ITMS Super Admin' },
      { title: 'Employee Signature', subtitle: record.employeeName || 'Receiving Employee' },
      { title: 'Approved By', subtitle: record.approverName || 'Approver' },
    ];
    signatures.forEach((signature, index) => {
      const x = margin + (index * (sectionWidth + gap));
      document.setFont('helvetica', 'bold');
      document.setFontSize(8.5);
      document.setTextColor(...text);
      document.text(signature.title, x, cursorY + 10);
      document.setFont('helvetica', 'normal');
      document.setFontSize(7.5);
      document.setTextColor(...muted);
      document.text(signature.subtitle, x, cursorY + 24);
      document.setDrawColor(...muted);
      document.setLineDashPattern([2, 3], 0);
      document.line(x, cursorY + 36, x + sectionWidth, cursorY + 36);
      document.setLineDashPattern([], 0);
    });
    cursorY += 48;
  };

  drawPageChrome();

  document.setFont('helvetica', 'normal');
  document.setFontSize(8.5);
  document.setTextColor(...muted);
  document.text('ZERODHA · ASSET MANAGEMENT SYSTEM', margin + 12, 66);
  document.setFillColor(...accentTint);
  document.roundedRect(margin + 12, 74, 92, 16, 8, 8, 'F');
  document.setFont('helvetica', 'bold');
  document.setFontSize(8);
  document.setTextColor(...accent);
  document.text('A4 LAYOUT V2', margin + 58, 85, { align: 'center' });

  document.setFont('helvetica', 'bold');
  document.setFontSize(25);
  document.setTextColor(...ink);
  document.text('GATE PASS', margin + 12, 106);
  document.setFont('helvetica', 'normal');
  document.setFontSize(8.5);
  document.setTextColor(...muted);
  document.text('ASSET MOVEMENT AUTHORIZATION DOCUMENT', margin + 12, 123);

  const headerRightX = pageWidth - margin - 172;
  document.setDrawColor(...line);
  document.line(headerRightX, 58, headerRightX, 132);
  document.line(headerRightX + 14, 74, pageWidth - margin - 12, 74);
  document.setFont('helvetica', 'normal');
  document.setFontSize(8);
  document.setTextColor(...muted);
  document.text('DOCUMENT ID', headerRightX + 14, 84);
  document.setFont('helvetica', 'bold');
  document.setFontSize(9.75);
  document.setTextColor(...accent);
  document.text(gatepassNumber, pageWidth - margin - 14, 84, { align: 'right' });
  document.setFont('helvetica', 'bold');
  document.setFontSize(15);
  document.setTextColor(...ink);
  document.text(gatepassNumber, headerRightX + 14, 104);
  document.setFont('helvetica', 'normal');
  document.setFontSize(8);
  document.setTextColor(...text);
  document.text(issueDateLabel.toUpperCase(), headerRightX + 14, 120);

  drawStatPanel();
  drawMetricRow();

  drawSectionHeading('Employee Details');
  drawFourColumnFields([
    { label: 'Employee Name', value: record.employeeName },
    { label: 'Employee ID', value: record.employeeCode },
    { label: 'Department', value: record.departmentName },
    { label: 'Contact', value: record.contactNumber },
  ]);

  drawSectionHeading('Movement Details');
  drawThreeColumnFields([
    { label: 'From Branch', value: record.originBranch },
    { label: 'Receiver Branch', value: record.recipientBranch },
    { label: 'Approver', value: record.approverName },
  ]);

  drawSectionHeading('Asset Information');
  drawFullWidthField('Asset Description', record.assetDescription);
  drawThreeColumnFields([
    { label: 'Asset Tag / ID', value: record.assetRef },
    { label: 'Asset Category', value: record.assetType },
    { label: 'Serial Number', value: record.serialNumber },
  ]);

  drawSectionHeading('Authorization & Schedule');
  drawFourColumnFields([
    { label: 'Issue Date', value: issueDateLabel },
    { label: 'Return Date', value: expectedReturnLabel },
    { label: 'Authorized By', value: record.approverName || record.requesterName },
    { label: 'Purpose', value: record.purpose },
  ]);

  drawSectionHeading('Verification');
  drawSignatureRow();

  return document;
}

async function openGatepassClientPdf(record: Pick<GatepassRecord, 'id' | 'gatepassNumber' | 'assetRef' | 'assetType' | 'serialNumber' | 'expectedReturn' | 'assetDescription' | 'purpose' | 'originBranch' | 'recipientBranch' | 'issueDate' | 'employeeName' | 'employeeCode' | 'departmentName' | 'contactNumber' | 'status' | 'requesterName' | 'approverName' | 'issuerSignedName' | 'securitySignedName' | 'createdAt'>, inline = true) {
  const pdfDocument = await buildGatepassPdf(record);
  if (!inline) {
    pdfDocument.save(`${gatepassDisplayNumber(record)}-a4-layout-v2.pdf`);
    return;
  }

  const blob = pdfDocument.output('blob');
  const objectUrl = URL.createObjectURL(blob);
  const pdfWindow = window.open(objectUrl, '_blank', 'noopener,noreferrer');

  if (!pdfWindow) {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `${gatepassDisplayNumber(record)}-a4-layout-v2.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function openGatepassPrintWindow(record: Pick<GatepassRecord, 'id' | 'gatepassNumber' | 'assetRef' | 'assetType' | 'serialNumber' | 'expectedReturn' | 'assetDescription' | 'purpose' | 'originBranch' | 'recipientBranch' | 'issueDate' | 'employeeName' | 'employeeCode' | 'departmentName' | 'contactNumber' | 'status' | 'requesterName' | 'approverName' | 'issuerSignedName' | 'issuerSignedAt' | 'receiverSignedName' | 'receiverSignedAt' | 'securitySignedName' | 'securitySignedAt' | 'createdAt'>) {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=960,height=900');
  if (!printWindow) {
    return;
  }

  const gatepassNumber = gatepassDisplayNumber(record) || record.assetRef || 'PENDING';
  const issueDateLabel = formatDisplayDate(record.issueDate);
  const issueTimeLabel = formatIssueTime(record.createdAt);
  const expectedReturnLabel = formatDisplayDate(record.expectedReturn || '');
  const barcodeMarkup = renderBarcodeSvgMarkup(gatepassNumber, `Barcode for ${gatepassNumber}`);

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Gatepass ${escapeHtml(gatepassNumber)}</title>
      <style>
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; color: #0f172a; background: #f8fafc; padding: 24px; }
        .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #ffffff; display: flex; flex-direction: column; padding: 20px; }
        .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 14px; }
        .header-left { display: flex; flex-direction: column; gap: 6px; }
        .header-title { color: #0f172a; font-size: 28px; font-weight: 700; line-height: 1; }
        .header-sub { color: #64748b; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; }
        .header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
        .gp-num { color: #0f172a; font-size: 14px; font-weight: 700; letter-spacing: 0.3px; }
        .gp-date { color: #64748b; font-size: 10px; }
        .barcode-wrap { border: 1px solid #e2e8f0; background: #f8fafc; padding: 6px 8px; border-radius: 10px; }
        .barcode-wrap svg { display: block; width: 160px; height: 32px; }
        .body { flex: 1; padding-top: 18px; }
        .section-head { color: #334155; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; margin-top: 18px; margin-bottom: 10px; }
        .grid-2, .grid-3, .grid-4 { display: grid; gap: 8px; margin-bottom: 8px; }
        .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .field-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; }
        .field-label { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .field-value { font-size: 12px; color: #0f172a; line-height: 1.4; }
        .field-value.strong { font-weight: 700; }
        .field-value.empty { color: #94a3b8; font-style: italic; }
        .sig-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
        .sig-card { min-height: 120px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; }
        .sig-top { display: flex; align-items: center; gap: 8px; }
        .sig-circle { width: 34px; height: 34px; border-radius: 999px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; }
        .sig-role { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        .sig-name { font-size: 12px; font-weight: 700; margin-top: 2px; }
        .sig-line { margin-top: auto; padding-top: 28px; padding-bottom: 2px; border-bottom: 1px dashed #cbd5e1; display: flex; justify-content: space-between; }
        .sig-line span { font-size: 10px; color: #94a3b8; }
        .footer { border-top: 1px solid #cbd5e1; padding-top: 12px; margin-top: 18px; display: flex; align-items: center; justify-content: space-between; }
        .footer span { font-size: 10px; color: #64748b; }
        @media screen and (max-width: 900px) {
          body { padding: 12px; }
          .page { width: 100%; }
          .header { flex-direction: column; align-items: flex-start; gap: 12px; }
          .header-right { align-items: flex-start; }
          .grid-2, .grid-3, .grid-4, .sig-grid { grid-template-columns: 1fr; }
        }
        @media print {
          body { padding: 0; background: #ffffff; }
          .page { width: 100%; padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="header-left">
            <div class="header-title">Gatepass</div>
            <div class="header-sub">Zerodha IT movement pass</div>
          </div>
          <div class="header-right">
            <div class="gp-num">${escapeHtml(gatepassNumber)}</div>
            <div class="barcode-wrap">${barcodeMarkup}</div>
            <div class="gp-date">Date of issue: ${escapeHtml(issueDateLabel)} · ${escapeHtml(issueTimeLabel)}</div>
          </div>
        </div>

        <div class="body">
          <div class="section-head">01 · DISPATCH DETAILS</div>
          <div class="grid-2">
            <div class="field-card"><div class="field-label">From Branch</div><div class="field-value strong${hasDisplayValue(record.originBranch) ? '' : ' empty'}">${escapeHtml(fieldDisplayValue(record.originBranch))}</div></div>
            <div class="field-card"><div class="field-label">Receiver Branch</div><div class="field-value strong${hasDisplayValue(record.recipientBranch) ? '' : ' empty'}">${escapeHtml(fieldDisplayValue(record.recipientBranch))}</div></div>
          </div>

          <div class="section-head">02 · RECIPIENT DETAILS</div>
          <div class="grid-3">
            <div class="field-card"><div class="field-label">Employee Name</div><div class="field-value${hasDisplayValue(record.employeeName) ? '' : ' empty'}">${escapeHtml(fieldDisplayValue(record.employeeName))}</div></div>
            <div class="field-card"><div class="field-label">Employee ID</div><div class="field-value${hasDisplayValue(record.employeeCode) ? '' : ' empty'}">${escapeHtml(fieldDisplayValue(record.employeeCode))}</div></div>
            <div class="field-card"><div class="field-label">Department</div><div class="field-value${hasDisplayValue(record.departmentName) ? '' : ' empty'}">${escapeHtml(fieldDisplayValue(record.departmentName))}</div></div>
          </div>
          <div class="grid-2">
            <div class="field-card"><div class="field-label">Approver Name</div><div class="field-value${hasDisplayValue(record.approverName) ? '' : ' empty'}">${escapeHtml(fieldDisplayValue(record.approverName))}</div></div>
            <div class="field-card"><div class="field-label">Contact Number</div><div class="field-value${hasDisplayValue(record.contactNumber) ? '' : ' empty'}">${escapeHtml(fieldDisplayValue(record.contactNumber))}</div></div>
          </div>

          <div class="section-head">03 · GATEPASS SUMMARY</div>
          <div class="grid-3">
            <div class="field-card"><div class="field-label">Gatepass Number</div><div class="field-value strong">${escapeHtml(fieldDisplayValue(gatepassNumber))}</div></div>
            <div class="field-card"><div class="field-label">Requested By</div><div class="field-value${hasDisplayValue(record.requesterName) ? '' : ' empty'}">${escapeHtml(fieldDisplayValue(record.requesterName))}</div></div>
            <div class="field-card"><div class="field-label">Status</div><div class="field-value${hasDisplayValue(record.status) ? '' : ' empty'}">${escapeHtml(fieldDisplayValue(formatStatusLabel(record.status || 'pending')))}</div></div>
          </div>

          <div class="section-head">04 · ASSET DETAILS</div>
          <div class="grid-4">
            <div class="field-card"><div class="field-label">Asset Tag / ID</div><div class="field-value${hasDisplayValue(record.assetRef) ? '' : ' empty'}">${escapeHtml(fieldDisplayValue(record.assetRef))}</div></div>
            <div class="field-card"><div class="field-label">Asset Type</div><div class="field-value${hasDisplayValue(record.assetType) ? '' : ' empty'}">${escapeHtml(fieldDisplayValue(record.assetType))}</div></div>
            <div class="field-card"><div class="field-label">Serial Number</div><div class="field-value${hasDisplayValue(record.serialNumber) ? '' : ' empty'}">${escapeHtml(fieldDisplayValue(record.serialNumber))}</div></div>
          </div>
          <div class="grid-3">
            <div class="field-card"><div class="field-label">Purpose</div><div class="field-value${hasDisplayValue(record.purpose) ? '' : ' empty'}">${escapeHtml(fieldDisplayValue(record.purpose))}</div></div>
            <div class="field-card"><div class="field-label">Issue Date</div><div class="field-value">${escapeHtml(`${issueDateLabel} · ${issueTimeLabel}`)}</div></div>
            <div class="field-card"><div class="field-label">Expected Return</div><div class="field-value${hasDisplayValue(record.expectedReturn) ? '' : ' empty'}">${escapeHtml(fieldDisplayValue(expectedReturnLabel))}</div></div>
          </div>
          <div class="grid-2" style="grid-template-columns:1fr;">
            <div class="field-card"><div class="field-label">Asset Description</div><div class="field-value${hasDisplayValue(record.assetDescription) ? '' : ' empty'}">${escapeHtml(fieldDisplayValue(record.assetDescription))}</div></div>
          </div>

          <div class="section-head">05 · AUTHORISATION &amp; SIGNATURES</div>
          <div class="sig-grid">
            <div class="sig-card">
              <div class="sig-top"><div class="sig-circle">${escapeHtml(initialsFromName(record.issuerSignedName || record.requesterName || 'ITMS Super Admin'))}</div><div><div class="sig-role">Issued by</div><div class="sig-name">${escapeHtml(fieldDisplayValue(record.issuerSignedName || record.requesterName || 'ITMS Super Admin'))}</div></div></div>
              <div class="sig-line"><span>Signature</span><span>Date &amp; time</span></div>
            </div>
            <div class="sig-card">
              <div class="sig-top"><div class="sig-circle">${escapeHtml(initialsFromName(record.approverName || 'Approver'))}</div><div><div class="sig-role">Approved by</div><div class="sig-name">${escapeHtml(fieldDisplayValue(record.approverName || 'Approver'))}</div></div></div>
              <div class="sig-line"><span>Signature</span><span>Date &amp; time</span></div>
            </div>
            <div class="sig-card">
              <div class="sig-top"><div class="sig-circle">${escapeHtml(initialsFromName(record.securitySignedName || 'Security Guard'))}</div><div><div class="sig-role">Security check</div><div class="sig-name">${escapeHtml(fieldDisplayValue(record.securitySignedName || 'Security Guard'))}</div></div></div>
              <div class="sig-line"><span>Signature</span><span>Date &amp; time</span></div>
            </div>
          </div>
        </div>

        <div class="footer">
          <span>Zerodha Gatepass · Admin &amp; IT Division · iteam@zerodha.com</span>
          <span>${escapeHtml(gatepassNumber)} · ${escapeHtml(issueDateLabel)}</span>
        </div>
      </div>
      <script>window.onload = () => window.print();</script>
    </body>
  </html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export default function Gatepass() {
  const session = getStoredSession();
  const isAuditor = session?.user.role === 'auditor';
  const [gatepasses, setGatepasses] = useState<GatepassRecord[]>([]);
  const [branches, setBranches] = useState<LookupOption[]>([]);
  const [departments, setDepartments] = useState<LookupOption[]>([]);
  const [employeeSuggestions, setEmployeeSuggestions] = useState<UserOption[]>([]);
  const [assetSuggestions, setAssetSuggestions] = useState<AssetSuggestion[]>([]);
  const [employeeLookupLoading, setEmployeeLookupLoading] = useState(false);
  const [assetLookupLoading, setAssetLookupLoading] = useState(false);
  const [, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [activeSection, setActiveSection] = useState<GatepassSection>('reports');
  const [formErrors, setFormErrors] = useState<GatepassFormErrors>({});
  const [showPreview, setShowPreview] = useState(false);
  const [assetDescriptionLocked, setAssetDescriptionLocked] = useState(false);
  const [gatepassSummary, setGatepassSummary] = useState({ total: 0, pending: 0, archived: 0 });
  const [form, setForm] = useState<GatepassForm>({
    employeeUserId: '',
    employeeName: '',
    employeeCode: '',
    departmentName: '',
    approverName: '',
    contactNumber: '',
    assetRef: '',
    assetType: '',
    serialNumber: '',
    expectedReturn: '',
    assetDescription: '',
    purpose: DEFAULT_PURPOSE,
    originBranch: '',
    recipientBranch: '',
    issueDate: todayDate(),
  });

  const resetForm = (branchOptions: LookupOption[] = branches) => {
    setFormErrors({});
    setShowPreview(false);
    setAssetDescriptionLocked(false);
    setForm({
      employeeUserId: '',
      employeeName: '',
      employeeCode: '',
      departmentName: '',
      approverName: '',
      contactNumber: '',
      assetRef: '',
      assetType: '',
      serialNumber: '',
      expectedReturn: '',
      assetDescription: '',
      purpose: DEFAULT_PURPOSE,
      originBranch: branchOptions[0]?.name || '',
      recipientBranch: branchOptions[1]?.name || branchOptions[0]?.name || '',
      issueDate: todayDate(),
    });
  };

  const loadGatepasses = async () => {
    setLoading(true);
    setError('');
    try {
      const [data, meta] = await Promise.all([
        apiRequest<PaginatedGatepassResponse>(`/api/gatepass?paginate=1&page=1&page_size=${RECENT_GATEPASS_PAGE_SIZE}`),
        apiRequest<UserMetaResponse>('/api/users/meta/options'),
      ]);
      setGatepasses(data.items || []);
      setGatepassSummary({
        total: data.total || 0,
        pending: data.summary?.pending || 0,
        archived: data.summary?.archived || 0,
      });
      setBranches(meta.branches || []);
      setDepartments(meta.departments || []);
      setForm((current) => current.originBranch || current.recipientBranch ? current : {
        ...current,
        originBranch: meta.branches?.[0]?.name || '',
        recipientBranch: meta.branches?.[1]?.name || meta.branches?.[0]?.name || '',
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load gatepasses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGatepasses();
  }, []);
  const previewGatepassNumber = useMemo(() => draftGatepassNumber(form.issueDate), [form.issueDate]);
  const previewRecord = useMemo<GatepassRecord>(() => ({
    id: previewGatepassNumber,
    gatepassNumber: previewGatepassNumber,
    assetRef: form.assetRef,
    assetType: form.assetType,
    serialNumber: form.serialNumber,
    expectedReturn: form.expectedReturn,
    assetDescription: form.assetDescription,
    purpose: form.purpose,
    originBranch: form.originBranch,
    recipientBranch: form.recipientBranch,
    issueDate: form.issueDate,
    employeeName: form.employeeName,
    employeeCode: form.employeeCode,
    departmentName: form.departmentName,
    contactNumber: form.contactNumber,
    status: 'pending',
    createdAt: new Date().toISOString(),
    requesterName: session?.user.fullName || form.employeeName,
    approverName: form.approverName,
    issuerSignedName: session?.user.fullName || form.employeeName,
    issuerSignedAt: '',
    receiverSignedName: '',
    receiverSignedAt: '',
    securitySignedName: 'Security Guard',
    securitySignedAt: '',
  }), [
    form.assetDescription,
    form.assetRef,
    form.assetType,
    form.approverName,
    form.contactNumber,
    form.departmentName,
    form.employeeCode,
    form.employeeName,
    form.expectedReturn,
    form.issueDate,
    form.originBranch,
    form.purpose,
    form.recipientBranch,
    form.serialNumber,
    previewGatepassNumber,
    session?.user.fullName,
  ]);
  const recentGatepasses = useMemo(() => gatepasses, [gatepasses]);
  const recentGatepassLookup = useMemo(() => new Map(recentGatepasses.map((gatepass) => [gatepass.id, gatepass])), [recentGatepasses]);

  const sidebarItems = [
    { id: 'create' as const, label: 'Create Gatepass', detail: 'Draft and issue movement pass', icon: FilePlus2 },
    { id: 'pending' as const, label: 'Pending Signatures', detail: 'Awaiting approval, upload, or signoff', icon: PenSquare, badge: gatepassSummary.pending },
    { id: 'records' as const, label: 'Vault & Records', detail: 'Completed and rejected passes', icon: FileArchive },
    { id: 'reports' as const, label: 'Reports', detail: 'Movement and print summary', icon: BarChart3 },
  ];
  const visibleSidebarItems = isAuditor ? sidebarItems.filter((item) => item.id !== 'create') : sidebarItems;

  useEffect(() => {
    if (isAuditor && activeSection === 'create') {
      setActiveSection('reports');
    }
  }, [activeSection, isAuditor]);

  const branchNameById = useMemo(() => Object.fromEntries(branches.map((branch) => [branch.id, branch.name])), [branches]);
  const departmentNames = useMemo(() => {
    const names = departments.map((department) => department.name).filter(Boolean);
    if (form.departmentName && !names.includes(form.departmentName)) {
      names.push(form.departmentName);
    }
    return names.sort((left, right) => left.localeCompare(right));
  }, [departments, form.departmentName]);

  useEffect(() => {
    const query = form.employeeName.trim();
    if (query.length < 2) {
      setEmployeeLookupLoading(false);
      setEmployeeSuggestions([]);
      return;
    }

    let cancelled = false;
    setEmployeeLookupLoading(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          paginate: '1',
          page: '1',
          page_size: '20',
          search: query,
          exclude_role: 'super_admin',
        });
        const data = await apiRequest<PaginatedUsersResponse>(`/api/users?${params.toString()}`);
        if (!cancelled) {
          setEmployeeSuggestions((data.items || []).slice().sort((left, right) => userDisplayName(left).localeCompare(userDisplayName(right))));
        }
      } catch {
        if (!cancelled) {
          setEmployeeSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setEmployeeLookupLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [form.employeeName]);

  useEffect(() => {
    const query = form.assetRef.trim();
    if (query.length < 2) {
      setAssetLookupLoading(false);
      setAssetSuggestions([]);
      return;
    }

    let cancelled = false;
    setAssetLookupLoading(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const searchParams = new URLSearchParams({ paginate: '1', page: '1', page_size: '20', search: query });
        const [inventoryData, deviceData] = await Promise.all([
          apiRequest<PaginatedInventoryResponse>(`/api/inventory?${searchParams.toString()}`).catch(() => ({ items: [], total: 0, page: 1, pageSize: 20 })),
          apiRequest<PaginatedDevicesResponse>(`/api/devices?${searchParams.toString()}`).catch(() => ({ items: [], total: 0, page: 1, pageSize: 20 })),
        ]);
        if (!cancelled) {
          const deviceAssets = (deviceData.items || []).map((device) => {
            const description = [device.deviceType, device.hostname, device.osName].filter(Boolean).join(' • ');
            return {
              key: `device-${device.id}`,
              assetRef: device.assetId,
              label: `${device.assetId} - ${device.hostname}`,
              description: description || device.hostname || device.assetId,
              assetType: device.deviceType || 'Workstation',
              serialNumber: device.serialNumber || '',
              originBranch: device.branch?.name || '',
            };
          });
          const inventoryAssets = (inventoryData.items || []).map((item) => {
            const description = [item.name, item.category, item.serialNumber || item.specs].filter(Boolean).join('  ');
            return {
              key: `inventory-${item.id}`,
              assetRef: item.itemCode,
              label: `${item.itemCode} - ${item.name}`,
              description: description || item.name || item.itemCode,
              assetType: item.category || item.name || '',
              serialNumber: item.serialNumber || '',
              originBranch: branchNameById[item.branchId] || '',
            };
          });
          setAssetSuggestions([...deviceAssets, ...inventoryAssets].sort((left, right) => left.label.localeCompare(right.label)));
        }
      } catch {
        if (!cancelled) {
          setAssetSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setAssetLookupLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [branchNameById, form.assetRef]);

  const handleEmployeeChange = (userId: string) => {
    const selectedUser = employeeSuggestions.find((user) => user.id === userId);
    setFormErrors((current) => ({
      ...current,
      employeeName: undefined,
      employeeCode: undefined,
      departmentName: undefined,
    }));
    setForm((current) => ({
      ...current,
      employeeUserId: userId,
      employeeName: selectedUser?.fullName || selectedUser?.full_name || '',
      employeeCode: selectedUser?.employeeCode || selectedUser?.emp_id || '',
      departmentName: selectedUser?.department || '',
    }));
  };

  const handleEmployeeLookupChange = (value: string) => {
    const normalizedValue = value.trim().toLowerCase();
    const selectedUser = employeeSuggestions.find((user) => {
      const name = userDisplayName(user).trim().toLowerCase();
      const employeeCode = (user.employeeCode || user.emp_id || '').trim().toLowerCase();
      return name === normalizedValue || employeeCode === normalizedValue;
    });

    if (selectedUser) {
      handleEmployeeChange(selectedUser.id);
      return;
    }

    setForm((current) => ({
      ...current,
      employeeUserId: '',
      employeeName: value,
    }));
    setFormErrors((current) => ({
      ...current,
      employeeName: undefined,
    }));
  };

  const handleAssetLookupChange = (value: string) => {
    const normalizedValue = value.trim().toLowerCase();
    const selectedAsset = assetSuggestions.find((asset) => {
      const assetRef = asset.assetRef.trim().toLowerCase();
      const label = asset.label.trim().toLowerCase();
      return assetRef === normalizedValue || label === normalizedValue;
    }) || assetSuggestions.find((asset) => {
      const assetRef = asset.assetRef.trim().toLowerCase();
      const label = asset.label.trim().toLowerCase();
      return assetRef.startsWith(normalizedValue) || label.startsWith(normalizedValue);
    });

    if (selectedAsset) {
      setAssetDescriptionLocked(true);
      setForm((current) => ({
        ...current,
        assetRef: selectedAsset.assetRef,
        assetType: selectedAsset.assetType || current.assetType,
        serialNumber: selectedAsset.serialNumber || current.serialNumber,
        assetDescription: selectedAsset.description,
        originBranch: selectedAsset.originBranch || current.originBranch,
      }));
      setFormErrors((current) => ({
        ...current,
        assetRef: undefined,
        assetDescription: undefined,
        originBranch: undefined,
      }));
      return;
    }

    setAssetDescriptionLocked(false);
    setForm((current) => ({
      ...current,
      assetRef: value,
      assetType: current.assetRef === value ? current.assetType : '',
      serialNumber: current.assetRef === value ? current.serialNumber : '',
      assetDescription: current.assetRef === value ? current.assetDescription : '',
    }));
    setFormErrors((current) => ({
      ...current,
      assetRef: undefined,
      assetDescription: undefined,
    }));
  };

  const updateField = <K extends keyof GatepassForm>(field: K, value: GatepassForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    if (field === 'assetDescription') {
      setAssetDescriptionLocked(false);
    }
  };

  const handleViewReport = (gatepassId: string) => {
    const gatepass = recentGatepassLookup.get(gatepassId);
    if (!gatepass) {
      setError('Unable to open the selected gatepass report.');
      return;
    }

    void openGatepassClientPdf(gatepass);
  };

  const handleDownloadReport = (gatepassId: string) => {
    const gatepass = recentGatepassLookup.get(gatepassId);
    if (!gatepass) {
      setError('Unable to download the selected gatepass report.');
      return;
    }

    void openGatepassClientPdf(gatepass, false);
  };

  const handleDownloadCsv = () => {
    const escapeCsvCell = (value: string) => {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const rows = [
      ['gatepass_number', 'employee_name', 'employee_code', 'asset_ref', 'status', 'issue_date', 'origin_branch', 'recipient_branch'],
      ...recentGatepasses.map((gatepass) => [
        gatepassDisplayNumber(gatepass),
        gatepass.employeeName || '',
        gatepass.employeeCode || '',
        gatepass.assetRef || '',
        gatepass.status || '',
        gatepass.issueDate || '',
        gatepass.originBranch || '',
        gatepass.recipientBranch || '',
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => escapeCsvCell(String(cell ?? ''))).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = 'gatepass-report-register.csv';
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  const openPreview = () => {
    const errors = validateGatepassForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(formatGatepassValidationMessage(errors, 'previewing the draft'));
      return;
    }
    setError('');
    setShowPreview(true);
  };

  const handleClosePreview = () => {
    setShowPreview(false);
  };

  const handleDownloadPreviewPdf = async () => {
    await openGatepassClientPdf(previewRecord, false);
    setShowPreview(false);
  };

  const handlePrintPreview = () => {
    openGatepassPrintWindow(previewRecord);
    setShowPreview(false);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors = validateGatepassForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(formatGatepassValidationMessage(errors, 'generating the gatepass'));
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      setSuccessMessage('');
      const created = await apiRequest<{ id: string; gatepassNumber?: string }>('/api/gatepass', {
        method: 'POST',
        body: JSON.stringify({
          assetRef: form.assetRef,
          assetDescription: form.assetDescription,
          purpose: form.purpose,
          originBranch: form.originBranch,
          recipientBranch: form.recipientBranch,
          issueDate: form.issueDate,
          employeeName: form.employeeName,
          employeeCode: form.employeeCode,
          departmentName: form.departmentName,
          approverName: form.approverName,
          contactNumber: form.contactNumber,
        }),
      });
      const createdRecord: GatepassRecord = {
        ...previewRecord,
        id: created.id,
        gatepassNumber: created.gatepassNumber || previewRecord.gatepassNumber || created.id,
        createdAt: new Date().toISOString(),
      };
      await openGatepassClientPdf(createdRecord, false);
      resetForm();
      await loadGatepasses();
      setSuccessMessage(`Gatepass ${created.gatepassNumber || created.id} generated successfully.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create gatepass');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="gatepass-page w-full space-y-6">
      <GatepassPreviewOverlay
        showPreview={showPreview}
        previewGatepassNumber={previewGatepassNumber}
        previewRecord={previewRecord}
        formatDisplayDate={formatDisplayDate}
        formatIssueTime={formatIssueTime}
        onClose={handleClosePreview}
        onDownloadPdf={() => { void handleDownloadPreviewPdf(); }}
        onPrintPreview={handlePrintPreview}
      />

      <div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Gatepass</h1>
        <p className="mt-1 text-sm text-zinc-500">Admin and IT dispatch tracking with creation, pending signatures, saved PDFs, and reporting.</p>
      </div>

      {isAuditor ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Auditor access is read-only on gatepass. You can review movement summaries and existing records, but drafting and issuing new gatepasses is disabled.
        </div>
      ) : null}

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
      {successMessage ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{successMessage}</div> : null}

      {activeSection === 'create' && !isAuditor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
          <div className="max-h-full w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-bold text-sky-950">Create Gatepass</div>
                <div className="text-sm text-blue-700/80">Use the same popup-style workflow as inventory add item to draft and issue a gatepass.</div>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('reports')}
                className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                Close
              </button>
            </div>
            <GatepassCreateForm
              form={form}
              formErrors={formErrors}
              submitting={submitting}
              branches={branches}
              departmentNames={departmentNames}
              employeeSuggestions={employeeSuggestions}
              employeeLookupLoading={employeeLookupLoading}
              assetSuggestions={assetSuggestions}
              assetLookupLoading={assetLookupLoading}
              assetDescriptionLocked={assetDescriptionLocked}
              formatDisplayDate={formatDisplayDate}
              onSubmit={handleCreate}
              onFieldChange={updateField}
              onEmployeeLookupChange={handleEmployeeLookupChange}
              onAssetLookupChange={handleAssetLookupChange}
              onUnlockAssetDescription={() => setAssetDescriptionLocked(false)}
              onReset={resetForm}
              onOpenPreview={openPreview}
            />
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-6 md:grid-cols-[250px_minmax(0,1fr)]">
        <GatepassSidebar items={visibleSidebarItems} activeSection={activeSection} onSectionChange={setActiveSection} />

        <div className="min-w-0 space-y-5">
        {activeSection === 'reports' ? (
          <GatepassReportsSection
              barcodeGatepasses={recentGatepasses.map((gatepass) => ({
                id: gatepass.id,
                status: gatepass.status,
                displayNumber: gatepassDisplayNumber(gatepass),
                employeeName: gatepass.employeeName,
                assetRef: gatepass.assetRef,
                issueDate: gatepass.issueDate,
                subjectLabel: gatepass.employeeName || gatepass.assetRef || 'Gatepass record',
              }))}
              reportGatepasses={recentGatepasses.map((gatepass) => ({
              id: gatepass.id,
              status: gatepass.status,
              displayNumber: gatepassDisplayNumber(gatepass),
              employeeName: gatepass.employeeName,
              assetRef: gatepass.assetRef,
              issueDate: gatepass.issueDate,
              subjectLabel: gatepass.employeeName || gatepass.assetRef || 'Gatepass record',
            }))}
            total={gatepassSummary.total}
            pending={gatepassSummary.pending}
            archived={gatepassSummary.archived}
            renderBarcode={(value, label, className) => <BarcodePreview value={value} label={label} className={className} />}
            onViewReport={handleViewReport}
            onDownloadReport={handleDownloadReport}
            onDownloadCsv={handleDownloadCsv}
          />
        ) : null}
        {activeSection !== 'create' ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-zinc-900">
            {activeSection === 'pending' ? 'Pending Signatures' : activeSection === 'records' ? 'Vault & Records' : 'Gatepass Register'}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {activeSection === 'pending' ? 'Review gatepasses that still need approval, receiver upload, or security signoff.' : activeSection === 'records' ? 'Browse completed and rejected gatepasses already processed.' : 'Search all generated gatepasses.'}
          </p>
        </div>
        ) : null}

        {activeSection === 'pending' ? <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm">Pending signatures are managed from the side menu only.</div> : null}
        {activeSection === 'records' ? <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm">Saved gatepass records are hidden from the main page.</div> : null}
        </div>
      </div>
    </div>
  );
}