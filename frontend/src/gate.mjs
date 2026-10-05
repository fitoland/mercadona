// The demo assumes one object at a time. No object tracking or fraud detection.
export function newGate() {
  return { candidate: null, hits: 0, locked: false, empty: 0, lastSeen: 0 }
}
export function stepGate(state, detections, now = Date.now()) {
  let gate = { ...state }
  // Old frames must never contribute to a fresh consecutive sequence.
  if (now - gate.lastSeen > 3000) {
    gate.candidate = null; gate.hits = 0; gate.empty = 0
  }
  gate.lastSeen = now
  const eligible = detections.filter(d => d.product_key && d.confidence >= 0.60)
    .filter(d => {
      const [x1, y1, x2, y2] = d.box
      return (x1+x2)/2 > .2 && (x1+x2)/2 < .8 && (y1+y2)/2 > .15 && (y1+y2)/2 < .85
    })
  // Low confidence objects also block rearming: a confidence dip is not removal.
  const occupied = detections.some(d => {
    if (!d.product_key) return false
    const [x1,y1,x2,y2] = d.box
    return x2 > .2 && x1 < .8 && y2 > .15 && y1 < .85
  })
  if (!occupied) {
    gate.empty++
    gate.candidate = null; gate.hits = 0
    if (gate.empty >= 4) gate.locked = false
    return { gate, add: null, message: gate.locked ? 'Retira el objeto para preparar otra entrada' : 'Listo para el siguiente producto' }
  }
  gate.empty = 0
  if (gate.locked) return { gate, add: null, message: 'Registrado · retira el objeto de la zona' }
  if (eligible.length !== 1) {
    gate.candidate = null; gate.hits = 0
    return { gate, add: null, message: 'Presenta un solo producto con claridad en la zona' }
  }
  const key = eligible[0].product_key
  gate.hits = gate.candidate === key ? gate.hits + 1 : 1
  gate.candidate = key
  if (gate.hits < 3) return { gate, add: null, message: `Comprobando ${eligible[0].name} (${gate.hits}/3)` }
  gate.locked = true
  return { gate, add: key, message: 'Añadido · retira el objeto antes del siguiente' }
}
