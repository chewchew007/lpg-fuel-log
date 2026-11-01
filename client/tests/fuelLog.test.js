import test from 'node:test'
import assert from 'node:assert/strict'
import { validateForm, makeRecord, editRecord, readRecords, saveRecord, STORAGE_KEY } from '../src/lib/fuelLog.js'

const fields = { distanceKm: '320.5', amount: '500', liters: '32.5' }
function memoryStorage(initial = null) {
  let value = initial
  return { getItem: () => value, setItem: (_key, next) => { value = next } }
}

test('normal decimal input passes validation', () => assert.deepEqual(validateForm(fields), {}))
test('blank, negative, exponent, Infinity and zero are invalid', () => {
  for (const value of ['', ' ', '-1', '1e3', 'Infinity', '0', '0.000']) {
    assert.ok(validateForm({ ...fields, distanceKm: value }).distanceKm, value)
  }
})
test('rejects excess decimals and unsafe huge numbers', () => {
  assert.ok(validateForm({ ...fields, amount: '500.001' }).amount)
  assert.ok(validateForm({ ...fields, liters: '32.5001' }).liters)
  assert.ok(validateForm({ ...fields, distanceKm: '9007199254740993' }).distanceKm)
})
test('creation assigns Bangkok calendar date even before UTC midnight', () => {
  const record = makeRecord(fields, new Date('2026-11-01T17:30:00Z'))
  assert.equal(record.filledDate, '2026-11-02')
  assert.equal(record.distanceKm, 320.5)
  assert.equal(record.amount, 500)
})
test('editing changes only three numbers and preserves identity/date/timestamp', () => {
  const old = makeRecord(fields, new Date('2026-10-20T09:00:00Z'))
  const next = editRecord(old, { ...fields, amount: '550', filledDate: '2099-01-01', id: 'changed' })
  assert.equal(next.id, old.id)
  assert.equal(next.filledDate, '2026-10-20')
  assert.equal(next.createdAt, old.createdAt)
  assert.equal(next.amount, 550)
  assert.equal(old.amount, 500)
})
test('empty storage starts without sample records', () => assert.deepEqual(readRecords(memoryStorage()), []))
test('records survive JSON save and reload', () => {
  const storage = memoryStorage()
  const record = makeRecord(fields)
  saveRecord(storage, record, false)
  assert.deepEqual(readRecords(storage), [record])
})
test('editing stored record keeps count one', () => {
  const storage = memoryStorage()
  const original = makeRecord(fields)
  saveRecord(storage, original, false)
  saveRecord(storage, editRecord(original, { ...fields, amount: '550' }), true)
  assert.equal(readRecords(storage).length, 1)
  assert.equal(readRecords(storage)[0].amount, 550)
})
test('saving reads latest storage so other tab additions are kept', () => {
  const storage = memoryStorage()
  saveRecord(storage, makeRecord(fields), false)
  saveRecord(storage, makeRecord(fields), false)
  assert.equal(readRecords(storage).length, 2)
})
test('corrupt, unsupported or invalid stored data must not be overwritten', () => {
  for (const raw of ['{bad', '{"version":2,"records":[]}', '{"version":1,"records":[{}]}']) {
    const storage = memoryStorage(raw)
    assert.throws(() => saveRecord(storage, makeRecord(fields), false))
    assert.equal(storage.getItem(STORAGE_KEY), raw)
  }
})
test('failed writes throw instead of claiming persistence', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('quota') } }
  assert.throws(() => saveRecord(storage, makeRecord(fields), false), /quota/)
})
test('missing edit target fails rather than inserting a replacement', () => {
  assert.throws(() => saveRecord(memoryStorage(), makeRecord(fields), true))
})
