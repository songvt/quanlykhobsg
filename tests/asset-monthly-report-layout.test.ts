import assert from 'node:assert/strict';
import test from 'node:test';
import { monthlyReportColumnPercents, monthlyReportExcelColumnWidths } from '../src/utils/assetMonthlyReportLayout.ts';

test('balances the TBVP monthly report columns around a compact asset-name column', () => {
    assert.equal(monthlyReportColumnPercents.assetName, 22);
    assert.equal(monthlyReportColumnPercents.assetType, 13);
    assert.equal(monthlyReportColumnPercents.department, 24);
    assert.equal(Object.values(monthlyReportColumnPercents).reduce((total, width) => total + width, 0), 100);
    assert.deepEqual(monthlyReportExcelColumnWidths.slice(0, 3), [6, 24, 26]);
});
