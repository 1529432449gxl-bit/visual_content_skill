import test from 'node:test';
import assert from 'node:assert/strict';
import { niceTicks, createPlane, sampleFunction, createOrbitCamera, placeLabels, occlusion, createTracePlayer, fmt, ease, vec3, rng } from './mathviz-kit.js';

test('niceTicks 1-2-5 且含 0', () => {
  assert.deepEqual(niceTicks(-1, 1, 4), [-1, -0.5, 0, 0.5, 1]);
  assert.deepEqual(niceTicks(0, 10, 5), [0, 2, 4, 6, 8, 10]);
  assert.ok(niceTicks(-3.2, 7.9, 6).includes(0));
});

test('createPlane 往返与等比', () => {
  const p = createPlane({ xmin: -2, xmax: 2, ymin: -1, ymax: 1, width: 400, height: 300, equal: true });
  assert.equal(p.sx, p.sy);
  const [a, b] = p.toScreen(0.7, -0.3), [x, y] = p.toWorld(a, b);
  assert.ok(Math.abs(x - 0.7) < 1e-12 && Math.abs(y + 0.3) < 1e-12);
});

test('sampleFunction 在 tan 的渐近线处断开', () => {
  const plane = createPlane({ xmin: -4, xmax: 4, ymin: -5, ymax: 5, width: 600, height: 400 });
  const segs = sampleFunction(Math.tan, -4, 4, { plane });
  assert.equal(segs.length, 3, `期望 3 段，得到 ${segs.length}`);
});

test('sampleFunction 在定义域外（sqrt）断开且不产生 NaN', () => {
  const plane = createPlane({ xmin: -2, xmax: 2, ymin: -1, ymax: 2, width: 400, height: 300 });
  const segs = sampleFunction(Math.sqrt, -2, 2, { plane });
  assert.equal(segs.length, 1);
  assert.ok(segs[0].every(([, y]) => Number.isFinite(y)));
  assert.ok(segs[0][0][0] <= 0.02, '应细分逼近 x=0 端点');
});

test('sampleFunction 在高曲率处加密', () => {
  const plane = createPlane({ xmin: 0, xmax: 1, ymin: -1, ymax: 1, width: 600, height: 300 });
  const segs = sampleFunction(x => Math.sin(1 / (x + 0.02)), 0, 1, { plane, n: 40 });
  const pts = segs.flat();
  const left = pts.filter(([x]) => x < 0.1).length, right = pts.filter(([x]) => x > 0.9).length;
  assert.ok(left > 5 * right, `左侧 ${left} 应远多于右侧 ${right}`);
});

test('相机：旋转只改视角，原点投影到画面中心附近', () => {
  const cam = createOrbitCamera();
  const o = cam.project([0, 0, 0], 600, 400);
  assert.ok(Math.abs(o.x - 300) < 1e-9 && Math.abs(o.y - 208) < 1e-9);
  cam.rotate(100, 50); assert.notEqual(cam.state.yaw, 0.75); cam.reset(); assert.equal(cam.state.yaw, 0.75);
  cam.rotate(0, 1e6); assert.ok(cam.state.pitch <= 1.45);
});

test('occlusion：面、线、矩形', () => {
  const sq = { kind: 'poly', pts: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] };
  assert.equal(occlusion({ x: 40, y: 40, w: 20, h: 10 }, sq), 1);
  assert.equal(occlusion({ x: 140, y: 40, w: 20, h: 10 }, sq), 0);
  const ln = { kind: 'line', pts: [{ x: 0, y: 50 }, { x: 200, y: 50 }] };
  assert.ok(occlusion({ x: 50, y: 45, w: 20, h: 10 }, ln) > 0);
  assert.equal(occlusion({ x: 50, y: 60, w: 20, h: 10 }, ln), 0);
});

test('placeLabels 避开平行四边形与彼此', () => {
  const para = { kind: 'poly', pts: [{ x: 200, y: 200 }, { x: 320, y: 200 }, { x: 360, y: 120 }, { x: 240, y: 120 }] };
  const labels = [
    { id: 'a', anchor: { x: 320, y: 200 }, size: { w: 30, h: 18 } },
    { id: 'b', anchor: { x: 240, y: 120 }, size: { w: 30, h: 18 } },
    { id: 'ab', anchor: { x: 280, y: 160 }, size: { w: 60, h: 18 } }, // 锚点在面中心：必须被挪出去
  ];
  const out = placeLabels(labels, { width: 600, height: 400, protect: [para] });
  for (const r of out) assert.ok(occlusion(r, para) <= 0.2, `${r.id} 压在面上`);
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const a = out[i], b = out[j];
    assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), `${a.id} 与 ${b.id} 重叠`);
  }
  for (const r of out) assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 600 && r.y + r.h <= 400);
});

test('tracePlayer：播放到 k 与 seek(k) 一致，快照不可写', () => {
  const steps = Array.from({ length: 6 }, (_, i) => ({ x: i, arr: [i] }));
  const p = createTracePlayer(steps, { intervalMs: 100 });
  p.play(); p.advance(250);
  const q = createTracePlayer(steps, { intervalMs: 100 });
  assert.deepEqual(p.snapshot().step, q.seek(2).step);
  assert.throws(() => { p.snapshot().step.arr.push(9); });
  p.advance(10_000); assert.equal(p.snapshot().index, 5); assert.equal(p.snapshot().playing, false);
  p.play(); assert.equal(p.snapshot().index, 0, '末尾再播放应从头开始');
});

test('杂项', () => {
  assert.equal(fmt(-0.0001), '0.00');
  assert.equal(ease.outCubic(1), 1); assert.equal(ease.inOutCubic(0.5), 0.5);
  assert.deepEqual(vec3.cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  const r1 = rng(7), r2 = rng(7); assert.equal(r1(), r2());
});

test('optional 标签放不下时隐藏，必选标签先放', () => {
  const wall = { kind: 'rect', x: 0, y: 0, w: 240, h: 200, weight: 1000 };
  const out = placeLabels([
    { id: 'opt', anchor: { x: 30, y: 100 }, size: { w: 40, h: 18 }, optional: true },
    { id: 'must', anchor: { x: 270, y: 100 }, size: { w: 40, h: 18 } },
  ], { width: 300, height: 200, protect: [wall] });
  assert.equal(out[0].id, 'opt'); assert.equal(out[0].hidden, true);
  assert.equal(out[1].id, 'must'); assert.ok(!out[1].hidden);
});
