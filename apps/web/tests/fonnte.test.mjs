import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

async function moduleUrl(path, substitutions = {}) {
  let source = (await readFile(path, 'utf8')).replace('import "server-only";', '');
  for (const [before, after] of Object.entries(substitutions)) source = source.replace(before, after);
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
}
const providerUrl = await moduleUrl('src/features/whatsapp/server/fonnte.ts');
const provider = await import(providerUrl);
const require = createRequire(import.meta.url);
const templateUrl = await moduleUrl('src/features/whatsapp/template.ts', { '"zod"': JSON.stringify(pathToFileURL(require.resolve('zod')).href) });
const { DEFAULT_REPORT_TEMPLATE, reportTemplateSchema, renderReportTemplate, PREVIEW_VALUES } = await import(templateUrl);
const messagesUrl = await moduleUrl('src/features/whatsapp/server/messages.ts', { '"../template"': JSON.stringify(templateUrl) });
const { reportReadyMessage } = await import(messagesUrl);
const examplePromo = { id: 'promo-GLEANS10', code: 'HEMAT5RIBU', discount: 50, endsOn: '2027-12-31' };

test('single Indonesian recipient normalization rejects bulk/variable injection', () => {
  for (const input of ['081995473482', '+62 819-9547-3482', '6281995473482']) assert.equal(provider.whatsappTarget(input), '6281995473482');
  for (const input of ['081995473482,08123456789', '081995473482|Admin', '123@g.us', 'abc081995473482', '0812', '']) {
    assert.throws(() => provider.whatsappTarget(input), { code: 'INVALID_RECIPIENT' });
  }
});

test('send uses private POST credentials and treats accepted separately from ambiguous/rejected requests', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.FONNTE_TOKEN;
  process.env.FONNTE_TOKEN = 'test-device-token';
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://api.fonnte.com/send');
      assert.equal(init.method, 'POST');
      assert.equal(init.headers.Authorization, 'test-device-token');
      assert.equal(init.body.get('target'), '6281995473482');
      assert.equal(init.body.get('message'), 'Hasil siap');
      assert.equal(init.body.get('preview'), 'false');
      assert.equal(init.cache, 'no-store');
      assert.equal(init.redirect, 'error');
      return Response.json({ status: true, id: ['provider-1'] });
    };
    assert.equal(await provider.sendWhatsApp('081995473482', 'Hasil siap'), 'provider-1');
    globalThis.fetch = async () => Response.json({ status: false, reason: 'private-provider-response' });
    await assert.rejects(provider.sendWhatsApp('081995473482', 'Hasil siap'), error => error.code === 'FONNTE_REJECTED' && !error.uncertain && !error.message.includes('private'));
    globalThis.fetch = async () => { throw new Error('Network timed out'); };
    await assert.rejects(provider.sendWhatsApp('081995473482', 'Hasil siap'), error => error.uncertain);
    globalThis.fetch = async () => new Response('invalid', { status: 502 });
    await assert.rejects(provider.sendWhatsApp('081995473482', 'Hasil siap'), error => error.uncertain);
    globalThis.fetch = async () => Response.json({ unexpected: true });
    await assert.rejects(provider.sendWhatsApp('081995473482', 'Hasil siap'), error => error.uncertain);
    delete process.env.FONNTE_TOKEN;
    globalThis.fetch = () => { throw new Error('Must not fetch'); };
    await assert.rejects(provider.sendWhatsApp('081995473482', 'Hasil siap'), { code: 'FONNTE_NOT_CONFIGURED' });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.FONNTE_TOKEN; else process.env.FONNTE_TOKEN = originalToken;
  }
});

test('ready message uses the recorded AI score and selected promotion without unresolved placeholders', () => {
  const order = { id: 'GLS-12345678', ai_score: 0, customer_name: 'Alya', document_name: 'Bab 1.pdf', report_expires_at: '2026-11-24T03:00:00Z' };
  const message = reportReadyMessage(order, 'https://www.gleans.my.id', DEFAULT_REPORT_TEMPLATE, examplePromo, 'https://storage.example.test/private-report?token=signed-test');
  assert.match(message, /https:\/\/storage.example.test\/private-report\?token=signed-test/);
  assert.match(message, /Skor AI: \*0%\*/);
  assert.match(message, /diskon 50%/);
  assert.match(message, /HEMAT5RIBU/);
  assert.match(message, /31 Desember 2027/);
  assert.doesNotMatch(message, /\{[a-z_]+\}/);
  assert.doesNotMatch(message, /access=|report_key|Pembayaran berhasil/);
  assert.throws(() => reportReadyMessage({ ...order, ai_score: null }, 'https://www.gleans.my.id', DEFAULT_REPORT_TEMPLATE, examplePromo), /WHATSAPP_SCORE_MISSING/);
  assert.throws(() => reportReadyMessage(order, 'https://www.gleans.my.id'), /WHATSAPP_PROMO_UNAVAILABLE/);
  const legacy = reportReadyMessage(order, 'https://www.gleans.my.id', '{dokumen} {tautan_hasil} {batas_unduh}');
  assert.match(legacy, /10\.00 WIB/);
  assert.throws(() => reportReadyMessage({ id: 'a', report_expires_at: '2026-11-24' }, 'http://localhost:3000'));
});

test('worker sends only available paid completed reports; uncertain delivery never gets automatic retry', async () => {
  let order = { id: 'GLS-12345678', ai_score: 35, status: 'paid', fulfillment_status: 'completed', report_key: 'private-report', report_expires_at: '2099-01-01T00:00:00Z', whatsapp: '081995473482' };
  let enabled = true;
  let claims = 0;
  let reads = 0;
  let disableAfterRead = false;
  let sends = 0;
  let sendError;
  let attempts = 1;
  let finished;
  let saveFailure = false;
  const state = {
    findOrder: async () => order,
    paymentAdmin: () => ({ storage: { from: () => ({ createSignedUrl: async (key, ttl) => {
      assert.equal(key, 'private-report'); assert.ok(ttl > 0 && ttl <= 86400);
      return { data: { signedUrl: 'https://storage.example.test/report.pdf?token=signed-test' }, error: null };
    } }) }, database: { rpc: async (name, args) => {
      if (name === 'claim_shield_whatsapp') { claims++; return { data: [{ id: 'job', order_id: order.id, claim_token: 'lease', attempts }], error: null }; }
      assert.equal(name, 'finish_shield_whatsapp');
      assert.equal(args.p_claim, 'lease');
      finished = args;
      return { data: !saveFailure, error: saveFailure ? {} : null };
    } } }),
    readWhatsAppSettings: async () => ({ template: DEFAULT_REPORT_TEMPLATE, promoId: examplePromo.id, enabled: disableAfterRead ? ++reads === 1 : enabled }),
    FonnteError: provider.FonnteError,
    fonnteConfigured: () => true,
    sendWhatsApp: async (_target, message) => { sends++; assert.match(message, /storage.example.test/); if (sendError) throw sendError; return 'provider-1'; },
  };
  globalThis.__fonnteWorker = state;
  const { dispatchReportNotifications } = await import(await moduleUrl('src/features/whatsapp/server/dispatch.ts', {
    'import { findOrder, paymentAdmin } from "@/features/payments/server/repository";': 'const { findOrder, paymentAdmin } = globalThis.__fonnteWorker;',
    'import { FonnteError, fonnteConfigured, sendWhatsApp } from "./fonnte";': 'const { FonnteError, fonnteConfigured, sendWhatsApp } = globalThis.__fonnteWorker;',
    '"./messages"': JSON.stringify(messagesUrl),
    'import { listWhatsAppPromos, readWhatsAppSettings } from "./settings";': `const { readWhatsAppSettings } = globalThis.__fonnteWorker; const listWhatsAppPromos = async () => [${JSON.stringify(examplePromo)}];`,
    '"../template"': JSON.stringify(templateUrl),
    'import { PAYMENT_DOCUMENT_BUCKET } from "@/features/payments/types";': 'const PAYMENT_DOCUMENT_BUCKET = "shield-documents";',
  }));
  const previousOrigin = process.env.WHATSAPP_PUBLIC_URL;
  process.env.WHATSAPP_PUBLIC_URL = 'https://www.gleans.my.id';
  try {
    enabled = false;
    assert.equal((await dispatchReportNotifications()).checked, 0);
    assert.equal(claims, 0); assert.equal(sends, 0);
    enabled = true; disableAfterRead = true;
    assert.equal((await dispatchReportNotifications()).skipped, 1);
    assert.equal(sends, 0);
    disableAfterRead = false;
    assert.equal((await dispatchReportNotifications()).accepted, 1);
    assert.equal(finished.p_provider, 'provider-1');
    assert.equal(sends, 1);
    for (const change of [{ status: 'pending' }, { fulfillment_status: 'processing' }, { report_expires_at: '2000-01-01' }, { report_key: null }]) {
      const ready = order; order = { ...ready, ...change };
      assert.equal((await dispatchReportNotifications()).skipped, 1);
      order = ready;
    }
    assert.equal(sends, 1);
    sendError = new provider.FonnteError('FONNTE_REJECTED');
    assert.equal((await dispatchReportNotifications()).retried, 1);
    attempts = 5;
    assert.equal((await dispatchReportNotifications()).failed, 1);
    attempts = 1;
    sendError = new provider.FonnteError('FONNTE_CONNECTION_UNKNOWN', true);
    assert.equal((await dispatchReportNotifications()).uncertain, 1);
    assert.equal(finished.p_state, 'uncertain');
    sendError = undefined; saveFailure = true;
    await assert.rejects(dispatchReportNotifications(), /WHATSAPP_QUEUE_SAVE_FAILED/);
  } finally {
    delete globalThis.__fonnteWorker;
    if (previousOrigin === undefined) delete process.env.WHATSAPP_PUBLIC_URL; else process.env.WHATSAPP_PUBLIC_URL = previousOrigin;
  }
});

test('template validates supported variables and renders substitutions in one pass', () => {
  assert.equal(reportTemplateSchema.safeParse(DEFAULT_REPORT_TEMPLATE).success, true);
  for (const value of ['', '{nama}', '{invoice} {tautan_hasil} {unknown}', '{invoice} {tautan_hasil} {nama', 'x'.repeat(4001)]) {
    assert.equal(reportTemplateSchema.safeParse(value).success, false);
  }
  const message = renderReportTemplate('Halo {nama}, {invoice}: {tautan_hasil}', { ...PREVIEW_VALUES, nama: '{invoice}' });
  assert.match(message, /^Halo \{invoice\}, GLS-/);
  assert.match(message, /https:\/\/www.gleans.my.id/);
  const custom = reportReadyMessage({ id: 'GLS-test', report_expires_at: '2026-11-24T03:00:00Z', customer_name: 'Taqi', document_name: 'Bab 1.pdf' }, 'https://www.gleans.my.id', 'Halo {nama}, hasil {dokumen} ({invoice}): {tautan_hasil}');
  assert.match(custom, /^Halo Taqi, hasil Bab 1.pdf \(GLS-test\)/);
});

test('admin template settings require admin, origin, valid placeholders and a current revision', async () => {
  let admin = null;
  let saves = 0;
  let controls = 0;
  const templateId = '11111111-1111-4111-8111-111111111111';
  let lastInput;
  globalThis.__fonnteSettings = {
    currentAdmin: async () => admin,
    setWhatsAppEnabled: async (enabled, revision) => { controls++; return revision === 1; },
    deleteWhatsAppTemplate: async (id, revision) => { controls++; if (id === templateId) throw new Error('WHATSAPP_TEMPLATE_ACTIVE'); return revision === 1; },
    readWhatsAppLibrary: async () => ({ settings: { template: DEFAULT_REPORT_TEMPLATE, revision: 1, promoId: 'promo-GLEANS10', activeTemplateId: templateId }, templates: [{ id: templateId, name: 'Template 1', template: DEFAULT_REPORT_TEMPLATE, promoId: 'promo-GLEANS10' }] }),
    listWhatsAppPromos: async () => [examplePromo],
    saveWhatsAppTemplate: async (input, actor) => { saves++; lastInput = input; assert.equal(actor, 'admin@example.test'); return input.revision === 1; },
  };
  const route = await import(await moduleUrl('src/app/api/admin/whatsapp/route.ts', {
    '"zod"': JSON.stringify(pathToFileURL(require.resolve('zod')).href),
    'import { currentAdmin } from "@/features/auth/session";': 'const { currentAdmin } = globalThis.__fonnteSettings;',
    'import { json, sameOrigin } from "@/features/payments/server/http";': 'const json = (value, status=200) => Response.json(value, { status }); const sameOrigin = request => request.headers.get("origin") === new URL(request.url).origin;',
    'import { fonnteConfigured, fonnteDevice } from "@/features/whatsapp/server/fonnte";': 'const fonnteConfigured = () => true; const fonnteDevice = async () => ({ connected: true });',
    'import { listWhatsAppPromos, readWhatsAppLibrary, saveWhatsAppTemplate, setWhatsAppEnabled, deleteWhatsAppTemplate } from "@/features/whatsapp/server/settings";': 'const { listWhatsAppPromos, readWhatsAppLibrary, saveWhatsAppTemplate, setWhatsAppEnabled, deleteWhatsAppTemplate } = globalThis.__fonnteSettings;',
    '"@/features/whatsapp/template"': JSON.stringify(templateUrl),
  }));
  const request = (body, origin = 'https://example.test') => new Request('https://example.test/api/admin/whatsapp', { method: 'PUT', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ id: templateId, name: 'Template 1', promoId: 'promo-GLEANS10', ...body }) });
  try {
    assert.equal((await route.GET()).status, 403);
    assert.equal((await route.PUT(request({ template: DEFAULT_REPORT_TEMPLATE, revision: 1 }))).status, 403);
    admin = { email: 'admin@example.test' };
    assert.equal((await route.PUT(request({ template: DEFAULT_REPORT_TEMPLATE, revision: 1 }, 'https://evil.test'))).status, 403);
    assert.equal((await route.PUT(request({ template: '{nama}', revision: 1 }))).status, 400);
    assert.equal((await route.PUT(request({ template: DEFAULT_REPORT_TEMPLATE, revision: 0 }))).status, 400);
    assert.equal((await route.PUT(request({ template: DEFAULT_REPORT_TEMPLATE, revision: 1, promoId: 'not-active' }))).status, 400);
    assert.equal((await route.PUT(request({ template: DEFAULT_REPORT_TEMPLATE, revision: 1, name: ' ' }))).status, 400);
    assert.equal((await route.PUT(request({ template: DEFAULT_REPORT_TEMPLATE, revision: 1, id: 'bad-id' }))).status, 400);
    assert.equal(saves, 0);
    assert.equal((await route.PUT(request({ template: DEFAULT_REPORT_TEMPLATE, revision: 1 }))).status, 200);
    assert.equal(lastInput.activate, false);
    assert.equal((await route.PUT(request({ template: DEFAULT_REPORT_TEMPLATE, revision: 1, activate: true }))).status, 200);
    assert.equal(lastInput.activate, true);
    assert.equal((await route.PUT(request({ template: DEFAULT_REPORT_TEMPLATE, revision: 2 }))).status, 409);
    const change = (body, origin = 'https://example.test') => new Request('https://example.test/api/admin/whatsapp', { method: 'PATCH', headers: { origin }, body: JSON.stringify(body) });
    assert.equal((await route.PATCH(change({ enabled: false, revision: 1 }, 'https://evil.test'))).status, 403);
    assert.equal((await route.PATCH(change({ enabled: 'false', revision: 1 }))).status, 400);
    assert.equal((await route.PATCH(change({ enabled: false, revision: 1 }))).status, 200);
    assert.equal((await route.PATCH(change({ enabled: true, revision: 2 }))).status, 409);
    assert.equal((await route.DELETE(change({ id: 'bad', revision: 1 }))).status, 400);
    assert.equal((await route.DELETE(change({ id: templateId, revision: 1 }))).status, 409);
    assert.equal((await route.DELETE(change({ id: '33333333-3333-4333-8333-333333333333', revision: 1 }))).status, 200);
    admin = null;
    const before = controls;
    assert.equal((await route.PATCH(change({ enabled: false, revision: 1 }))).status, 403);
    assert.equal((await route.DELETE(change({ id: templateId, revision: 1 }))).status, 403);
    assert.equal(controls, before);
    admin = { email: 'admin@example.test' };
    const data = await (await route.GET()).json();
    assert.equal(data.connection.connected, true);
    assert.deepEqual(Object.keys(data).sort(), ['connection', 'promos', 'settings', 'templates']);
  } finally { delete globalThis.__fonnteSettings; }
});

test('scheduled endpoint rejects missing/wrong credentials without dispatching', async () => {
  let calls = 0;
  globalThis.__fonnteCron = { dispatchReportNotifications: async () => { calls++; return { checked: 0, accepted: 0, retried: 0, failed: 0, uncertain: 0, skipped: 0 }; } };
  const { GET } = await import(await moduleUrl('src/app/api/cron/whatsapp/route.ts', {
    'import { dispatchReportNotifications } from "@/features/whatsapp/server/dispatch";': 'const { dispatchReportNotifications } = globalThis.__fonnteCron;',
    'import { json } from "@/features/payments/server/http";': 'const json = (value, status=200) => Response.json(value, { status });',
  }));
  const previous = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal((await GET(new Request('https://example.test/api/cron/whatsapp'))).status, 503);
    process.env.CRON_SECRET = 'a'.repeat(32);
    assert.equal((await GET(new Request('https://example.test/api/cron/whatsapp'))).status, 401);
    assert.equal((await GET(new Request('https://example.test/api/cron/whatsapp', { headers: { authorization: 'Bearer wrong' } }))).status, 401);
    assert.equal(calls, 0);
    assert.equal((await GET(new Request('https://example.test/api/cron/whatsapp', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }))).status, 200);
    assert.equal(calls, 1);
  } finally {
    delete globalThis.__fonnteCron;
    if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous;
  }
});

test('report confirmation requires a real 0–100 score before freezing or completing the report', async () => {
  let frozen = 0;
  let updates = [];
  const ticket = { id: '550e8400-e29b-41d4-a716-446655440000', purpose: 'report', guest_hash: 'guest', order_id: 'GLS-test', expires_at: '2099-01-01', final_key: 'report.pdf', document_url: 'https://example.test/report.pdf', document_name: 'report.pdf' };
  const query = { update: values => { updates.push(values); return query; }, eq: () => query, neq: () => Promise.resolve({ error: null }) };
  globalThis.__reportScore = {
    currentAdmin: async () => ({ email: 'admin@example.test' }), guestSession: async () => ({ hash: 'guest' }),
    findUpload: async () => ticket, freezeUpload: async () => { frozen++; },
    findOrder: async () => ({ id: 'GLS-test', status: 'paid', fulfillment_status: 'processing' }),
    paymentAdmin: () => ({ database: { from: () => query } }),
  };
  const { POST } = await import(await moduleUrl('src/app/api/payments/uploads/[id]/route.ts', {
    '"zod"': JSON.stringify(pathToFileURL(require.resolve('zod')).href),
    'import { currentAdmin } from "@/features/auth/session";': 'const { currentAdmin } = globalThis.__reportScore;',
    'import { after } from "next/server";': 'const after = () => {};',
    'import { dispatchReportNotifications } from "@/features/whatsapp/server/dispatch";': 'const dispatchReportNotifications = async () => {};',
    'import { fonnteConfigured } from "@/features/whatsapp/server/fonnte";': 'const fonnteConfigured = () => false;',
    'import { guestSession } from "@/features/payments/server/guest";': 'const { guestSession } = globalThis.__reportScore;',
    'import { findUpload, freezeUpload } from "@/features/payments/server/uploads";': 'const { findUpload, freezeUpload } = globalThis.__reportScore;',
    'import { findOrder, paymentAdmin } from "@/features/payments/server/repository";': 'const { findOrder, paymentAdmin } = globalThis.__reportScore;',
    'import { json, sameOrigin } from "@/features/payments/server/http";': 'const json = (value, status=200) => Response.json(value, { status }); const sameOrigin = () => true;',
  }));
  const context = { params: Promise.resolve({ id: ticket.id }) };
  const request = value => new Request('https://example.test/api/payments/uploads/test', { method: 'POST', body: JSON.stringify(value) });
  try {
    for (const value of [{}, { aiScore: '35' }, { aiScore: -1 }, { aiScore: 101 }, { aiScore: 1.234 }, { aiScore: null }]) {
      assert.equal((await POST(request(value), context)).status, 400);
    }
    assert.equal(frozen, 0); assert.equal(updates.length, 0);
    for (const score of [0, 35.25, 100]) {
      assert.equal((await POST(request({ aiScore: score }), context)).status, 200);
      assert.equal(updates.at(-1).ai_score, score);
      assert.equal(updates.at(-1).fulfillment_status, 'completed');
    }
  } finally { delete globalThis.__reportScore; }
});
