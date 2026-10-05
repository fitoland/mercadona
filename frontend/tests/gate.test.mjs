import test from 'node:test'
import assert from 'node:assert/strict'
import { newGate, stepGate } from '../src/gate.mjs'
const apple = { product_key:'apple', name:'Manzana', confidence:.9, box:[.3,.3,.5,.5] }
test('one item is counted once until four empty observations rearm the gate', () => {
  let gate = newGate(), added = 0
  const feed = (items, time) => { const r = stepGate(gate, items, time); gate=r.gate; if(r.add) added++ }
  for(let i=1;i<=15;i++) feed([apple],i*400)
  assert.equal(added,1)
  for(let i=16;i<=19;i++) feed([],i*400)
  for(let i=20;i<=22;i++) feed([apple],i*400)
  assert.equal(added,2)
})
test('multiple objects and low confidence cannot trigger a purchase', () => {
  let gate = newGate()
  for(let i=1;i<8;i++) { const r=stepGate(gate,[apple,apple],i*400);gate=r.gate;assert.equal(r.add,null) }
  for(let i=8;i<16;i++) { const r=stepGate(gate,[{...apple,confidence:.5}],i*400);gate=r.gate;assert.equal(r.add,null) }
})
test('low confidence does not rearm a locked gate', () => {
  let gate = {...newGate(),locked:true}
  for(let i=1;i<8;i++) gate=stepGate(gate,[{...apple,confidence:.5}],i*400).gate
  assert.equal(gate.locked,true)
})
test('stale detections cannot form a consecutive sequence', () => {
  let gate=stepGate(newGate(),[apple],400).gate
  gate=stepGate(gate,[apple],800).gate
  const result=stepGate(gate,[apple],5000)
  assert.equal(result.add,null); assert.equal(result.gate.hits,1)
})
