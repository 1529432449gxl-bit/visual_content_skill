#!/usr/bin/env node
// 静态检查：把 SKILL.md / visual-craft.md 的硬约束变成可执行规则。
//   node scripts/lint-module.mjs <index.html ...> [--json]
// 退出码：有 error → 1；只有 warn/info → 0
import { readFileSync } from 'node:fs';
import { PALETTE } from '../lib/mathviz-kit.js';

const ALLOWED_HEX = new Set([...PALETTE, '#fff', '#ffffff', '#000', '#000000'].map(s => s.toLowerCase()));
const ALLOWED_CDN = [/cdn\.jsdelivr\.net\/npm\/katex/, /cdn\.jsdelivr\.net\/npm\/three/, /unpkg\.com\/three/, /cdnjs\.cloudflare\.com\/ajax\/libs\/(KaTeX|three\.js)/];
const MATH_GLYPH = /[×²³√∑∫≤≥≠≈θπ∞⊥∥ₙ]|(?<![a-zA-Z])[a-zA-Z]\s*·\s*[a-zA-Z(](?![a-zA-Z])|[a-zA-Z]'\s*[<>=]|\|\s*[a-zA-Z]\s*[x×]\s*[a-zA-Z]\s*\|/;

export function lint(src, file = '') {
  const out = [];
  const lines = src.split(/\r?\n/);
  const add = (sev, rule, msg, line = null) => out.push({ sev, rule, msg, line, file });
  const code = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')); // 去块注释，保留行号
  const codeLines = code.split(/\r?\n/).map(l => l.replace(/(^|[^:'"`])\/\/.*$/, '$1'));
  const each = (re, fn) => codeLines.forEach((l, i) => { let m; const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'); while ((m = r.exec(l))) fn(m, i + 1, l); });
  const usesKit = /mathviz-kit|createModule\(/.test(src);
  const has = re => re.test(code);

  // R01 色板（同一文件合并成一条，按首次出现行号）
  const offColors = new Map();
  each(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, (m, ln, l) => {
    if (/&#|href=|url\(/.test(l)) return;
    const c = m[0].toLowerCase(); if (!ALLOWED_HEX.has(c) && !offColors.has(c)) offColors.set(c, ln);
  });
  if (offColors.size) add('warn', 'palette', `${offColors.size} 个颜色不在 figureTheme 色板内：${[...offColors].map(([c, l]) => `${c}@L${l}`).join(' ')}（改用 THEME.* 或 alpha(THEME.x, a)）`);
  // R02 装饰
  each(/(linear|radial|conic)-gradient\(/g, (m, ln) => add('error', 'decoration', `${m[1]}-gradient：嵌入档禁止渐变底/渐变按钮`, ln));
  each(/box-shadow\s*:\s*([^;]+)/g, (m, ln) => { const blur = Math.max(0, ...[...m[1].matchAll(/(\d+(?:\.\d+)?)px/g)].map(x => +x[1])); if (blur > 6) add('warn', 'decoration', `box-shadow 模糊 ${blur}px：嵌入档阴影应极弱或无`, ln); });
  each(/text-shadow|filter\s*:\s*(drop-shadow|blur)|shadowBlur\s*=\s*[1-9]/g, (m, ln) => add('warn', 'decoration', `${m[0]}：发光/模糊类装饰抢戏`, ln));
  // R03 营销与说明墙
  each(/<h1\b/g, (m, ln) => add('warn', 'clutter', '<h1> 大标题：课程正文已有标题，模块内不要再放', ln));
  each(/class="[^"]*\b(badge|hero|banner|tag-row)\b/g, (m, ln) => add('warn', 'clutter', `.${m[1]}：营销式元素`, ln));
  const visible = src.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<title[\s\S]*?<\/title>/g, '').replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const cjk = (visible.match(/[一-鿿]/g) || []).length;
  if (cjk > 80) add('warn', 'clutter', `页面静态文字约 ${cjk} 个汉字：像说明墙。讲解留给课程正文，模块内只留一行公式 + 一行读数`);
  each(/(anim%|演示中|播放中·|状态：)/g, (m, ln) => add('warn', 'clutter', `"${m[1]}" 一类状态废话`, ln));
  // R04 清晰度
  if (/<canvas|createElement\(['"]canvas/.test(src) && !usesKit && !has(/devicePixelRatio/)) add('error', 'dpr', 'Canvas 未按 devicePixelRatio 缩放，高分屏会糊（用 MV.createModule 或手动 width=css*dpr）');
  // R05 TeX
  if (!usesKit && !/katex/i.test(src)) add('error', 'tex', '未使用 KaTeX：公式、向量、读数必须是 TeX');
  each(/fillText\(\s*(['"`])((?:(?!\1).)*)\1/g, (m, ln) => {
    if (MATH_GLYPH.test(m[2]) || m[2].length > 2 && /[a-z]\s*[=+\-*/^]\s*[a-z0-9]/i.test(m[2])) add('warn', 'tex', `fillText("${m[2]}")：画布上的数学记号应走 DOM+KaTeX 标签（fig.label）`, ln);
  });
  each(/(textContent|innerText)\s*=\s*(['"`])((?:(?!\2).)*)\2/g, (m, ln) => { if (MATH_GLYPH.test(m[3])) add('warn', 'tex', `纯文本 "${m[3]}" 冒充公式，改用 KaTeX`, ln); });
  { const txt = visible.split(/\n/); txt.forEach(t => { if (MATH_GLYPH.test(t) && !/\$|\\\(/.test(t)) add('warn', 'tex', `静态文字含数学记号 "${t.trim().slice(0, 30)}"，改用 KaTeX`); }); }
  // R06 动效
  each(/setInterval\(/g, (m, ln) => add('warn', 'motion', 'setInterval 驱动动画：改 requestAnimationFrame（或 MV.createAnimator）', ln));
  if (/requestAnimationFrame/.test(code) && !usesKit && !/document\.hidden|visibilitychange/.test(code)) add('warn', 'motion', '有 rAF 但不处理 document.hidden：后台标签页也在烧 CPU');
  if (/transition\s*:[^;]*\b([2-9]\d{3}|\d{5,})ms/.test(code)) add('warn', 'motion', '过长的 CSS 过渡（≥2s）');
  // R07 清理
  const winListen = (code.match(/(window|document)\.addEventListener\(/g) || []).length;
  const winUnlisten = (code.match(/(window|document)\.removeEventListener\(/g) || []).length;
  if (winListen > winUnlisten) add('warn', 'cleanup', `window/document 上 ${winListen} 个监听只移除了 ${winUnlisten} 个；嵌入 Vue 后会泄漏（用 fig.on 自动清理）`);
  // R08 控件密度
  const nCtl = (src.match(/<(button|select)\b|<input\b(?![^>]*type=["']hidden)/g) || []).length + (code.match(/MV\.(button|slider|segmented)\(/g) || []).length;
  if (nCtl > 8) add('warn', 'density', `控件 ${nCtl} 个：嵌入档典型是 模式 + ≤2 参数 + 复位/单步，合并或折叠`);
  if (!/复位|重置|reset/i.test(src)) add('warn', 'density', '没有复位入口');
  // R09 可复现
  if (/Math\.random\(/.test(code)) add('warn', 'repro', 'Math.random 不可复现：用 MV.rng(seed)');
  // R10 依赖
  each(/<script[^>]+src=["']([^"']+)["']|<link[^>]+href=["'](https?:[^"']+)["']/g, (m, ln) => {
    const u = m[1] || m[2]; if (/^https?:/.test(u) && !ALLOWED_CDN.some(r => r.test(u)) && !/fonts\.googleapis/.test(u)) add('warn', 'deps', `外部依赖 ${u}：确认必要并固定版本`, ln);
  });
  // R11 验收钩子
  if (!/MV\.expose\(|__mathviz/.test(code)) add('info', 'hook', '未调用 MV.expose：check-render 只能截默认态，无法设固定状态');
  return out;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('lint-module.mjs')) {
  const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const json = process.argv.includes('--json');
  if (!files.length) { console.log('用法: node scripts/lint-module.mjs <index.html ...> [--json]'); process.exit(1); }
  const all = files.flatMap(f => lint(readFileSync(f, 'utf8'), f));
  if (json) console.log(JSON.stringify(all, null, 2));
  else {
    const icon = { error: '✗', warn: '⚠', info: '·' };
    for (const f of files) {
      const mine = all.filter(x => x.file === f);
      console.log(`\n${f}`);
      if (!mine.length) console.log('  ✓ 全部通过');
      for (const x of mine) console.log(`  ${icon[x.sev]} [${x.rule}]${x.line ? ` L${x.line}` : ''} ${x.msg}`);
    }
    const e = all.filter(x => x.sev === 'error').length, w = all.filter(x => x.sev === 'warn').length;
    console.log(`\n${e} error, ${w} warn`);
  }
  process.exit(all.some(x => x.sev === 'error') ? 1 : 0);
}
