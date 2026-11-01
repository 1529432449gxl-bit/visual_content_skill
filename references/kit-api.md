# mathviz-kit API 速查

`import * as MV from '../../lib/mathviz-kit.js'`（脚手架会写好相对路径）。纯函数可在 Node 中 import 做验算与单测。

## 外壳

```js
const fig = MV.createModule('#app', { name: 'my-module', height: 360 });
fig.onDraw(({ ctx, width, height }) => { /* 每帧从 state 画出全部内容 */ });
fig.redraw();      // 合帧重绘（状态变了就调）
fig.drawNow();     // 立即重绘（setState / 验收用）
fig.formula(tex);  // 控件条下方一行 KaTeX
fig.readout(tex);  // 画布下方一行 KaTeX 读数
fig.on(target, type, fn);  // 注册监听，destroy 时自动移除
fig.destroy();     // 卸载：清监听、rAF、ResizeObserver、DOM（Vue beforeUnmount 调它）
```

## 控件（进 fig.bar，薄控件条）

```js
const seg = MV.segmented(fig, [['a','模式甲'],['b','模式乙']], 'a', key => {...});  seg.set('b')
const s = MV.slider(fig, { label: 'x_0', min, max, step, value, digits: 2, onInput: v => {...} });  s.set(v)
const btn = MV.button(fig, '复位', fn, { primary: false });
```

## 平面

```js
const plane = MV.createPlane({ xmin, xmax, ymin, ymax, width, height, pad: 24, equal: true }); // 几何图务必 equal
plane.toScreen(x, y) -> [px, py];  plane.toWorld(px, py) -> [x, y]
fig.grid2d(plane);  fig.axes2d(plane, { xLabel: 'x', yLabel: 'y' });
fig.curve(plane, f, { color, width, x0, x1, dash });   // 自适应采样，间断处自动断开，返回屏幕折线
MV.sampleFunction(f, x0, x1, { plane })                 // 纯函数版，返回世界坐标分段
MV.niceTicks(min, max, n)
```

## 屏幕坐标原语（自动登记为标签保护区）

```js
fig.polyline(pts, { color, width, alpha });
fig.polygon(pts, { fill: MV.alpha(MV.ROLE.primary, 0.1), stroke, width });
fig.point({x,y}, { color, r: 4 });
const { dir } = fig.arrow(a, b, { color, width, head, handle });
fig.label(tex, anchor, { color, dir, optional });   // dir 给首选方向（如箭头方向）；optional 放不下就不画
fig.protect({ kind: 'rect'|'poly'|'line', ... });    // 手动登记额外保护区（如自绘区域）
```

## 三维

```js
const cam = MV.createOrbitCamera({ zUp: true, yaw, pitch, dist, fov });
const p = cam.project([x,y,z], W, H);   // {x, y, z(视深), k}
MV.orbitControls(fig, cam, { handles: () => [{id,x,y}], onDragHandle: (id,x,y) => {...} });  // 拖动只改相机；可选拖拽句柄
cam.reset();
MV.vec3.{add, sub, scale, dot, cross, len, norm, lerp}
```

画面顺序：网格 → 坐标轴 → 面（polygon，低 alpha）→ 次要箭头 → 主箭头 → 标签。复杂透明相交只做平均深度排序，不假装物理正确。

## 动画与回放

```js
const anim = MV.createAnimator(fig);
anim.tween(state, { fill: 1 }, 650, MV.ease.outCubic);  // 返回取消函数；减少动态时直接跳到终值
anim.loop(dt => keepGoing);                              // 每帧回调
anim.cancelAll();                                        // 参数变化时先调

const player = MV.createTracePlayer(steps, { intervalMs: 900 });
player.{snapshot, seek, next, previous, reset, play, pause, toggle, setSpeed, advance(dt)}
// snapshot(): { index, count, playing, progress(0..1 当前段), step }
```

## 杂项

`MV.THEME`（色值与字体）、`MV.ROLE`（primary/secondary/tertiary/result 四个角色色）、`MV.alpha(hex, a)`、`MV.fmt(n, d)`、`MV.rng(seed)`、`MV.clamp`、`MV.lerp`、`MV.ease`。

## 验收钩子

```js
MV.expose(fig, {
  getState: () => ({ ...state }),
  setState: s => { Object.assign(state, s); /* 同步控件 */ fig.drawNow(); },
});
```

`check-render --states` 依次调用 setState 后截图；`window.__mathviz[name].report()` 返回标签真实包围盒、保护区与遮挡问题。
