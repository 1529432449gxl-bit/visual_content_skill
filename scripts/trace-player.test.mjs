import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTracePlayer} from './trace-player.mjs';
const trace = [{state:[3,1,2]}, {state:[1,3,2]}, {state:[1,2,3]}];
test('history survives changes to source and cannot be mutated through snapshots',()=>{
 const source=structuredClone(trace), p=createTracePlayer(source);source[0].state[0]=9;
 assert.equal(p.snapshot().step.state[0],3);
 assert.throws(()=>{p.snapshot().step.state[0]=7},TypeError);
});
test('forward backward and seek reach identical states',()=>{
 const p=createTracePlayer(trace);p.next();p.next();p.previous();
 assert.deepEqual(p.snapshot().step,trace[1]);assert.deepEqual(p.seek(1).step,trace[1]);
 assert.equal(p.reset().index,0);assert.equal(p.previous().index,0);assert.equal(p.seek(99).index,2);
});
test('playback advances in logical steps and stops at end',()=>{
 const p=createTracePlayer(trace,{intervalMs:100});p.play();assert.equal(p.advance(99).index,0);
 assert.equal(p.advance(1).index,1);assert.equal(p.advance(10000).index,2);assert.equal(p.snapshot().playing,false);
});
test('pause and seek prevent stale playback',()=>{
 const p=createTracePlayer(trace,{intervalMs:100});p.play();p.advance(50);p.pause();
 assert.equal(p.advance(200).index,0);p.play();assert.equal(p.advance(50).index,1);
 p.seek(0);assert.equal(p.advance(1000).index,0);
});
test('speed changes scheduling only',()=>{
 const p=createTracePlayer(trace,{intervalMs:100});p.setSpeed(2);p.play();
 assert.deepEqual(p.advance(50).step,trace[1]);
});
test('invalid inputs rejected and one-state trace stays stopped',()=>{
 assert.throws(()=>createTracePlayer([]));assert.throws(()=>createTracePlayer(trace,{intervalMs:0}));
 const p=createTracePlayer([trace[0]]);assert.equal(p.play().playing,false);
 assert.throws(()=>p.seek(NaN));assert.throws(()=>p.advance(-1));assert.throws(()=>p.setSpeed(0));
});
