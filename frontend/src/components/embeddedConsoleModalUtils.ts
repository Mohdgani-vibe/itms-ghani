import type { EmbeddedConsoleState } from './EmbeddedConsoleModal';

const DEFAULT_SALT_DEPARTMENT_NAME = 'Unassigned department';

interface BuildEmbeddedSaltConsoleStateInput {
  title: string;
  systemLabel: string;
  assetId: string;
  minionId: string;
  departmentName?: string | null;
  prefillCommand?: string;
}

function normalizeSaltDepartmentName(departmentName?: string | null) {
  return departmentName?.trim() || DEFAULT_SALT_DEPARTMENT_NAME;
}

export function buildEmbeddedSaltConsoleState({
  title,
  systemLabel,
  assetId,
  minionId,
  departmentName,
  prefillCommand,
}: BuildEmbeddedSaltConsoleStateInput): Extract<EmbeddedConsoleState, { kind: 'salt' }> {
  const resolvedDepartmentName = normalizeSaltDepartmentName(departmentName);

  return {
    kind: 'salt',
    title,
    subtitle: `${systemLabel} • ${resolvedDepartmentName} • Asset ID ${assetId}`,
    assetId,
    departmentName: resolvedDepartmentName,
    minionId,
    prefillCommand,
  };
}
