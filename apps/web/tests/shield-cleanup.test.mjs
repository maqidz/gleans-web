import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
let source = await readFile(new URL('../src/features/payments/server/cleanup.ts', import.meta.url), 'utf8');
source = source.replace('import "server-only";', '').replace('import { paymentAdmin } from "./repository";', 'const paymentAdmin = () => globalThis.cleanupAdmin;').replace('import { PAYMENT_DOCUMENT_BUCKET } from "../types";', 'const PAYMENT_DOCUMENT_BUCKET = "test";');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { eligibleForCleanup, cleanupExpiredFiles } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const now = Date.parse('2026-11-13T00:00:00Z');
const row = {id:'test',status:'paid',fulfillment_status:'completed',report_expires_at:new Date(now).toISOString(),files_deleted_at:null,document_key:'doc',report_key:'report'};
test('only paid completed orders past the download deadline qualify', () => {
 assert.equal(eligibleForCleanup(row, now), true);
 for (const override of [{status:'pending'},{fulfillment_status:'processing'},{files_deleted_at:'done'},{report_key:null},{report_expires_at:null},{report_expires_at:new Date(now+1).toISOString()}]) assert.equal(eligibleForCleanup({...row,...override}, now), false);
});
test('partial storage failure remains retryable; missing files are safe on retry', async () => {
 let marked = 0; let failure = true; const removed=[];
 const query = {select(){return this;},eq(){return this;},is(){return this;},lte(){return this;},order(){return this;},limit:async()=>({data:[row],error:null}),update(){marked++;return this;}};
 globalThis.cleanupAdmin={database:{from:()=>query},storage:{from:()=>({remove:async(key)=>{removed.push(key);return {error:key==='report'&&failure?{statusCode:500}:key==='doc'?{statusCode:404}:null};}})}};
 assert.deepEqual(await cleanupExpiredFiles(now), {checked:1,deleted:0,failed:1}); assert.equal(marked,0);
 failure=false;
 assert.deepEqual(await cleanupExpiredFiles(now), {checked:1,deleted:1,failed:0}); assert.equal(marked,1);
 assert.deepEqual(removed,['doc','report','doc','report']);
 delete globalThis.cleanupAdmin;
});
