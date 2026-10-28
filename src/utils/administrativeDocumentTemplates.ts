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
