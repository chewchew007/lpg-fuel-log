export const STORAGE_KEY = 'lpg-fuel-log:records:v1'
const rules = {
  distanceKm: { label: 'ระยะทาง', decimals: 3, max: 999999 },
  amount: { label: 'จำนวนเงิน', decimals: 2, max: 999999 },
  liters: { label: 'จำนวนลิตร', decimals: 3, max: 9999 },
}

export function validateForm(fields) {
  const errors = {}
  for (const [name, rule] of Object.entries(rules)) {
    const value = String(fields[name] ?? '').trim()
    const pattern = new RegExp(`^\\d+(?:\\.\\d{1,${rule.decimals}})?$`)
    if (!pattern.test(value) || Number(value) <= 0 || Number(value) > rule.max) {
      errors[name] = `กรอก${rule.label}มากกว่า 0 ไม่เกิน ${rule.max.toLocaleString('th-TH')} และทศนิยมไม่เกิน ${rule.decimals} ตำแหน่ง`
    }
  }
  return errors
}

export function bangkokDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const get = (type) => parts.find((part) => part.type === type).value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok',
  }).format(new Date(`${date}T12:00:00+07:00`))
}

function numbersFrom(fields) {
  if (Object.keys(validateForm(fields)).length) throw new Error('กรุณาตรวจสอบตัวเลขที่กรอก')
  return { distanceKm: Number(fields.distanceKm), amount: Number(fields.amount), liters: Number(fields.liters) }
}

export function makeRecord(fields, now = new Date()) {
  return { ...numbersFrom(fields), id: crypto.randomUUID(), filledDate: bangkokDate(now), createdAt: now.toISOString() }
}

export function editRecord(record, fields) {
  // Copy only the three editable values. Keep the original identity and date.
  return { ...record, ...numbersFrom(fields) }
}

function isRecord(record) {
  if (!record || typeof record !== 'object') return false
  const date = record.filledDate
  return typeof record.id === 'string' && record.id.length > 0
    && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(date)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date
    && typeof record.createdAt === 'string' && Number.isFinite(Date.parse(record.createdAt))
    && Object.keys(rules).every((name) => typeof record[name] === 'number' && Number.isFinite(record[name]))
    && Object.keys(validateForm(record)).length === 0
}

export function readRecords(storage) {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) return []
  const data = JSON.parse(raw)
  if (!data || data.version !== 1 || !Array.isArray(data.records) || !data.records.every(isRecord)
    || new Set(data.records.map((record) => record.id)).size !== data.records.length) {
    throw new Error('อ่านประวัติเดิมไม่ได้ ข้อมูลเดิมยังไม่ถูกเปลี่ยน')
  }
  return data.records
}

export function saveRecord(storage, record, isEdit) {
  const records = readRecords(storage)
  if (!isRecord(record)) throw new Error('ข้อมูลรายการไม่ถูกต้อง')
  if (isEdit && !records.some((item) => item.id === record.id)) throw new Error('ไม่พบรายการเดิม')
  const next = isEdit
    ? records.map((item) => item.id === record.id ? editRecord(item, record) : item)
    : [record, ...records.filter((item) => item.id !== record.id)]
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: next }))
  return next
}
