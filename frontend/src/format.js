const eurFmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

export const eur = (n) => eurFmt.format(n ?? 0)

const kgFmt = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

// Products sold by weight: `quantity` is kg and `units` the pieces (API contract, Line).
export const isWeighed = (product) => product?.unit === 'kg'

export const countUnits = (lines = []) => lines.reduce((n, l) => n + (l.units ?? l.quantity), 0)

// "0,180 kg × 2,35 €/kg" or "2 × 0,45 €"
export const lineDetail = (l) =>
  isWeighed(l.product)
    ? `${kgFmt.format(l.quantity)} kg × ${eur(l.product.price)}/kg`
    : `${l.units ?? l.quantity} × ${eur(l.product.price)}`

// "0,180 kg · ", "2 × ", or nothing for a single unit unless `always`.
export const quantityPrefix = (l, { always = false } = {}) => {
  if (isWeighed(l.product)) return `${kgFmt.format(l.quantity)} kg · `
  const units = l.units ?? l.quantity
  return always || units > 1 ? `${units} × ` : ''
}

export const productsLabel = (n) => (n === 1 ? '1 producto' : `${n} productos`)

export const SOURCE_LABEL = {
  scanner: 'Escáner',
  vision: 'IA',
  selector: 'Selector',
}

// Nutri-Score colours. `product.nutriscore` is optional: it is only drawn when the catalog has it.
export const NUTRI = {
  A: ['#038141', '#FFFFFF'],
  B: ['#85BB2F', '#13261A'],
  C: ['#FECB02', '#13261A'],
  D: ['#EE8100', '#13261A'],
  E: ['#E63E11', '#FFFFFF'],
}

// Soft background for the product "photo" square, picked from the product id.
const TINTS = ['#E8F1FA', '#F7EBC8', '#F6D5CF', '#DCE7F0', '#EFE4CC', '#E3F1E6', '#F3E3C4', '#F1F0E8']
export const tint = (id = '') => TINTS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length]
