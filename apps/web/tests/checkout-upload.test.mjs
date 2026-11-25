import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile("src/features/payments/upload-file.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { prepareCheckoutUpload } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const file = () => new File(["A small test document."], "paper.txt", { type: "text/plain" });

function mockStorage(t, confirm = () => Response.json({ confirmed: true })) {
  const calls = [];
  let tickets = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.method, "POST");
    if (url === "/api/payments/uploads") {
      return Response.json({ ticket: `ticket-${++tickets}`, uploadUrl: "https://upload.example.invalid/", fields: { key: "staging/test.txt" } });
    }
    if (url === "https://upload.example.invalid/") {
      assert.equal(options.body.get("file").name, "paper.txt");
      return new Response(null, { status: 204 });
    }
    if (/^\/api\/payments\/uploads\/ticket-\d+$/.test(url)) return confirm();
    throw new Error(`Unexpected request: ${url}`);
  });
  return calls;
}

test("file selection completes storage work before checkout asks for its ticket", { timeout: 2000 }, async t => {
  const calls = mockStorage(t);
  const upload = prepareCheckoutUpload(file());
  assert.equal(await upload.ready, "ticket-1");
  assert.equal(calls.length, 3);
  assert.equal(await upload.getTicket(), "ticket-1");
  assert.equal(await upload.getTicket(), "ticket-1");
  assert.equal(calls.length, 3, "checkout retries must not upload the same confirmed bytes again");
});

test("concurrent checkout calls share an upload that is still being confirmed", { timeout: 2000 }, async t => {
  let release;
  const confirmation = new Promise(resolve => { release = resolve; });
  const calls = mockStorage(t, () => confirmation);
  const upload = prepareCheckoutUpload(file());
  const first = upload.getTicket();
  const second = upload.getTicket();
  assert.equal(first, second);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 3);
  release(Response.json({ confirmed: true }));
  assert.deepEqual(await Promise.all([upload.ready, first, second]), ["ticket-1", "ticket-1", "ticket-1"]);
  assert.equal(calls.length, 3);
});

test("a long-idle form refreshes its ticket once rather than sending an expired upload", { timeout: 2000 }, async t => {
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  const calls = mockStorage(t);
  const upload = prepareCheckoutUpload(file());
  await upload.ready;
  now += 10 * 60_000 - 1;
  assert.equal(await upload.getTicket(), "ticket-1");
  now += 1;
  const first = upload.getTicket();
  const second = upload.getTicket();
  assert.equal(first, second);
  assert.deepEqual(await Promise.all([first, second]), ["ticket-2", "ticket-2"]);
  assert.equal(calls.length, 6);
});

test("replacement files wait for guest-cookie establishment, including a failed previous upload", { timeout: 2000 }, async t => {
  let rejectPrevious;
  const previous = new Promise((resolve, reject) => { rejectPrevious = reject; });
  const calls = mockStorage(t);
  const upload = prepareCheckoutUpload(file(), previous);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 0);
  rejectPrevious(new Error("Previous upload failed"));
  assert.equal(await upload.ready, "ticket-1");
  assert.equal(calls.length, 3);
});

test("failed confirmation never supplies a ready ticket and a later retry can recover", { timeout: 2000 }, async t => {
  let failed = true;
  const calls = mockStorage(t, () => failed
    ? Response.json({ error: "Confirmation failed" }, { status: 503 })
    : Response.json({ confirmed: true }));
  const upload = prepareCheckoutUpload(file());
  await assert.rejects(upload.ready, /Confirmation failed/);
  failed = false;
  assert.equal(await upload.getTicket(), "ticket-2");
  assert.equal(calls.length, 6);
});
