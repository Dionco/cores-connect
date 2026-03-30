import {
  buildSecurityGroupSections,
  getSecurityGroupDisplayLabel,
  normalizeSecurityGroup,
} from '@/lib/automation/securityGroups';

describe('security group normalization', () => {
  it('parses SharePoint read and edit groups into folder + permission', () => {
    const readGroup = normalizeSecurityGroup({
      id: '1',
      displayName: 'SG_SP_Cores-Algemeen_Trading-Lezen',
    });
    const editGroup = normalizeSecurityGroup({
      id: '2',
      displayName: 'SG_SP_Cores-Algemeen_Trading-Bewerken',
    });

    expect(readGroup.kind).toBe('sharepoint');
    expect(readGroup.folderLabel).toBe('Trading');
    expect(readGroup.permission).toBe('read');

    expect(editGroup.kind).toBe('sharepoint');
    expect(editGroup.folderLabel).toBe('Trading');
    expect(editGroup.permission).toBe('edit');
  });

  it('keeps non-matching names in the other bucket', () => {
    const group = normalizeSecurityGroup({
      id: '3',
      displayName: 'Cores_Algemeen',
    });

    expect(group.kind).toBe('other');
    expect(group.folderLabel).toBeNull();
    expect(group.permission).toBeNull();
  });

  it('builds folder sections and sorts read before edit', () => {
    const sections = buildSecurityGroupSections([
      { id: 'b', displayName: 'SG_SP_Cores-Algemeen_Trading-Bewerken' },
      { id: 'a', displayName: 'SG_SP_Cores-Algemeen_Trading-Lezen' },
      { id: 'x', displayName: 'Alle gebruikers' },
    ]);

    expect(sections.sharepoint).toHaveLength(1);
    expect(sections.sharepoint[0].folderLabel).toBe('Trading');
    expect(sections.sharepoint[0].items.map((item) => item.permission)).toEqual(['read', 'edit']);

    expect(sections.other).toHaveLength(1);
    expect(sections.other[0].originalDisplayName).toBe('Alle gebruikers');
  });

  it('formats selected labels to friendly folder + permission text', () => {
    const normalized = normalizeSecurityGroup({
      id: '1',
      displayName: 'SG_SP_Cores-Algemeen_Logistiek-Lezen',
    });

    const label = getSecurityGroupDisplayLabel(normalized, {
      read: 'Read',
      edit: 'Edit',
    });

    expect(label).toBe('Logistiek (Read)');
  });
});
