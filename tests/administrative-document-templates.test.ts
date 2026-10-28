import assert from 'node:assert/strict';
import test from 'node:test';
import { administrativeDocumentTemplates } from '../src/utils/administrativeDocumentTemplates.ts';

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
