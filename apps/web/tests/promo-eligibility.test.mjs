import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
async function moduleUrl(path, replacements = {}) {
  let source = (await readFile(path, 'utf8')).replace('import "server-only";', '');
  source = source.replace('"zod"', JSON.stringify(pathToFileURL(require.resolve('zod')).href));
  for (const [before, after] of Object.entries(replacements)) source = source.replace(before, after);
  return `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText).toString('base64')}`;
}
const load = async (path, replacements) => import(await moduleUrl(path, replacements));
const policyUrl = await moduleUrl('src/features/orders/lib/promo-eligibility.ts');
const { requiresCompletedCheck } = await import(policyUrl);
const digest = value => createHash('sha256').update(value).digest('hex');
const state = { orders: [], cookieList: [], user: null, guest: null, dbError: null, writes: [], promoCode: 'HEMAT5RIBU' };

function query() {
  const filters = [];
  let maximum = Infinity;
  const result = () => ({ data: state.orders.filter(row => filters.every(filter => filter(row))).slice(0, maximum), error: state.dbError });
  const builder = {
    select: () => builder,
    eq: (key, value) => { filters.push(row => row[key] === value); return builder; },
    or: expression => { const parts = expression.split(',').map(part => part.split('.eq.')); filters.push(row => parts.some(([key, value]) => row[key] === value)); return builder; },
    in: (key, values) => { filters.push(row => values.includes(row[key])); return builder; },
    limit: value => { maximum = value; return builder; },
    maybeSingle: async () => { const { data, error } = result(); return { data: data[0] ?? null, error }; },
    then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject),
  };
  return builder;
}
const admin = () => ({ database: {
  from: table => { assert.equal(table, 'duitku_orders'); return query(); },
  rpc: async (name, args) => {
    state.writes.push({ name, args });
    return { data: { id: args.p_id, amount: args.p_amount, guest_hash: args.p_guest, payment_method: args.p_method ?? 'qris' }, error: null };
  },
} });
const reset = () => Object.assign(state, { orders: [], cookieList: [], user: null, guest: null, dbError: null, writes: [], promoCode: 'HEMAT5RIBU' });
globalThis.__promoEligibility = {
  paymentAdmin: admin,
  cookies: async () => ({ getAll: () => state.cookieList }),
  validAccessCode: value => /^[A-Za-z0-9_-]{43}$/.test(value),
  matchesAccess: (code, hash) => /^[A-Za-z0-9_-]{43}$/.test(code) && /^[a-f0-9]{64}$/.test(hash ?? '') && timingSafeEqual(Buffer.from(digest(code), 'hex'), Buffer.from(hash, 'hex')),
  dashboardUser: async () => state.user,
  guestSession: async () => state.guest,
  readActivePromo: async () => ({ code: state.promoCode, discount: 5000, label: 'Diskon 50%', requiresCompletedCheck: requiresCompletedCheck({ code: state.promoCode }) }),
};
const eligibilityUrl = await moduleUrl('src/features/orders/server/promo-eligibility.ts', {
  'import { cookies } from "next/headers";': 'const {cookies} = globalThis.__promoEligibility;',
  'import { paymentAdmin } from "@/features/payments/server/repository";': 'const {paymentAdmin} = globalThis.__promoEligibility;',
  'import { matchesAccess, validAccessCode } from "@/features/payments/server/guest";': 'const {matchesAccess,validAccessCode} = globalThis.__promoEligibility;',
});
const { hasCompletedShieldCheck } = await import(eligibilityUrl);
const httpUrl = await moduleUrl('src/features/payments/server/http.ts');
const quoteRoute = await load('src/app/api/promotions/quote/route.ts', {
  'import { readActivePromo } from "@/features/admin/lib/site-editor";': 'const {readActivePromo} = globalThis.__promoEligibility;',
  'import { readShieldPrice } from "@/features/orders/lib/shield-pricing";': 'const readShieldPrice = async () => 10000;',
  'import { allowOrderLookup } from "@/features/payments/server/lookup-limit";': 'const allowOrderLookup = async () => true;',
  'import { dashboardUser } from "@/features/auth/server";': 'const {dashboardUser} = globalThis.__promoEligibility;',
  'import { guestSession } from "@/features/payments/server/guest";': 'const {guestSession} = globalThis.__promoEligibility;',
  '"@/features/orders/server/promo-eligibility"': JSON.stringify(eligibilityUrl),
  '"@/features/orders/lib/promo-eligibility"': JSON.stringify(policyUrl),
  '"@/features/payments/server/http"': JSON.stringify(httpUrl),
});
const pricingUrl = await moduleUrl('src/features/orders/lib/pricing.ts', { '"@/lib/format"': JSON.stringify(await moduleUrl('src/lib/format.ts')) });
const checkoutRoute = await load('src/app/api/payments/orders/route.ts', {
  'import { reserveInvoice } from "@/features/payments/server/invoice";': 'const reserveInvoice = reserve => reserve("GLS-11112222");',
  'import { dashboardUser, serverClient } from "@/features/auth/server";': 'const {dashboardUser} = globalThis.__promoEligibility;',
  'import { readActivePromo } from "@/features/admin/lib/site-editor";': 'const {readActivePromo} = globalThis.__promoEligibility;',
  '"@/features/orders/lib/pricing"': JSON.stringify(pricingUrl),
  'import { readShieldPrice } from "@/features/orders/lib/shield-pricing";': 'const readShieldPrice = async () => 10000;',
  '"@/lib/plans"': JSON.stringify(await moduleUrl('src/lib/plans.ts')),
  'import { duitkuConfig } from "@/features/payments/server/duitku";': 'const duitkuConfig = () => ({});',
  'import { ORDER_COLUMNS, paymentAdmin, publicOrder, type StoredOrder } from "@/features/payments/server/repository";': 'const {paymentAdmin} = globalThis.__promoEligibility; const ORDER_COLUMNS = "id,amount"; const publicOrder = order => order;',
  'import { guestSession, accessDigest, orderAccessCode } from "@/features/payments/server/guest";': 'const {guestSession} = globalThis.__promoEligibility; const accessDigest = () => "digest"; const orderAccessCode = () => "code";',
  '"@/features/orders/server/promo-eligibility"': JSON.stringify(eligibilityUrl),
  '"@/features/orders/lib/promo-eligibility"': JSON.stringify(policyUrl),
  '"@/features/payments/server/http"': JSON.stringify(httpUrl),
});
const request = (path, body) => new Request(`http://localhost:3000${path}`, {
  method: 'POST', headers: { origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const requestId = '550e8400-e29b-41d4-a716-446655440001';
const checkout = (method = 'qris') => checkoutRoute.POST(request('/api/payments/orders', {
  requestId, ticketId: '550e8400-e29b-41d4-a716-446655440002', words: 42, whatsapp: '081234567890', promo: state.promoCode, method, expectedAmount: 5000,
}));

test('only the recheck campaign inherits eligibility; each campaign can be configured explicitly', async () => {
  assert.equal(requiresCompletedCheck({ code: ' hemat5ribu ' }), true);
  for (const code of ['GLEANS10', 'MAHASISWA', 'SKRIPSIAMAN']) assert.equal(requiresCompletedCheck({ code }), false);
  assert.equal(requiresCompletedCheck({ code: 'HEMAT5RIBU', requiresCompletedCheck: false }), false);
  assert.equal(requiresCompletedCheck({ code: 'CEKULANG', requiresCompletedCheck: true }), true);
  const { promoSchema } = await load('src/features/admin/lib/model.ts');
  const record = { id: 'promo', name: 'Cek ulang', title: 'Diskon', type: 'Kode promo', code: 'CEKULANG', discount: 50, start: '2026-01-01', end: '2027-12-31', active: true, requiresCompletedCheck: true };
  assert.equal(promoSchema.parse(record).requiresCompletedCheck, true);
  assert.equal(promoSchema.parse({ ...record, requiresCompletedCheck: false }).requiresCompletedCheck, false);
});

test('first-time, unpaid and unfinished customers cannot qualify; another customer or a supplied phone is insufficient', async () => {
  reset();
  for (const [status, fulfillment_status] of [['pending', 'pending'], ['paid', 'pending'], ['paid', 'processing'], ['paid', 'failed'], ['pending', 'completed']]) {
    state.orders = [{ id: 'GLS-AABBCCDD', owner_id: 'owner', guest_hash: 'guest', status, fulfillment_status }];
    assert.equal(await hasCompletedShieldCheck({ userId: 'owner', guestHash: 'guest' }), false);
  }
  state.orders = [{ id: 'GLS-AABBCCDD', owner_id: 'other', guest_hash: 'other-guest', whatsapp: '081234567890', status: 'paid', fulfillment_status: 'completed' }];
  assert.equal(await hasCompletedShieldCheck({ userId: 'owner', guestHash: 'guest', whatsapp: '081234567890' }), false);
  assert.equal(await hasCompletedShieldCheck({}), false);
});

test('one completed paid check qualifies by verified account or guest browser, including an expired report', async () => {
  reset();
  state.orders = [{ id: 'GLS-AABBCCDD', owner_id: 'owner', guest_hash: 'guest', status: 'paid', fulfillment_status: 'completed', report_expires_at: '2020-01-01' }];
  assert.equal(await hasCompletedShieldCheck({ userId: 'owner' }), true);
  assert.equal(await hasCompletedShieldCheck({ guestHash: 'guest' }), true);
  assert.equal(await hasCompletedShieldCheck({ userId: 'owner', guestHash: 'new-browser' }), true);
  assert.equal(await hasCompletedShieldCheck({ userId: 'new-account', guestHash: 'guest' }), true);
});

test('a restored guest report link qualifies only with the matching secret and completed payment', async () => {
  reset();
  const code = 'a'.repeat(43);
  for (const id of ['GLS-AABBCCDD', 'GLS-AABBCCDDEEFF']) {
    state.orders = [{ id, access_hash: digest(code), status: 'paid', fulfillment_status: 'completed' }];
    state.cookieList = [{ name: `gleans_access_${id}`, value: code }];
    assert.equal(await hasCompletedShieldCheck({ guestHash: 'new-browser' }), true);
    state.cookieList[0].value = 'b'.repeat(43);
    assert.equal(await hasCompletedShieldCheck({}), false);
    state.cookieList[0].value = code;
    state.orders[0].fulfillment_status = 'processing';
    assert.equal(await hasCompletedShieldCheck({}), false);
  }
});

test('database failures fail closed rather than silently granting the discount', async () => {
  reset(); state.dbError = { message: 'Unavailable' };
  await assert.rejects(() => hasCompletedShieldCheck({ userId: 'owner' }), /DATABASE_UNAVAILABLE/);
  state.cookieList = [{ name: 'gleans_access_GLS-AABBCCDD', value: 'a'.repeat(43) }];
  await assert.rejects(() => hasCompletedShieldCheck({}), /DATABASE_UNAVAILABLE/);
});

test('quote rejects first-time recheck use, allows eligible use and leaves ordinary promotions available', async () => {
  reset();
  const quote = () => quoteRoute.POST(request('/api/promotions/quote', { code: state.promoCode }));
  const denied = await quote();
  assert.equal(denied.status, 403); assert.equal((await denied.json()).code, 'PROMO_REQUIRES_COMPLETED_CHECK');
  state.promoCode = 'GLEANS10'; assert.equal((await quote()).status, 200);
  state.promoCode = 'HEMAT5RIBU'; state.user = { id: 'owner' };
  state.orders = [{ id: 'GLS-AABBCCDD', owner_id: 'owner', status: 'paid', fulfillment_status: 'completed' }];
  assert.equal((await quote()).status, 200);
  state.dbError = { message: 'Unavailable' }; assert.equal((await quote()).status, 503);
});

test('direct checkout cannot bypass eligibility for QRIS, balance or quota and never reserves a new invoice', async () => {
  reset(); state.user = { id: 'owner' }; state.guest = { hash: 'guest', secret: 'secret' };
  for (const method of ['qris', 'balance', 'quota']) {
    const response = await checkout(method);
    assert.equal(response.status, 403); assert.equal((await response.json()).code, 'PROMO_REQUIRES_COMPLETED_CHECK');
  }
  assert.equal(state.writes.length, 0);
});

test('eligible checkout reserves the discounted server amount and ordinary promos still work for new customers', async () => {
  reset(); state.user = { id: 'owner' }; state.guest = { hash: 'guest', secret: 'secret' };
  state.orders = [{ id: 'GLS-AABBCCDD', owner_id: 'owner', status: 'paid', fulfillment_status: 'completed' }];
  assert.equal((await checkout()).status, 201);
  assert.equal(state.writes[0].args.p_amount, 5000); assert.equal(state.writes[0].args.p_promo, 'HEMAT5RIBU');
  state.orders = []; state.promoCode = 'GLEANS10'; assert.equal((await checkout('balance')).status, 201);
});

test('a retry keeps its existing invoice; another customer cannot claim that retry', async () => {
  reset(); state.user = { id: 'owner' }; state.guest = { hash: 'guest', secret: 'secret' };
  state.orders = [{ id: 'GLS-AABBCCDD', owner_id: 'owner', guest_hash: 'guest', request_key: requestId, amount: 4500, status: 'pending', fulfillment_status: 'pending', payment_method: 'qris' }];
  const response = await checkout(); assert.equal(response.status, 201); assert.equal((await response.json()).order.amount, 4500);
  state.user = { id: 'other' }; state.guest = { hash: 'other-guest', secret: 'other-secret' };
  assert.equal((await checkout()).status, 403); assert.equal(state.writes.length, 0);
});
