import type { GraphSecurityGroup } from '@/lib/automation/types';

const SHAREPOINT_GROUP_PREFIX = 'SG_SP_Cores-Algemeen_';
const READ_SUFFIX = '-Lezen';
const EDIT_SUFFIX = '-Bewerken';

export type SharePointPermission = 'read' | 'edit';

export interface NormalizedSecurityGroup {
  id: string;
  originalDisplayName: string;
  kind: 'sharepoint' | 'other';
  folderLabel: string | null;
  permission: SharePointPermission | null;
}

export interface SecurityGroupFolderSection {
  folderLabel: string;
  items: Array<NormalizedSecurityGroup & { kind: 'sharepoint'; folderLabel: string; permission: SharePointPermission }>;
}

export interface SecurityGroupSections {
  sharepoint: SecurityGroupFolderSection[];
  other: Array<NormalizedSecurityGroup & { kind: 'other' }>;
}

const normalizeFolderLabel = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseSharePointGroup = (
  displayName: string,
): { folderLabel: string; permission: SharePointPermission } | null => {
  if (!displayName.toLowerCase().startsWith(SHAREPOINT_GROUP_PREFIX.toLowerCase())) {
    return null;
  }

  const suffix = displayName.slice(SHAREPOINT_GROUP_PREFIX.length).trim();
  if (!suffix) {
    return null;
  }

  if (suffix.toLowerCase().endsWith(READ_SUFFIX.toLowerCase())) {
    const folderRaw = suffix.slice(0, -READ_SUFFIX.length);
    const folderLabel = normalizeFolderLabel(folderRaw);
    return folderLabel ? { folderLabel, permission: 'read' } : null;
  }

  if (suffix.toLowerCase().endsWith(EDIT_SUFFIX.toLowerCase())) {
    const folderRaw = suffix.slice(0, -EDIT_SUFFIX.length);
    const folderLabel = normalizeFolderLabel(folderRaw);
    return folderLabel ? { folderLabel, permission: 'edit' } : null;
  }

  return null;
};

export const normalizeSecurityGroup = (group: GraphSecurityGroup): NormalizedSecurityGroup => {
  const parsed = parseSharePointGroup(group.displayName);

  if (!parsed) {
    return {
      id: group.id,
      originalDisplayName: group.displayName,
      kind: 'other',
      folderLabel: null,
      permission: null,
    };
  }

  return {
    id: group.id,
    originalDisplayName: group.displayName,
    kind: 'sharepoint',
    folderLabel: parsed.folderLabel,
    permission: parsed.permission,
  };
};

export const buildSecurityGroupSections = (groups: GraphSecurityGroup[]): SecurityGroupSections => {
  const byFolder = new Map<string, SecurityGroupFolderSection>();
  const other: Array<NormalizedSecurityGroup & { kind: 'other' }> = [];

  for (const group of groups) {
    const normalized = normalizeSecurityGroup(group);

    if (normalized.kind === 'other') {
      other.push(normalized);
      continue;
    }

    if (!byFolder.has(normalized.folderLabel)) {
      byFolder.set(normalized.folderLabel, {
        folderLabel: normalized.folderLabel,
        items: [],
      });
    }

    byFolder.get(normalized.folderLabel)?.items.push(normalized);
  }

  const permissionOrder: Record<SharePointPermission, number> = {
    read: 0,
    edit: 1,
  };

  const sharepoint = [...byFolder.values()]
    .sort((a, b) => a.folderLabel.localeCompare(b.folderLabel, 'nl', { sensitivity: 'base' }))
    .map((section) => ({
      ...section,
      items: [...section.items].sort((a, b) => {
        const permissionDiff = permissionOrder[a.permission] - permissionOrder[b.permission];
        if (permissionDiff !== 0) {
          return permissionDiff;
        }

        return a.originalDisplayName.localeCompare(b.originalDisplayName, 'nl', { sensitivity: 'base' });
      }),
    }));

  other.sort((a, b) => a.originalDisplayName.localeCompare(b.originalDisplayName, 'nl', { sensitivity: 'base' }));

  return {
    sharepoint,
    other,
  };
};

export const getSecurityGroupDisplayLabel = (
  group: NormalizedSecurityGroup,
  labels: { read: string; edit: string },
): string => {
  if (group.kind === 'sharepoint' && group.folderLabel && group.permission) {
    const permissionLabel = group.permission === 'read' ? labels.read : labels.edit;
    return `${group.folderLabel} (${permissionLabel})`;
  }

  return group.originalDisplayName;
};
