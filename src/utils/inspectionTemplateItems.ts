export const protectiveItems = [
    { name: 'Dây đai bảo hiểm', unit: 'Chiếc' },
    { name: 'Mũ cứng bảo hộ', unit: 'Chiếc' },
    { name: 'Quần áo bảo hộ lao động', unit: 'Bộ' },
    { name: 'Áo gió', unit: 'Chiếc' },
    { name: 'Áo thun ACT', unit: 'Chiếc' },
    { name: 'Áo sơ mi', unit: 'Chiếc' },
    { name: 'Giày Bảo Hộ Lao Động', unit: 'Đôi' },
    { name: 'Bảng tên nhân viên', unit: 'Cái' },
] as const;

const retiredBlankTemplateItems = new Set(['Áo gió', 'Áo thun ACT', 'Áo sơ mi']);

export const blankProtectiveItems = protectiveItems.filter(item => !retiredBlankTemplateItems.has(item.name));
