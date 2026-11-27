import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile('src/features/admin/lib/chart-period.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { jakartaToday, presetRange, rangeDates, chartHistory, CHART_PRESETS } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('reporting days follow Jakarta even before midnight UTC', () => {
  assert.equal(jakartaToday(new Date('2026-11-26T16:59:59Z')), '2026-11-26');
  assert.equal(jakartaToday(new Date('2026-11-26T17:00:00Z')), '2026-11-27');
});

test('rolling presets include both endpoints and cross year boundaries', () => {
  const seven = presetRange('last7', '2027-01-03');
  assert.deepEqual(seven, { from: '2026-12-28', to: '2027-01-03' });
  assert.equal(rangeDates(seven).length, 7);
  assert.equal(rangeDates(presetRange('last30', '2027-01-03')).length, 30);
  const fourteen = presetRange('last14', '2027-01-03');
  assert.deepEqual(fourteen, { from: '2026-12-21', to: '2027-01-03' });
  assert.equal(rangeDates(fourteen).length, 14);
  assert.deepEqual(CHART_PRESETS.map(item => item.value), ['last7', 'last14', 'last30', 'last90', 'custom']);
});

test('ninety-day preset crosses years and includes leap days exactly once', () => {
  const range = presetRange('last90', '2028-03-01');
  assert.deepEqual(range, { from: '2027-12-03', to: '2028-03-01' });
  assert.equal(rangeDates(range).length, 90);
  assert.equal(rangeDates(range).filter(date => date === '2028-02-29').length, 1);
});

test('custom periods fill missing dates and count only successful payments as income', () => {
  const orders = [
    { date: '2026-10-31', payment: 'Berhasil', amount: 99999 },
    { date: '2026-11-01', payment: 'Berhasil', amount: 5000 },
    { date: '2026-11-01', payment: 'Berhasil', amount: 10000 },
    { date: '2026-11-01', payment: 'Menunggu', amount: 20000 },
    { date: '2026-11-03', payment: 'Refund', amount: 5000 },
    { date: '2026-11-04', payment: 'Berhasil', amount: 99999 },
  ];
  assert.deepEqual(chartHistory(orders, { from: '2026-11-01', to: '2026-11-03' }), [
    { date: '2026-11-01', orders: 3, income: 15000 },
    { date: '2026-11-02', orders: 0, income: 0 },
    { date: '2026-11-03', orders: 1, income: 0 },
  ]);
});
