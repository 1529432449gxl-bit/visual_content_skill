#!/usr/bin/env node
// 渲染验收：真浏览器打开模块 → 设固定状态 → 截图 → 检查遮挡/DPR/KaTeX/控制台错误 → 点一遍控件做冒烟
//   node scripts/check-render.mjs <index.html> [--state '{"x0":2}'] [--states states.json]
//        [--out 截图目录] [--width 760] [--dpr 2] [--no-click] [--chrome 浏览器路径]
// states.json：[{ "name": "tangent-at-2", "state": { "x0": 2 } }, ...]
// 需要 Playwright：npm i -D playwright && npx playwright install chromium（或本机已装 Chrome）
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : undefined; };
const file = argv.find(a => !a.startsWith('--') && /\.html?$/i.test(a));
if (!file) { console.log('用法: node scripts/check-render.mjs <index.html> [--state JSON] [--states file.json] [--out dir] [--width 760] [--dpr 2] [--no-click]'); process.exit(1); }

let pw;
try { pw = await import('playwright'); } catch {
  console.error('未找到 playwright。安装：npm i -D playwright && npx playwright install chromium'); process.exit(2);
}

// 服务根目录 = 模块文件与 lib 的公共祖先（相对 import 才能解析）
const abs = resolve(file);
const common = (a, b) => { const A = a.split(sep), B = b.split(sep); let i = 0; while (i < A.length && A[i] === B[i]) i++; return A.slice(0, i).join(sep) || sep; };
const root = common(dirname(abs), join(ROOT, 'lib'));
const server = await serve(root, 0);
const url = `http://127.0.0.1:${server.address().port}/${relative(root, abs).split(sep).join('/')}`;

const states = opt('states') ? JSON.parse(readFileSync(opt('states'), 'utf8'))
  : [{ name: opt('state') ? 'custom' : 'default', state: opt('state') ? JSON.parse(opt('state')) : null }];
const outDir = resolve(opt('out') || join(dirname(abs), 'screenshots'));
mkdirSync(outDir, { recursive: true });
const width = +(opt('width') || 760), dpr = +(opt('dpr') || 2);

// 浏览器：--chrome <路径> 或环境变量 CHROME_PATH > Playwright 自带 Chromium > 本机 Chrome
let browser;
const exe = opt('chrome') || process.env.CHROME_PATH;
const extraArgs = process.env.CHROME_ARGS ? JSON.parse(process.env.CHROME_ARGS) : [];
try { browser = await pw.chromium.launch(exe ? { executablePath: exe, args: extraArgs } : {}); }
catch (e) { if (exe) throw e; browser = await pw.chromium.launch({ channel: 'chrome' }); }
const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: dpr });
await context.newPage(); // 占位页：部分单进程 Chromium 在最后一页关闭时会整体退出

// 若装了 katex（npm i -D katex），把 CDN 请求改为本地文件：离线、内网、代理环境都能验收
let katexDir = null;
try { const { createRequire } = await import('node:module'); katexDir = dirname(createRequire(join(ROOT, 'package.json')).resolve('katex/package.json')); } catch {}

const problems = [];
const P = (sev, where, msg) => problems.push({ sev, where, msg });

async function open() {
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  if (katexDir) await page.route(/katex@[^/]+\/dist\//, async route => {
    const rel = new URL(route.request().url()).pathname.replace(/.*\/dist\//, '');
    try { await route.fulfill({ body: readFileSync(join(katexDir, 'dist', rel)), contentType: rel.endsWith('.css') ? 'text/css' : rel.endsWith('.js') ? 'text/javascript' : undefined }); }
    catch { await route.abort(); }
  });
  await page.goto(url, { waitUntil: 'load', timeout: 15000 });
  const ok = await page.waitForFunction(() => window.__mathviz && Object.keys(window.__mathviz).length, null, { timeout: 8000 }).then(() => true, () => false);
  if (!ok) P('error', 'load', '8 秒内未出现 window.__mathviz（模块没跑起来，或没用 MV.createModule）');
  const tex = await page.waitForFunction(() => window.katex, null, { timeout: 8000 }).then(() => true, () => false);
  if (!tex) P('warn', 'load', 'KaTeX 未加载（离线？）——标签与公式会显示 TeX 源码');
  await page.waitForTimeout(400);
  return { page, errs };
}

async function inspect(page, where) {
  const r = await page.evaluate(() => {
    const mods = Object.entries(window.__mathviz || {}).map(([k, v]) => ({ k, rep: v.report?.() }));
    const canv = [...document.querySelectorAll('canvas')].map(c => ({ w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight }));
    const kErr = document.querySelectorAll('.katex-error').length;
    const rawTex = [...document.querySelectorAll('.mv-label,.mv-formula,.mv-readout')].filter(e => e.textContent.trim() && !e.querySelector('.katex')).map(e => e.textContent.slice(0, 40));
    return { mods, canv, kErr, rawTex, dpr: devicePixelRatio };
  });
  for (const c of r.canv) if (c.cw && Math.abs(c.w - Math.round(c.cw * Math.min(r.dpr, 2.5))) > 1) P('error', where, `Canvas 后备尺寸 ${c.w}px ≠ CSS ${c.cw}px × DPR ${r.dpr}：会糊`);
  if (r.kErr) P('error', where, `${r.kErr} 处 KaTeX 解析错误（.katex-error）`);
  if (r.rawTex.length) P('warn', where, `未渲染成 KaTeX 的文本：${r.rawTex.join(' | ')}`);
  for (const { k, rep } of r.mods) {
    if (!rep) continue;
    for (const i of rep.issues) {
      const msg = i.kind === 'label' ? `标签 ${i.label} 与 ${i.other} 重叠`
        : i.kind === 'outside' ? `标签 ${i.label} 超出画布`
        : `标签 ${i.label} 压住${{ poly: '填充面', line: '曲线/箭头/轨迹', rect: '关键点' }[i.kind]}（覆盖 ${Math.round(i.amount * 100)}%）`;
      P('error', `${where}/${k}`, msg);
    }
  }
  return r;
}

for (const s of states) {
  const { page, errs } = await open();
  if (s.state) {
    const set = await page.evaluate(st => { const m = Object.values(window.__mathviz)[0]; if (!m?.setState) return false; m.setState(st); return true; }, s.state);
    if (!set) P('error', s.name, '模块没有 setState（在模块里调用 MV.expose(fig, { getState, setState })）');
    await page.waitForTimeout(250);
  }
  const r = await inspect(page, s.name);
  const shot = join(outDir, `${basename(dirname(abs))}-${s.name}.png`);
  const mod = await page.$('.mv-module');
  await (mod || page).screenshot({ path: shot });
  console.log(`📷 ${relative(process.cwd(), shot)}  （${r.mods.map(m => `${m.rep?.labels.length ?? 0} 标签 / ${m.rep?.protectCount ?? 0} 保护区`).join('; ')}）`);
  errs.forEach(e => P('error', s.name, `控制台：${e}`));
  await page.close();
}

if (!opt('no-click')) {
  const { page, errs } = await open();
  const n = await page.$$eval('.mv-bar button, .mv-module button', b => b.length);
  for (let i = 0; i < n; i++) {
    await page.$$eval('.mv-bar button, .mv-module button', (b, i) => b[i].click(), i);
    await page.waitForTimeout(120);
  }
  const slider = await page.$('.mv-bar input[type=range]');
  if (slider) { await slider.focus(); for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowRight'); for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowLeft'); }
  const c = await page.$('canvas');
  if (c) { const b = await c.boundingBox(); await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.5); await page.mouse.down(); await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.4, { steps: 6 }); await page.mouse.up(); }
  await page.waitForTimeout(1200);
  await inspect(page, 'smoke');
  errs.forEach(e => P('error', 'smoke', `点控件/拖滑块/拖画布后控制台报错：${e}`));
  console.log(`🖱  冒烟：点击 ${n} 个按钮、拖滑块到两端、拖画布`);
  await page.close();
}

await browser.close(); server.close();
const icon = { error: '✗', warn: '⚠' };
if (!problems.length) console.log('✓ 渲染验收通过：无遮挡、DPR 正确、KaTeX 正常、无控制台错误');
for (const p of problems) console.log(`${icon[p.sev]} [${p.where}] ${p.msg}`);
process.exit(problems.some(p => p.sev === 'error') ? 1 : 0);
