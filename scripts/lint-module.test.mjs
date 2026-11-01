import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { lint } from './lint-module.mjs';

const rules = src => lint(src).map(x => x.rule);

test('模板本身全部通过（只允许 info）', () => {
  for (const f of readdirSync(new URL('../templates/', import.meta.url)).filter(f => f.endsWith('.html'))) {
    const out = lint(readFileSync(new URL(`../templates/${f}`, import.meta.url), 'utf8'), f).filter(x => x.sev !== 'info');
    assert.deepEqual(out, [], `${f}: ${JSON.stringify(out)}`);
  }
});
test('抓到渐变、大标题、setInterval、Math.random、非主题色', () => {
  const r = rules(`<style>.x{background:linear-gradient(#fff,#123456)}</style><h1>标题</h1><canvas></canvas>
  <script>setInterval(f,16); Math.random(); katex</script>`);
  for (const k of ['decoration', 'clutter', 'motion', 'repro', 'palette', 'dpr']) assert.ok(r.includes(k), k);
});
test('纯文本公式被抓，中文间隔号不误报', () => {
  assert.ok(rules(`<script>ctx.fillText('|a×b|', 1, 2); katex</script>`).includes('tex'));
  assert.ok(!rules(`<div>拖动画布旋转 · 拖箭头改向量</div><script>katex; reset</script>`).includes('tex'));
});
