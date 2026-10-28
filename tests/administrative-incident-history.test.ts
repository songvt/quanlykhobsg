import assert from 'node:assert/strict';
import test from 'node:test';
import { administrativeIncidentHistoryStorageKey, readAdministrativeIncidentHistory, saveAdministrativeIncidentHistory } from '../src/utils/administrativeIncidentHistory.ts';

const createStorage = () => {
    const values = new Map<string, string>();
    return { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value) };
};

test('stores incident records newest first with immutable audit metadata', () => {
    const storage = createStorage();
    const first = saveAdministrativeIncidentHistory({ date: '28/10/2026', place: 'Kho', investigator: 'A', investigatorTitle: '', investigatorUnit: '', violator: 'B', violatorCode: 'NV01', violatorTitle: '', incidentTime: '', incidentDetail: 'Mất tài sản', incidentItems: '', cause: '', faultAssessment: '', proposal: '', compensationDeadline: '' }, storage, new Date('2026-10-28T01:00:00.000Z'));
    const second = saveAdministrativeIncidentHistory({ ...first, date: '29/10/2026', incidentDetail: 'Hư hỏng' }, storage, new Date('2026-10-29T01:00:00.000Z'));
    const records = readAdministrativeIncidentHistory(storage);
    assert.equal(records.length, 2);
    assert.equal(records[0].date, '29/10/2026');
    assert.equal(records[1].id, first.id);
    assert.equal(records[0].savedAt, '2026-10-29T01:00:00.000Z');
    assert.match(storage.getItem(administrativeIncidentHistoryStorageKey) || '', /Hư hỏng/);
    assert.notEqual(second.id, first.id);
});

test('returns an empty history when browser storage is unavailable or corrupt', () => {
    assert.deepEqual(readAdministrativeIncidentHistory(null), []);
    const storage = { getItem: () => '{not-json', setItem: () => undefined };
    assert.deepEqual(readAdministrativeIncidentHistory(storage), []);
});
