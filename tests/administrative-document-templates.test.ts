import assert from 'node:assert/strict';
import test from 'node:test';
import { administrativeDocumentTemplates } from '../src/utils/administrativeDocumentTemplates.ts';
import { applyPersonnelToForm } from '../src/utils/administrativeDocumentTemplates.ts';
import { administrativePrintPlaceholder } from '../src/utils/administrativeDocumentTemplates.ts';
import { administrativeAssetTableColumns } from '../src/utils/administrativeDocumentTemplates.ts';
import { administrativeWritingLineCounts } from '../src/utils/administrativeDocumentTemplates.ts';
import { administrativeWritingRule } from '../src/utils/administrativeDocumentTemplates.ts';
import { administrativeIncidentSummaryColumns } from '../src/utils/administrativeDocumentTemplates.ts';
import { administrativePrintTheme } from '../src/utils/administrativeDocumentTemplates.ts';
import { administrativeIncidentSummaryRowCount } from '../src/utils/administrativeDocumentTemplates.ts';
import { administrativeWritingDots } from '../src/utils/administrativeDocumentTemplates.ts';

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

test('uses dot leaders for all blank administrative print fields', () => {
    assert.match(administrativePrintPlaceholder, /^\.{20,}$/);
});

test('uses the source eight-column asset table for the incident appendix', () => {
    assert.deepEqual(
        administrativeAssetTableColumns.map(column => column.label),
        ['TT', 'Tên mặt hàng', 'ĐVT', 'Số lượng', 'Trạng thái', 'Serial', 'Đơn giá', 'Thành tiền'],
    );
    assert.equal(administrativeAssetTableColumns.reduce((total, column) => total + column.width, 0), 100);
});

test('keeps the incident appendix on a second page with the source table headings', () => {
    assert.deepEqual(
        administrativeIncidentSummaryColumns.map(column => column.label),
        ['STT', 'Danh mục', 'Số lượng', 'Serial'],
    );
    assert.deepEqual(
        administrativeAssetTableColumns.map(column => column.label),
        ['TT', 'Tên mặt hàng', 'ĐVT', 'Số lượng', 'Trạng thái', 'Serial', 'Đơn giá', 'Thành tiền'],
    );
});

test('limits the incident summary table to five handwritten rows', () => {
    assert.equal(administrativeIncidentSummaryRowCount, 5);
});

test('reserves real ruled lines for handwritten administrative content', () => {
    assert.equal(administrativeWritingLineCounts.standard, 3);
    assert.equal(administrativeWritingLineCounts.extended, 4);
});

test('uses a solid print rule with a fixed physical height', () => {
    assert.deepEqual(administrativeWritingRule, { style: 'solid', heightMm: 8 });
});

test('uses visible dot leaders for blank handwritten writing lines', () => {
    assert.match(administrativeWritingDots, /^\.{250,}$/);
});

test('uses the supplied formal navy print palette', () => {
    assert.deepEqual(administrativePrintTheme, {
        navy: '#1f416a',
        inkBlue: '#0f3b73',
        paleBlue: '#eef4fb',
        gridBlue: '#b7c9df',
    });
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
