import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const cachedPrices = { starter: 41000, standart: 72000, premium: 160000 };
const loaded = new Map();
function load(sourcePath) {
  const path = resolve(sourcePath);
  if (loaded.has(path)) return loaded.get(path).exports;
  const module = { exports: {} };
  loaded.set(path, module);
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const localRequire = specifier => {
    if (specifier === 'next/navigation') return { useSearchParams: () => new URLSearchParams() };
    if (specifier === '@/features/orders/lib/shield-pricing') return { displayShieldPricing: async () => ({ packages: cachedPrices }) };
    const local = specifier.startsWith('@/') ? resolve('src', specifier.slice(2))
      : specifier.startsWith('@gleans/ui/') ? resolve('../../packages/ui/src', specifier.slice('@gleans/ui/'.length))
      : specifier.startsWith('.') ? resolve(dirname(path), specifier) : null;
    if (local) {
      const target = [local, `${local}.ts`, `${local}.tsx`].find(candidate => existsSync(candidate));
      if (!target) throw new Error(`Missing local module: ${specifier}`);
      return load(target);
    }
    return createRequire(path)(specifier);
  };
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
  return module.exports;
}

// Server rendering leaves the account-history request pending: effects have not run.
// Exercise the actual page, billing component, and shared UI without a payment request.
test('top-up and package dialogs are available before account history loads, using the server catalog', async () => {
  const { default: Page } = load('src/app/(dashboard)/dashboard/paket-saldo/page.tsx');
  const element = await Page();
  assert.deepEqual(element.props.initialPackagePrices, cachedPrices);
  const html = renderToStaticMarkup(element);
  assert.match(html, /Memuat riwayat transaksi/);
  for (const value of ['41.000', '72.000', '160.000']) assert.ok(html.includes(value), `Missing current catalog price ${value}`);
  const buttons = Array.from(html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g));
  for (const label of ['Isi saldo', 'Pilih Starter', 'Pilih Standart', 'Pilih Premium']) {
    const button = buttons.find(([, , inner]) => inner.replace(/<[^>]*>/g, '').includes(label));
    assert.ok(button, `${label} must render`);
    assert.doesNotMatch(button[1], /\bdisabled(?:=|\s|$)/, `${label} must not wait for account history`);
  }
});
