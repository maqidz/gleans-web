import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText).toString('base64');
const http = compile((await readFile(new URL('../src/features/payments/server/http.ts', import.meta.url), 'utf8')).replace('import "server-only";', ''));
const zod = pathToFileURL(createRequire(import.meta.url).resolve('zod')).href;
const source = (await readFile(new URL('../src/app/api/admin/activity/route.ts', import.meta.url), 'utf8'))
  .replace('from "zod"', `from ${JSON.stringify(zod)}`)
  .replace('import { currentAdmin } from "@/features/auth/session";', 'const currentAdmin = async () => globalThis.activityTest.admin;')
  .replace('import { paymentAdmin } from "@/features/payments/server/repository";', 'const paymentAdmin = () => globalThis.activityTest.client;')
  .replace('from "@/features/payments/server/http"', `from ${JSON.stringify(http)}`);
const { DELETE } = await import(compile(source));

function setup({ admin = { email: 'admin@example.invalid' }, failure = false } = {}) {
  const state = { admin, rows: [{ id: 1 }, { id: 25 }, { id: 26 }, { id: 27 }], calls: [] };
  state.client = { database: { from(table) {
    state.calls.push(table);
    assert.equal(table, 'site_editor_activity');
    return { delete() { return { async lte(column, through) {
      assert.equal(column, 'id');
      if (failure) return { error: { message: 'Database unavailable' } };
      state.rows = state.rows.filter(row => row.id > through);
      return { error: null };
    } }; } };
  } } };
  globalThis.activityTest = state;
  return state;
}

function request(through = '26', origin = 'http://localhost:3000') {
  return new Request(`http://localhost:3000/api/admin/activity?through=${encodeURIComponent(through)}`, {
    method: 'DELETE', headers: { origin, host: 'localhost:3000' },
  });
}

test('activity deletion rejects cross-origin requests and non-admins without touching records', async () => {
  const state = setup();
  assert.equal((await DELETE(request('26', 'https://other.example.invalid'))).status, 403);
  state.admin = null;
  assert.equal((await DELETE(request())).status, 403);
  assert.deepEqual(state.calls, []);
  assert.equal(state.rows.length, 4);
});

test('activity deletion requires a positive safe integer boundary', async () => {
  const state = setup();
  for (const value of ['', '0', '-1', '1.5', 'NaN', 'Infinity', '9007199254740992']) {
    assert.equal((await DELETE(request(value))).status, 400, value);
  }
  assert.deepEqual(state.calls, []);
});

test('clearing history preserves concurrent new activity and safely handles retries', async () => {
  const state = setup();
  const response = await DELETE(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deletedThrough: 26 });
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(state.rows, [{ id: 27 }]);
  assert.equal((await DELETE(request())).status, 200);
  assert.deepEqual(state.rows, [{ id: 27 }]);
});

test('database failure returns a retryable error without claiming success', async () => {
  const state = setup({ failure: true });
  const response = await DELETE(request());
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /belum dapat dihapus/);
  assert.equal(state.rows.length, 4);
});

test.after(() => { delete globalThis.activityTest; });
