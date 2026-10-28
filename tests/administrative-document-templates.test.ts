import assert from 'node:assert/strict';
import test from 'node:test';
import { administrativeDocumentTemplates } from '../src/utils/administrativeDocumentTemplates.ts';
import { applyPersonnelToForm } from '../src/utils/administrativeDocumentTemplates.ts';
import { administrativePrintPlaceholder } from '../src/utils/administrativeDocumentTemplates.ts';
import { administrativeAssetTableColumns } from '../src/utils/administrativeDocumentTemplates.ts';

test('registers the three requested administrative print templates', () => {
    assert.deepEqual(
        administrativeDocumentTemplates.map(template => template.id),
        ['incident-record', 'violation-record', 'explanation-record'],
    );
    assert.deepEqual(
        administrativeDocumentTemplates.map(template => template.title),
        ['Biên bản hiện trường', 'Biên bản ghi nhận lỗi vi phạm', 'Biên bản tường trình'],
    );
});

test('uses a compact blank placeholder that cannot force an administrative form onto a new line', () => {
    assert.equal(administrativePrintPlaceholder.length, 0);
});

test('uses a balanced seven-column asset table for the incident record', () => {
    assert.deepEqual(
        administrativeAssetTableColumns.map(column => column.label),
        ['TT', 'Tên tài sản / hàng hóa', 'ĐVT', 'SL', 'Tình trạng', 'Số serial', 'Ghi chú'],
    );
    assert.equal(administrativeAssetTableColumns.reduce((total, column) => total + column.width, 0), 100);
});

test('fills administrative form identity fields from the employee directory', () => {
    const employee = { id: 'NV001', full_name: 'Nguyễn Văn A', job_position: 'Kỹ thuật viên', department: 'CĐBR Bắc Sài Gòn', phone_number: '0909000000', date_of_birth: '2000-01-02' };

    assert.deepEqual(applyPersonnelToForm(employee, 'violator'), {
        violator: 'Nguyễn Văn A', violatorCode: 'NV001', violatorTitle: 'Kỹ thuật viên', violatorUnit: 'CĐBR Bắc Sài Gòn', violatorPhone: '0909000000',
    });
    assert.deepEqual(applyPersonnelToForm(employee, 'writer'), {
        writer: 'Nguyễn Văn A', birthday: '02/01/2000', position: 'Kỹ thuật viên', writerUnit: 'CĐBR Bắc Sài Gòn',
    });
});
