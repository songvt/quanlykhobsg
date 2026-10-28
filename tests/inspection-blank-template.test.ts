import assert from 'node:assert/strict';
import test from 'node:test';
import { blankProtectiveItems, protectiveItems } from '../src/utils/inspectionTemplateItems.ts';

test('excludes the three retired shirt items from the blank inspection template', () => {
    const names = blankProtectiveItems.map(item => item.name);

    assert.deepEqual(names, [
        'Dây đai bảo hiểm',
        'Mũ cứng bảo hộ',
        'Quần áo bảo hộ lao động',
        'Giày Bảo Hộ Lao Động',
        'Bảng tên nhân viên',
    ]);
});

test('uses the same five approved protective items in the completed inspection minutes', () => {
    assert.deepEqual(protectiveItems, blankProtectiveItems);
    assert.equal(protectiveItems.length, 5);
});
