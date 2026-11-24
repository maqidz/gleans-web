import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const require = createRequire(import.meta.url);
async function sourceModule(path, replacements) {
  let source = (await readFile(path, 'utf8')).replace('import "server-only";', '');
  for (const [before, after] of Object.entries(replacements)) source = source.replace(before, after);
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}

test('media purge accepts only bounded explicit selections from a same-origin admin', async () => {
  let admin = null; let calls = 0; let input;
  globalThis.__mediaRoute = {
    currentAdmin: async () => admin,
    purgeEditorMedia: async (ids, actor) => { calls++; input = ids; assert.equal(actor, 'admin@example.test'); return { removedIds: ids, skippedIds: [], pendingIds: [] }; },
  };
  const { DELETE, POST } = await sourceModule('src/app/api/admin/site-media/route.ts', {
    '"zod"': JSON.stringify(pathToFileURL(require.resolve('zod')).href),
    'import { currentAdmin } from "@/features/auth/session";': 'const { currentAdmin } = globalThis.__mediaRoute;',
    'import { MEDIA_BUCKET, setEditorMediaVisibility } from "@/features/admin/lib/site-editor";': 'const MEDIA_BUCKET = "media"; const setEditorMediaVisibility = () => {};',
    'import { EDITOR_IMAGE_LIMIT } from "@/features/admin/lib/media";': 'const EDITOR_IMAGE_LIMIT = 2097152;',
    'import { json, sameOrigin } from "@/features/payments/server/http";': 'const json = (data,status=200) => Response.json(data,{status}); const sameOrigin = request => request.headers.get("origin") === new URL(request.url).origin;',
    'import { paymentAdmin } from "@/features/payments/server/repository";': 'const paymentAdmin = () => {};',
    'import { purgeEditorMedia } from "@/features/admin/lib/media-purge";': 'const { purgeEditorMedia } = globalThis.__mediaRoute;',
  });
  const request = (body, origin = 'https://example.test') => new Request('https://example.test/api/admin/site-media', { method: 'DELETE', headers: { origin }, body: JSON.stringify(body) });
  try {
    assert.equal((await DELETE(request({ ids: ['image-1'] }))).status, 403);
    admin = { email: 'admin@example.test' };
    assert.equal((await DELETE(request({ ids: ['image-1'] }, 'https://evil.test'))).status, 403);
    for (const body of [{}, { ids: [] }, { ids: ['../image'] }, { ids: Array(204).fill('image-1') }, { ids: ['image-1'], all: true }]) assert.equal((await DELETE(request(body))).status, 400);
    assert.equal(calls, 0);
    assert.equal((await DELETE(request({ ids: ['image-1', 'image-1'] }))).status, 200);
    assert.deepEqual(input, ['image-1']);
    const form = new FormData(); form.set('file', new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }));
    const oversized = new Request('https://example.test/api/admin/site-media', { method: 'POST', headers: { origin: 'https://example.test' }, body: form });
    assert.equal((await POST(oversized)).status, 413);
  } finally { delete globalThis.__mediaRoute; }
});

test('cleanup uses server-selected keys, retains failed files for retry and respects the batch limit', async () => {
  let entries = [{ id: 'done', cleaned: true, storageKey: 'old.png' }, { id: 'ok', cleaned: false, storageKey: 'server-ok.png' }, { id: 'fail', cleaned: false, storageKey: 'server-fail.png' }];
  let removed = []; let finalized = []; let rpcError = false; let saveError = false;
  globalThis.__mediaPurge = {
    paymentAdmin: () => ({
      database: {
        rpc: async (_name, args) => { assert.deepEqual(args.p_ids, ['requested']); return { data: { entries, skippedIds: ['used'] }, error: rpcError ? {} : null }; },
        from: name => { assert.equal(name, 'site_media_purges'); let id; const query = { update: () => query, eq: (_key, value) => { id = value; return query; }, is: () => query, select: () => query, maybeSingle: async () => { finalized.push(id); return { data: saveError ? null : { id }, error: saveError ? {} : null }; } }; return query; },
      },
      storage: { from: bucket => { assert.equal(bucket, 'media'); return { remove: async key => { removed.push(key); return { error: key === 'server-fail.png' ? { statusCode: 503 } : key === 'missing.png' ? { statusCode: 404 } : null }; } }; } },
    }),
  };
  const { purgeEditorMedia } = await sourceModule('src/features/admin/lib/media-purge.ts', {
    'import { paymentAdmin } from "@/features/payments/server/repository";': 'const { paymentAdmin } = globalThis.__mediaPurge;',
    'import { MEDIA_BUCKET } from "./site-editor";': 'const MEDIA_BUCKET = "media";',
  });
  try {
    assert.deepEqual(await purgeEditorMedia(['requested'], 'admin'), { removedIds: ['done', 'ok'], skippedIds: ['used'], pendingIds: ['fail'] });
    assert.deepEqual(removed, ['server-ok.png', 'server-fail.png']); assert.deepEqual(finalized, ['ok']);
    entries = [{ id: 'retry', cleaned: false, storageKey: 'missing.png' }];
    assert.deepEqual((await purgeEditorMedia(['requested'], 'admin')).removedIds, ['retry']);
    saveError = true;
    assert.deepEqual((await purgeEditorMedia(['requested'], 'admin')).pendingIds, ['retry']);
    saveError = false; entries = Array.from({ length: 11 }, (_, i) => ({ id: String(i), cleaned: false, storageKey: `${i}.png` })); removed = [];
    assert.deepEqual((await purgeEditorMedia(['requested'], 'admin')).pendingIds, ['10']); assert.equal(removed.length, 10);
    rpcError = true; removed = [];
    await assert.rejects(purgeEditorMedia(['requested'], 'admin'), /MEDIA_PURGE_UNAVAILABLE/); assert.deepEqual(removed, []);
  } finally { delete globalThis.__mediaPurge; }
});
