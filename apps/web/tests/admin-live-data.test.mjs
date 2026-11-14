import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/features/admin/lib/live-data.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { mapAdminOrders, emptyAdminState } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const row = (overrides = {}) => ({ id: 'GLS-123456789ABC', owner_id: null, customer_name: 'Guest', whatsapp: '08123456789', document_name: 'sample.pdf', amount: 10000, status: 'pending', fulfillment_status: 'pending', created_at: '2026-11-12T18:00:00Z', completed_at: null, ...overrides });
test('empty backend does not create demo customers or orders', () => {
  assert.deepEqual(mapAdminOrders([]), emptyAdminState());
  assert.equal(emptyAdminState().customers.length, 0);
  assert.equal(emptyAdminState().orders.length, 0);
});
test('phone formatting groups guests without merging account ownership', () => {
  const state = mapAdminOrders([row(), row({id:'second', whatsapp:'+62 8123456789'}), row({id:'third', owner_id:'account-a'}), row({id:'fourth', owner_id:'account-b'})]);
  assert.equal(state.customers.length, 3);
  assert.equal(state.orders[0].customerId, state.orders[1].customerId);
  assert.notEqual(state.orders[0].customerId, state.orders[2].customerId);
  assert.notEqual(state.orders[2].customerId, state.orders[3].customerId);
});
test('unpaid orders cannot appear fulfilled and delivery is not invented', () => {
  const state = mapAdminOrders([row({fulfillment_status:'completed'}), row({id:'paid', status:'paid', fulfillment_status:'completed'}), row({id:'failed',status:'failed'}), row({id:'expired', status:'expired'})]);
  assert.equal(state.orders[0].processing, 'Belum diproses');
  assert.equal(state.orders[1].processing, 'Selesai');
  assert.equal(state.orders[1].delivery, 'Belum dikirim');
  assert.equal(state.orders[2].payment, 'Gagal');
  assert.equal(state.orders[3].payment, 'Kedaluwarsa');
  assert.equal(state.orders[0].date, '2026-11-13');
});
