// mathviz-kit.js — MathAPP 风格数学交互模块的运行时内核（无构建、无依赖，KaTeX 按需 CDN 加载）
// 用法：<script type="module"> import * as MV from './lib/mathviz-kit.js' </script>
// 纯函数部分（采样、刻度、投影、标签布局、回放）可在 Node 中直接测试；DOM 部分只在调用时触碰 document。

// ───────────────────────── 主题（对齐 frontend/src/utils/figureTheme.js） ─────────────────────────
export const THEME = Object.freeze({
  ink: '#16201a', inkSoft: '#4f5b54',
  accent: '#245443', accentStrong: '#173f31',
  warm: '#b5763a', muted: '#7a847e',
  rule: '#c9d1cc', ruleSoft: '#e3e8e4',
  pane: '#f2f5f3', paper: '#fcfdfc',
  sand: '#d9c08f', blue: '#3f6e8c', red: '#a4493f',
  mono: '"JetBrains Mono", Consolas, monospace',
  serif: '"STIX Two Text", "Times New Roman", serif',
  sans: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  curveWidth: 1.6,
});
/** 角色色：主/次/第三/结果。向量 a,b,c 与叉积约定用这四个。 */
export const ROLE = Object.freeze({ primary: THEME.accent, secondary: THEME.warm, tertiary: THEME.blue, result: THEME.red });
export const PALETTE = Object.freeze(Object.values(THEME).filter(v => typeof v === 'string' && v.startsWith('#')));

export function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ───────────────────────── 小工具 ─────────────────────────
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = Object.freeze({
  linear: t => t,
  outCubic: t => 1 - (1 - t) ** 3,
  inOutCubic: t => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: t => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2,
});
/** 数值格式化：去掉 -0，固定小数位。 */
export function fmt(n, d = 2) {
  if (!Number.isFinite(n)) return n > 0 ? '\\infty' : n < 0 ? '-\\infty' : '\\text{NaN}';
  const x = Math.round(n * 10 ** d) / 10 ** d;
  return (Object.is(x, -0) ? 0 : x).toFixed(d);
}
/** 可复现随机数（mulberry32）。 */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const vec3 = Object.freeze({
  add: (u, v) => [u[0] + v[0], u[1] + v[1], u[2] + v[2]],
  sub: (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]],
  scale: (u, s) => [u[0] * s, u[1] * s, u[2] * s],
  dot: (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2],
  cross: (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]],
  len: u => Math.hypot(u[0], u[1], u[2]),
  norm: u => { const l = Math.hypot(u[0], u[1], u[2]); return l < 1e-12 ? [0, 0, 0] : [u[0] / l, u[1] / l, u[2] / l]; },
  lerp: (u, v, t) => [lerp(u[0], v[0], t), lerp(u[1], v[1], t), lerp(u[2], v[2], t)],
});

// ───────────────────────── 平面坐标 ─────────────────────────
/** 1-2-5 规则的整齐刻度。 */
export function niceTicks(min, max, target = 6) {
  if (!(max > min)) return [];
  const raw = (max - min) / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag;
  const out = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toPrecision(12));
  return out;
}

/**
 * 世界坐标 ↔ 屏幕坐标。equal=true 时两轴同比例（几何图必须开），多余空间居中。
 * @returns {{toScreen:(x:number,y:number)=>[number,number], toWorld:(px:number,py:number)=>[number,number], sx:number, sy:number, view:object}}
 */
export function createPlane({ xmin, xmax, ymin, ymax, width, height, pad = 24, equal = false }) {
  const w = width - 2 * pad, h = height - 2 * pad;
  let sx = w / (xmax - xmin), sy = h / (ymax - ymin), ox = pad, oy = pad;
  if (equal) {
    const s = Math.min(sx, sy);
    ox += (w - s * (xmax - xmin)) / 2; oy += (h - s * (ymax - ymin)) / 2; sx = sy = s;
  }
  const toScreen = (x, y) => [ox + (x - xmin) * sx, height - oy - (y - ymin) * sy];
  const toWorld = (px, py) => [xmin + (px - ox) / sx, ymin + (height - oy - py) / sy];
  return { toScreen, toWorld, sx, sy, view: { xmin, xmax, ymin, ymax, width, height, pad } };
}

/**
 * 自适应采样 y=f(x)。按屏幕误差细分；遇到非有限值或跳跃（间断/渐近线）断开成多段。
 * @returns {Array<Array<[number,number]>>} 世界坐标折线段
 */
export function sampleFunction(f, x0, x1, { n = 160, maxDepth = 7, tolPx = 0.35, plane = null, jumpPx = null } = {}) {
  const sy = plane ? plane.sy : 1, sx = plane ? plane.sx : 1;
  const jump = jumpPx ?? (plane ? plane.view.height * 0.9 : Infinity);
  const ev = x => { const y = f(x); return Number.isFinite(y) ? y : NaN; };
  const segs = []; let cur = [];
  const flush = () => { if (cur.length > 1) segs.push(cur); cur = []; };
  const push = p => {
    if (Number.isNaN(p[1])) { flush(); return; }
    const last = cur[cur.length - 1];
    if (last && Math.abs((p[1] - last[1]) * sy) > jump) flush();
    cur.push(p);
  };
  const refine = (a, fa, b, fb, depth) => {
    const m = (a + b) / 2, fm = ev(m);
    const bad = Number.isNaN(fa) !== Number.isNaN(fb) || Number.isNaN(fm) !== Number.isNaN(fa);
    const dev = Math.abs((fm - (fa + fb) / 2) * sy);
    const big = Math.abs((fb - fa) * sy) > 4 * Math.max(1, (b - a) * sx);
    if (depth < maxDepth && (bad || dev > tolPx || big)) {
      refine(a, fa, m, fm, depth + 1); refine(m, fm, b, fb, depth + 1);
    } else push([b, fb]);
  };
  let xa = x0, fa = ev(x0); push([xa, fa]);
  for (let i = 1; i <= n; i++) { const xb = x0 + (x1 - x0) * i / n, fb = ev(xb); refine(xa, fa, xb, fb, 0); xa = xb; fa = fb; }
  flush();
  return segs;
}

// ───────────────────────── 三维相机（对齐 SpaceFigure：拖动只改相机） ─────────────────────────
export function createOrbitCamera({ yaw = 0.75, pitch = 0.42, dist = 5.2, fov = 2.6, zUp = false } = {}) {
  const init = { yaw, pitch, dist, fov };
  const s = { ...init };
  const basis = () => {
    const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw), cp = Math.cos(s.pitch), sp = Math.sin(s.pitch);
    const forward = [cy * cp, sp, sy * cp];
    let right = vec3.cross([0, 1, 0], forward);
    right = vec3.len(right) < 1e-6 ? [1, 0, 0] : vec3.norm(right);
    return { forward, right, up: vec3.norm(vec3.cross(forward, right)) };
  };
  // zUp：数学惯例 z 轴朝上 → 内部 y 朝上坐标
  const toInternal = p => (zUp ? [p[0], p[2], p[1]] : p);
  return {
    state: s,
    basis,
    /** 投影到屏幕；z 为视深（越大越远），k 为透视缩放 */
    project(p, W, H) {
      const { right, up, forward } = basis();
      const rel = vec3.sub(toInternal(p), vec3.scale(forward, -s.dist));
      const z = vec3.dot(rel, forward), k = s.dist / Math.max(z, 1e-3);
      const sc = (Math.min(W, H) * 0.42) / s.fov;
      return { x: W / 2 + vec3.dot(rel, right) * sc * k, y: H * 0.52 - vec3.dot(rel, up) * sc * k, z, k };
    },
    rotate(dx, dy) { s.yaw += dx * 0.008; s.pitch = clamp(s.pitch + dy * 0.008, -1.45, 1.45); },
    reset() { Object.assign(s, init); },
  };
}

// ───────────────────────── 几何判定 ─────────────────────────
export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = [poly[i].x, poly[i].y], [xj, yj] = [poly[j].x, poly[j].y];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export const rectsOverlap = (a, b, m = 0) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
function segHitsRect(p, q, r) {
  if ((p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) || (q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h)) return true;
  const c = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
  const o = (a, b, d) => Math.sign((b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x));
  for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; if (o(p, q, a) !== o(p, q, b) && o(a, b, p) !== o(a, b, q)) return true; }
  return false;
}
/**
 * 被保护形状与矩形的重叠程度（0 = 不挡）。shape:
 *  {kind:'poly', pts:[{x,y}]}  面（平行四边形、六面体投影面）——矩形中心或角落落入即算
 *  {kind:'line', pts:[{x,y}]}  折线（曲线、轨迹、箭杆）
 *  {kind:'rect', x,y,w,h}       控件、关键点包围盒
 */
export function occlusion(rect, shape) {
  if (shape.kind === 'rect') return rectsOverlap(rect, shape) ? 1 : 0;
  if (shape.kind === 'poly') {
    const probes = [[0.5, 0.5], [0.15, 0.2], [0.85, 0.2], [0.15, 0.8], [0.85, 0.8]];
    return probes.filter(([u, v]) => pointInPoly(rect.x + u * rect.w, rect.y + v * rect.h, shape.pts)).length / probes.length;
  }
  let hits = 0;
  for (let i = 1; i < shape.pts.length; i++) if (segHitsRect(shape.pts[i - 1], shape.pts[i], rect)) hits++;
  return hits ? Math.min(1, 0.4 + 0.2 * hits) : 0;
}

/**
 * 标签避让布局（纯函数）。label: {id, anchor:{x,y}, size:{w,h}, dir?:{x,y}, prefer?:'out'|'any'}
 * 在锚点周围多半径多方向搜候选位置，惩罚：出界、压保护形状、互相重叠、离锚点太远。
 * optional:true 的标签找不到干净位置（cost ≥ 150）时直接不画（嵌入档"少标"），返回 hidden:true。
 * 先放必选标签，再放可选标签。
 * @returns {Array<{id, x, y, w, h, cost, hidden?}>} 左上角坐标，与输入同序
 */
export function placeLabels(labels, { width, height, protect = [], margin = 6, gap = 10, clearance = 4 } = {}) {
  const placed = [], result = new Map();
  const dirs = 24;
  const order = [...labels.keys()].sort((a, b) => !!labels[a].optional - !!labels[b].optional);
  for (const idx of order) {
    const L = labels[idx];
    const { w, h } = L.size;
    let best = null;
    const pref = L.dir ? Math.atan2(L.dir.y, L.dir.x) : -Math.PI / 4;
    for (const r of [0, 8, 18, 30, 46, 66, 90, 120].map(d => gap + d)) { // 由近及远，近处有好位置就停
      for (let i = 0; i < dirs; i++) {
        const th = pref + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (2 * Math.PI / dirs);
        const cx = L.anchor.x + Math.cos(th) * (r + w / 2), cy = L.anchor.y + Math.sin(th) * (r + h / 2);
        const rect = { x: cx - w / 2, y: cy - h / 2, w, h };
        let cost = r * 0.6 + Math.ceil(i / 2) * 1.5;
        const safe = { x: rect.x - clearance, y: rect.y - clearance, w: w + 2 * clearance, h: h + 2 * clearance }; // 留安全边距
        if (rect.x < margin || rect.y < margin || rect.x + w > width - margin || rect.y + h > height - margin) cost += 400;
        for (const s of protect) cost += occlusion(safe, s) * (s.weight ?? 300);
        for (const q of placed) if (rectsOverlap(safe, q, 2)) cost += 500;
        if (!best || cost < best.cost) best = { id: L.id, ...rect, cost };
      }
      if (best && best.cost < 60) break;
    }
    best.x = clamp(best.x, margin, width - margin - w); best.y = clamp(best.y, margin, height - margin - h);
    if (L.optional && best.cost >= 150) best.hidden = true; else placed.push(best);
    result.set(idx, best);
  }
  return labels.map((_, i) => result.get(i));
}

// ───────────────────────── 离散回放（与 scripts/trace-player.mjs 同契约） ─────────────────────────
export function createTracePlayer(steps, { intervalMs = 600 } = {}) {
  if (!Array.isArray(steps) || !steps.length) throw new TypeError('steps must be non-empty');
  const freeze = (v, seen = new Set()) => { if (v && typeof v === 'object' && !seen.has(v)) { seen.add(v); Object.values(v).forEach(x => freeze(x, seen)); Object.freeze(v); } return v; };
  const history = freeze(structuredClone(steps));
  let index = 0, playing = false, elapsed = 0, speed = 1;
  const snapshot = () => ({ index, count: history.length, playing, speed, progress: playing ? clamp(elapsed / intervalMs, 0, 1) : 0, step: history[index] });
  const seek = n => { index = clamp(Math.trunc(n), 0, history.length - 1); elapsed = 0; playing = false; return snapshot(); };
  return {
    snapshot, seek, next: () => seek(index + 1), previous: () => seek(index - 1), reset: () => seek(0),
    play() { if (index >= history.length - 1) index = 0; playing = true; return snapshot(); },
    pause() { playing = false; return snapshot(); },
    toggle() { return playing ? this.pause() : this.play(); },
    setSpeed(v) { if (!(v > 0)) throw new RangeError('speed must be positive'); speed = v; return snapshot(); },
    advance(dt) {
      if (!playing) return snapshot();
      elapsed += dt * speed;
      const k = Math.floor(elapsed / intervalMs);
      if (k) { index = Math.min(history.length - 1, index + k); elapsed %= intervalMs; }
      if (index === history.length - 1) { playing = false; elapsed = 0; }
      return snapshot();
    },
  };
}

// ═════════════════════════ 以下为 DOM 部分 ═════════════════════════

const KATEX = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/';
let katexPromise = null;
/** 按需加载 KaTeX（页面已引入则直接复用）。 */
export function loadKatex() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.katex) return Promise.resolve(window.katex);
  if (!katexPromise) katexPromise = new Promise(res => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = KATEX + 'katex.min.css'; document.head.appendChild(css);
    const js = document.createElement('script'); js.src = KATEX + 'katex.min.js';
    js.onload = () => res(window.katex); js.onerror = () => res(null); document.head.appendChild(js);
  });
  return katexPromise;
}
/** 渲染 TeX；KaTeX 未就绪时显示源码并在就绪后补渲染。 */
export function tex(el, src) {
  el.dataset.tex = src;
  if (window.katex) { try { window.katex.render(src, el, { throwOnError: false, strict: false }); return el; } catch { /* fallthrough */ } }
  el.textContent = src;
  loadKatex().then(k => { if (k && el.dataset.tex === src) k.render(src, el, { throwOnError: false, strict: false }); });
  return el;
}

const CSS = `
.mv-module{max-width:720px;margin:1rem auto;padding:.7rem .85rem .85rem;background:${THEME.paper};border:1px solid ${THEME.rule};border-radius:8px;color:${THEME.ink};font-family:${THEME.sans}}
.mv-bar{display:flex;flex-wrap:wrap;gap:.4rem .6rem;align-items:center;margin:.1rem 0 .45rem}
.mv-seg{display:inline-flex;border:1px solid ${THEME.rule};border-radius:6px;overflow:hidden;background:${THEME.pane}}
.mv-seg button{border:0;background:transparent;color:${THEME.inkSoft};font:inherit;font-size:.78rem;padding:.3rem .7rem;min-height:30px;cursor:pointer}
.mv-seg button+button{border-left:1px solid ${THEME.rule}}
.mv-seg button.on{background:${THEME.accent};color:#fff}
.mv-btn{font:inherit;font-size:.78rem;border-radius:6px;border:1px solid ${THEME.rule};background:${THEME.pane};color:${THEME.ink};padding:.3rem .65rem;min-height:30px;cursor:pointer}
.mv-btn:hover{border-color:${THEME.muted}}
.mv-btn.primary{background:${THEME.accent};color:#fff;border-color:${THEME.accentStrong}}
.mv-btn:disabled{opacity:.45;cursor:default}
.mv-slider{display:inline-flex;align-items:center;gap:.35rem;font-size:.8rem;color:${THEME.inkSoft}}
.mv-slider input{width:110px;accent-color:${THEME.accent}}
.mv-slider .v{font-family:${THEME.mono};font-size:.74rem;min-width:3.2em;color:${THEME.ink}}
.mv-formula{font-size:.92rem;min-height:1.5em;margin:.1rem 0 .4rem}
.mv-readout{font-family:${THEME.mono};font-size:.78rem;color:${THEME.inkSoft};min-height:1.4em;margin-top:.4rem}
.mv-stage{position:relative;border:1px solid ${THEME.ruleSoft};border-radius:6px;background:${THEME.paper};overflow:hidden;touch-action:none}
.mv-stage canvas{display:block;width:100%}
.mv-labels{position:absolute;inset:0;pointer-events:none}
.mv-label{position:absolute;padding:0 4px;border-radius:3px;background:rgba(252,253,252,.82);font-size:.84rem;line-height:1.25;white-space:nowrap}
@media (prefers-reduced-motion:reduce){.mv-module *{transition:none!important}}
`;
function injectCss() {
  if (document.getElementById('mv-kit-css')) return;
  const s = document.createElement('style'); s.id = 'mv-kit-css'; s.textContent = CSS; document.head.appendChild(s);
}
const h = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; };

/**
 * 创建一个嵌入档模块外壳：[控件条] [一行公式] [画布+标签层] [一行读数]
 * @param {HTMLElement|string} root
 * @param {{height?:number, name?:string}} opts
 */
export function createModule(root, { height = 380, name = 'module' } = {}) {
  injectCss(); loadKatex();
  const host = typeof root === 'string' ? document.querySelector(root) : root;
  host.classList.add('mv-module');
  const bar = h('div', 'mv-bar', host);
  const formula = h('div', 'mv-formula', host);
  const stage = h('div', 'mv-stage', host);
  const canvas = h('canvas', '', stage); canvas.style.height = height + 'px';
  const labelLayer = h('div', 'mv-labels', stage);
  const readout = h('div', 'mv-readout', host);
  const ctx = canvas.getContext('2d');
  const cleanups = [];
  let W = 0, H = height, drawFn = () => {}, frameReq = 0;
  let pending = [], protect = [], lastPlaced = [];

  const fig = {
    name, host, bar, canvas, ctx, labelLayer, THEME,
    get width() { return W; }, get height() { return H; },
    /** 注册绘制函数 (fig) => void；调用 fig.redraw() 合帧重绘 */
    onDraw(fn) { drawFn = fn; fig.redraw(); return fig; },
    redraw() { if (!frameReq) frameReq = requestAnimationFrame(() => { frameReq = 0; paint(); }); },
    drawNow: () => paint(),
    on(target, type, fn, o) { target.addEventListener(type, fn, o); cleanups.push(() => target.removeEventListener(type, fn, o)); },
    addCleanup(fn) { cleanups.push(fn); },

    // —— 公式与读数（都走 KaTeX，各一行） ——
    formula: s => tex(formula, s),
    readout: s => tex(readout, s),

    // —— 画布绘制原语 ——
    /** 标记一块屏幕区域为"不可被标签遮挡" */
    protect(shape) { protect.push(shape); return shape; },
    /** 数学标签：锚点为屏幕坐标；dir 为首选方向 */
    /** optional: 放不下就不画（适合曲线名、次要标注） */
    label(texSrc, anchor, { color = THEME.ink, dir = null, id = texSrc, optional = false } = {}) { pending.push({ id, tex: texSrc, anchor, color, dir, optional }); },
    grid2d(plane, { step = null } = {}) {
      const { xmin, xmax, ymin, ymax } = plane.view;
      ctx.save(); ctx.strokeStyle = alpha(THEME.ruleSoft, 1); ctx.lineWidth = 0.6;
      const xs = step ? niceTicks(xmin, xmax, (xmax - xmin) / step) : niceTicks(xmin, xmax, 10);
      const ys = step ? niceTicks(ymin, ymax, (ymax - ymin) / step) : niceTicks(ymin, ymax, 8);
      ctx.beginPath();
      for (const x of xs) { const [a, b] = plane.toScreen(x, ymin), [, d] = plane.toScreen(x, ymax); ctx.moveTo(a, b); ctx.lineTo(a, d); }
      for (const y of ys) { const [a, b] = plane.toScreen(xmin, y), [c] = plane.toScreen(xmax, y); ctx.moveTo(a, b); ctx.lineTo(c, b); }
      ctx.stroke(); ctx.restore();
    },
    axes2d(plane, { xLabel = 'x', yLabel = 'y', ticks = true } = {}) {
      const { xmin, xmax, ymin, ymax } = plane.view;
      const ox = clamp(0, xmin, xmax), oy = clamp(0, ymin, ymax);
      ctx.save(); ctx.strokeStyle = THEME.muted; ctx.fillStyle = THEME.muted; ctx.lineWidth = 1;
      const [ax, ay] = plane.toScreen(xmin, oy), [bx] = plane.toScreen(xmax, oy);
      const [cx, cy] = plane.toScreen(ox, ymin), [, dy] = plane.toScreen(ox, ymax);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, ay); ctx.moveTo(cx, cy); ctx.lineTo(cx, dy); ctx.stroke();
      if (ticks) {
        ctx.font = `9px ${THEME.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        for (const t of niceTicks(xmin, xmax, 7)) if (t !== 0) { const [px, py] = plane.toScreen(t, oy); ctx.fillText(String(t), px, py + 4); }
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        for (const t of niceTicks(ymin, ymax, 6)) if (t !== 0) { const [px, py] = plane.toScreen(ox, t); ctx.fillText(String(t), px - 4, py); }
      }
      ctx.font = `italic 12px ${THEME.serif}`; ctx.fillStyle = THEME.inkSoft; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(xLabel, bx - 2, ay - 3); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(yLabel, cx + 5, dy + 2);
      ctx.restore();
    },
    /** 画 y=f(x)，自动采样与断点；返回屏幕折线（已登记为保护区） */
    curve(plane, f, { color = THEME.accent, width = THEME.curveWidth, x0 = plane.view.xmin, x1 = plane.view.xmax, dash = null, protect: prot = true } = {}) {
      const segs = sampleFunction(f, x0, x1, { plane });
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = ctx.lineJoin = 'round'; if (dash) ctx.setLineDash(dash);
      const screen = segs.map(s => s.map(([x, y]) => { const [px, py] = plane.toScreen(x, y); return { x: px, y: clamp(py, -1e4, 1e4) }; }));
      for (const s of screen) { ctx.beginPath(); s.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); }
      ctx.restore();
      if (prot) for (const s of screen) protect.push({ kind: 'line', pts: s.filter((_, i) => i % 3 === 0 || i === s.length - 1), weight: 200 });
      return screen;
    },
    polyline(pts, { color = THEME.warm, width = 1.4, alpha: a = 1, protect: prot = true } = {}) {
      if (pts.length < 2) return;
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = ctx.lineJoin = 'round';
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.restore();
      if (prot) protect.push({ kind: 'line', pts, weight: 200 });
    },
    polygon(pts, { fill = alpha(THEME.accent, 0.1), stroke = THEME.accent, width = 1.2, protect: prot = true } = {}) {
      ctx.save(); ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke(); }
      ctx.restore();
      if (prot) protect.push({ kind: 'poly', pts, weight: 260 });
    },
    point(p, { color = THEME.accent, r = 4, ring = true } = {}) {
      ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
      if (ring) { ctx.lineWidth = 1.5; ctx.strokeStyle = THEME.paper; ctx.stroke(); }
      ctx.restore(); protect.push({ kind: 'rect', x: p.x - r - 2, y: p.y - r - 2, w: 2 * r + 4, h: 2 * r + 4, weight: 300 });
    },
    /** 屏幕坐标箭头；返回 {dir} 便于给标签指方向 */
    arrow(a, b, { color = THEME.accent, width = 2.1, head = 10, handle = false } = {}) {
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy, py = ux;
      const hd = Math.min(head, L * 0.45);
      ctx.save(); ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x - ux * hd * 0.6, b.y - uy * hd * 0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - ux * hd + px * hd * 0.38, b.y - uy * hd + py * hd * 0.38);
      ctx.lineTo(b.x - ux * hd - px * hd * 0.38, b.y - uy * hd - py * hd * 0.38); ctx.closePath(); ctx.fill();
      if (handle) { ctx.beginPath(); ctx.arc(b.x, b.y, 5.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke(); }
      ctx.restore();
      protect.push({ kind: 'line', pts: [a, b], weight: 220 });
      return { dir: { x: ux, y: uy } };
    },

    /** 调试/验收报告：标签实际包围盒与遮挡情况（供 scripts/check-render.mjs 读取） */
    report() {
      const box = labelLayer.getBoundingClientRect();
      const labels = [...labelLayer.children].map(el => { const r = el.getBoundingClientRect(); return { tex: el.dataset.tex, x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height }; });
      const issues = [];
      labels.forEach((r, i) => {
        const core = { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }; // 容忍亚像素
        protect.forEach((s, j) => { const o = occlusion(core, s); if (o > 0.15) issues.push({ label: r.tex, shape: j, kind: s.kind, amount: +o.toFixed(2) }); });
        labels.slice(i + 1).forEach(q => { if (rectsOverlap(r, q)) issues.push({ label: r.tex, other: q.tex, kind: 'label' }); });
        if (r.x < 0 || r.y < 0 || r.x + r.w > W || r.y + r.h > H) issues.push({ label: r.tex, kind: 'outside' });
      });
      return { name, width: W, height: H, labels, protectCount: protect.length, protect, issues };
    },
    destroy() { cancelAnimationFrame(frameReq); cleanups.splice(0).forEach(f => f()); host.innerHTML = ''; },
  };

  function paint() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = canvas.clientWidth || 680; H = canvas.clientHeight || height;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    pending = []; protect = [];
    drawFn(fig);
    flushLabels();
  }
  function flushLabels() {
    // 先渲染到 DOM 测真实尺寸，再布局
    const els = pending.map(L => { const el = h('div', 'mv-label'); el.style.color = L.color; el.style.visibility = 'hidden'; tex(el, L.tex); return el; });
    labelLayer.replaceChildren(...els);
    const sized = pending.map((L, i) => ({ ...L, size: { w: els[i].offsetWidth || 8 * L.tex.length, h: els[i].offsetHeight || 18 } }));
    lastPlaced = placeLabels(sized, { width: W, height: H, protect });
    lastPlaced.forEach((p, i) => { if (p.hidden) els[i].remove(); else Object.assign(els[i].style, { left: p.x + 'px', top: p.y + 'px', visibility: '' }); });
  }
  if (typeof ResizeObserver !== 'undefined') { const ro = new ResizeObserver(() => fig.redraw()); ro.observe(canvas); cleanups.push(() => ro.disconnect()); }
  // KaTeX 到位后标签尺寸会变，重排一次
  loadKatex().then(() => fig.redraw());
  registerDebug(name, fig);
  return fig;
}

// ───────────────────────── 控件（薄控件条） ─────────────────────────
export function segmented(fig, items, value, onChange) {
  const box = h('div', 'mv-seg', fig.bar); const btns = new Map();
  for (const [key, labelText] of items) {
    const b = h('button', '', box); b.type = 'button'; b.textContent = labelText; btns.set(key, b);
    fig.on(b, 'click', () => { set(key); onChange(key); });
  }
  const set = k => btns.forEach((b, key) => b.classList.toggle('on', key === k));
  set(value);
  return { set, el: box };
}
export function button(fig, text, onClick, { primary = false } = {}) {
  const b = h('button', 'mv-btn' + (primary ? ' primary' : ''), fig.bar); b.type = 'button'; b.textContent = text; fig.on(b, 'click', onClick); return b;
}
/** 滑块；label 为 TeX */
export function slider(fig, { label, min, max, step = 0.01, value, digits = 2, onInput }) {
  const wrap = h('label', 'mv-slider', fig.bar); tex(h('span', '', wrap), label);
  const inp = h('input', '', wrap); Object.assign(inp, { type: 'range', min, max, step, value });
  const v = h('span', 'v', wrap); v.textContent = (+value).toFixed(digits);
  fig.on(inp, 'input', () => { v.textContent = (+inp.value).toFixed(digits); onInput(+inp.value); });
  return { el: inp, set(x) { inp.value = x; v.textContent = (+x).toFixed(digits); } };
}

// ───────────────────────── 动画（rAF、可打断、隐藏页暂停、尊重减少动态） ─────────────────────────
export function createAnimator(fig) {
  const jobs = new Set(); let raf = 0, last = 0;
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick = now => {
    raf = 0; const dt = last ? Math.min(64, now - last) : 16; last = now;
    if (document.hidden) { last = 0; raf = requestAnimationFrame(tick); return; }
    for (const j of [...jobs]) if (j(dt) === false) jobs.delete(j);
    fig?.drawNow();
    if (jobs.size) raf = requestAnimationFrame(tick); else last = 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const api = {
    /** 补间 obj 的数值字段到 targets；返回取消函数 */
    tween(obj, targets, ms = 650, fn = ease.outCubic) {
      const from = {}; for (const k in targets) from[k] = obj[k];
      if (reduced) { Object.assign(obj, targets); fig?.redraw(); return () => {}; }
      let t = 0; const job = dt => { t = Math.min(1, t + dt / ms); const e = fn(t); for (const k in targets) obj[k] = lerp(from[k], targets[k], e); return t < 1; };
      jobs.add(job); kick(); return () => jobs.delete(job);
    },
    /** 每帧回调 (dt)=>bool，返回 false 停止 */
    loop(fn) { jobs.add(fn); kick(); return () => jobs.delete(fn); },
    cancelAll() { jobs.clear(); },
    get busy() { return jobs.size > 0; },
  };
  fig?.addCleanup(() => { jobs.clear(); cancelAnimationFrame(raf); });
  return api;
}

/** 三维拖动旋转（只改相机）+ 可选拖拽句柄。handles: () => [{id, x, y}]，onDragHandle(id, x, y) */
export function orbitControls(fig, camera, { handles = null, onDragHandle = null } = {}) {
  let mode = null, lx = 0, ly = 0, hid = null;
  const local = e => { const r = fig.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  fig.on(fig.canvas, 'pointerdown', e => {
    const [x, y] = local(e); fig.canvas.setPointerCapture(e.pointerId);
    const hit = handles?.().find(p => Math.hypot(p.x - x, p.y - y) < 12);
    mode = hit ? 'handle' : 'orbit'; hid = hit?.id; lx = x; ly = y; fig.canvas.style.cursor = 'grabbing';
  });
  fig.on(fig.canvas, 'pointermove', e => {
    const [x, y] = local(e);
    if (!mode) { fig.canvas.style.cursor = handles?.().some(p => Math.hypot(p.x - x, p.y - y) < 12) ? 'pointer' : 'grab'; return; }
    if (mode === 'orbit') camera.rotate(x - lx, y - ly); else onDragHandle?.(hid, x, y);
    lx = x; ly = y; fig.redraw();
  });
  const end = () => { mode = null; fig.canvas.style.cursor = 'grab'; };
  fig.on(fig.canvas, 'pointerup', end); fig.on(fig.canvas, 'pointercancel', end);
  fig.canvas.tabIndex = 0;
  fig.on(fig.canvas, 'keydown', e => {
    const d = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[e.key];
    if (d) { camera.rotate(...d); fig.redraw(); e.preventDefault(); }
  });
}

// ───────────────────────── 调试钩子（验收脚本读取） ─────────────────────────
function registerDebug(name, fig) {
  if (typeof window === 'undefined') return;
  window.__mathviz = window.__mathviz || {};
  window.__mathviz[name] = { report: () => fig.report(), redraw: () => fig.drawNow() };
}
/** 模块把状态读写暴露给验收脚本：expose(fig, { getState, setState })，setState 后应调用 fig.drawNow() */
export function expose(fig, api) {
  if (typeof window === 'undefined') return;
  Object.assign(window.__mathviz[fig.name], api);
}
