export type AdministrativeDocumentTemplateId = 'incident-record' | 'violation-record' | 'explanation-record';

export interface AdministrativeDocumentTemplate {
    id: AdministrativeDocumentTemplateId;
    title: string;
    description: string;
}

export const administrativeDocumentTemplates: readonly AdministrativeDocumentTemplate[] = [
    {
        id: 'incident-record',
        title: 'Biên bản hiện trường',
        description: 'Ghi nhận sự việc, tài sản thiệt hại và đề xuất xử lý.',
    },
    {
        id: 'violation-record',
        title: 'Biên bản ghi nhận lỗi vi phạm',
        description: 'Ghi nhận lỗi theo nội quy lao động và yêu cầu khắc phục.',
    },
    {
        id: 'explanation-record',
        title: 'Biên bản tường trình',
        description: 'Tường trình diễn biến, nguyên nhân và cam kết của người viết.',
    },
];

export const administrativeIncidentSummaryColumns = [
    { label: 'STT', width: 10 },
    { label: 'Danh mục', width: 45 },
    { label: 'Số lượng', width: 20 },
    { label: 'Serial', width: 25 },
] as const;

export const administrativeIncidentSummaryRowCount = 5;

export const administrativeAssetTableColumns = [
    { label: 'TT', width: 6 },
    { label: 'Tên mặt hàng', width: 25 },
    { label: 'ĐVT', width: 7 },
    { label: 'Số lượng', width: 10 },
    { label: 'Trạng thái', width: 16 },
    { label: 'Serial', width: 14 },
    { label: 'Đơn giá', width: 11 },
    { label: 'Thành tiền', width: 11 },
] as const;

export const administrativeWritingLineCounts = {
    standard: 3,
    extended: 4,
} as const;

export const administrativeWritingRule = {
    style: 'solid',
    heightMm: 8,
} as const;

export const administrativeWritingDots = '................................................................................................................................................................';

export const administrativePrintTheme = {
    navy: '#1f416a',
    inkBlue: '#0f3b73',
    paleBlue: '#eef4fb',
    gridBlue: '#b7c9df',
} as const;

type PersonnelFields = Record<string, string>;
type DirectoryEmployee = { id: string; full_name: string; job_position?: string; department?: string; phone_number?: string; date_of_birth?: string };

const formatBirthDate = (value?: string) => {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

export const applyPersonnelToForm = (employee: DirectoryEmployee, role: 'investigator' | 'violator' | 'writer'): PersonnelFields => {
    const identity = { name: employee.full_name || '', code: employee.id || '', title: employee.job_position || '', unit: employee.department || '', phone: employee.phone_number || '' };
    if (role === 'investigator') return { investigator: identity.name, investigatorTitle: identity.title, investigatorUnit: identity.unit, investigatorPhone: identity.phone };
    if (role === 'violator') return { violator: identity.name, violatorCode: identity.code, violatorTitle: identity.title, violatorUnit: identity.unit, violatorPhone: identity.phone };
    return { writer: identity.name, birthday: formatBirthDate(employee.date_of_birth), position: identity.title, writerUnit: identity.unit };
};

// A concise dot leader keeps every blank printable field visible without overflowing narrow columns.
export const administrativePrintPlaceholder = '................................';
