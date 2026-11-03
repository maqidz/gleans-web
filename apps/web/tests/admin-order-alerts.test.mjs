import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile("src/features/admin/lib/order-alerts.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { createOrderWatcher } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const order = (id, second) => ({ id, created_at: `2026-11-03T00:00:${second}.000Z` });

test("existing orders stay silent; a new arrival sounds only once", () => {
  const observe = createOrderWatcher();
  assert.equal(observe(order("GLS-OLD", "01")), false);
  assert.equal(observe(order("GLS-OLD", "01")), false);
  assert.equal(observe(order("GLS-NEW", "02")), true);
  assert.equal(observe(order("GLS-NEW", "02")), false);
  assert.equal(observe(order("GLS-OLD", "01")), false);
  assert.equal(observe(order("GLS-NEW", "02")), false);
});

test("first order after an empty baseline is announced, including after reconnect", () => {
  const observe = createOrderWatcher();
  assert.equal(observe(null), false);
  assert.equal(observe(order("GLS-FIRST", "01")), true);
  assert.equal(observe(null), false);
  assert.equal(observe(order("GLS-FIRST", "01")), false);
  assert.equal(observe(order("GLS-LATER", "05")), true);
});

test("equal timestamps follow the server tie-breaker without duplicate alerts", () => {
  const observe = createOrderWatcher();
  assert.equal(observe(order("GLS-AAA", "01")), false);
  assert.equal(observe(order("GLS-BBB", "01")), true);
  assert.equal(observe(order("GLS-AAA", "01")), false);
  assert.equal(observe(order("GLS-BBB", "01")), false);
});
