import { useEffect, useRef, useState } from 'react'
import FuelForm from './components/FuelForm.jsx'
import FuelHistory from './components/FuelHistory.jsx'
import { STORAGE_KEY, bangkokDate, formatDate, validateForm, makeRecord, editRecord, readRecords, saveRecord } from './lib/fuelLog.js'
import './App.css'

const emptyFields = () => ({ distanceKm: '', amount: '', liters: '' })
function loadInitialData() {
  try { return { records: readRecords(window.localStorage), error: '' } }
  catch { return { records: [], error: 'ยังอ่านประวัติในเครื่องไม่ได้ กรุณาให้ผู้ดูแลตรวจสอบ ข้อมูลเดิมยังไม่ถูกเปลี่ยน' } }
}

export default function App() {
  const [data, setData] = useState(loadInitialData)
  const [fields, setFields] = useState(emptyFields)
  const [errors, setErrors] = useState({})
  const [editingRecord, setEditingRecord] = useState(null)
  const [notice, setNotice] = useState('')
  const [saveError, setSaveError] = useState('')
  const formRef = useRef(null)
  const savingRef = useRef(false)

  useEffect(() => {
    function refresh(event) {
      if (event.key === STORAGE_KEY || event.key === null) setData(loadInitialData())
    }
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])

  function changeField(name, value) {
    setFields((previous) => ({ ...previous, [name]: value }))
    setErrors((previous) => ({ ...previous, [name]: undefined }))
    setNotice('')
    setSaveError('')
  }

  function resetForm() {
    setFields(emptyFields())
    setErrors({})
    setEditingRecord(null)
    setSaveError('')
  }

  function submitForm(event) {
    event.preventDefault()
    if (savingRef.current) return
    const nextErrors = validateForm(fields)
    setErrors(nextErrors)
    setNotice('')
    setSaveError('')
    if (Object.keys(nextErrors).length) {
      formRef.current.querySelector(`[name="${Object.keys(nextErrors)[0]}"]`).focus()
      return
    }
    savingRef.current = true
    try {
      const record = editingRecord ? editRecord(editingRecord, fields) : makeRecord(fields)
      const records = saveRecord(window.localStorage, record, Boolean(editingRecord))
      setData({ records, error: '' })
      setNotice(editingRecord ? 'แก้ไขรายการเรียบร้อยแล้ว วันที่เดิมยังคงอยู่' : 'บันทึกการเติมแก๊สเรียบร้อยแล้ว')
      resetForm()
    } catch {
      setSaveError('ยังบันทึกไม่ได้ ข้อมูลที่กรอกยังอยู่ กรุณาตรวจสอบพื้นที่จัดเก็บและประวัติเดิม แล้วลองอีกครั้ง')
    } finally { savingRef.current = false }
  }

  function startEditing(record) {
    setEditingRecord(record)
    setFields({ distanceKm: String(record.distanceKm), amount: String(record.amount), liters: String(record.liters) })
    setErrors({})
    setNotice('')
    setSaveError('')
    formRef.current.scrollIntoView({ behavior: 'auto', block: 'start' })
    formRef.current.querySelector('input').focus({ preventScroll: true })
  }

  const totals = data.records.reduce((sum, record) => ({ amount: sum.amount + record.amount, liters: sum.liters + record.liters }), { amount: 0, liters: 0 })
  const money = (value) => value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="app-shell">
      <header className="site-header"><a href="#main" className="brand"><span className="brand-mark" aria-hidden="true">LPG<span>↗</span></span><span>บันทึกเติมแก๊ส<small>ทุกการเดินทาง จดจำได้ง่ายขึ้น</small></span></a><a className="history-link" href="#history">ดูประวัติ <span aria-hidden="true">↗</span></a></header>
      <main id="main">
        <div className="page-intro"><div><span className="eyebrow">สมุดบันทึกประจำรถ</span><h1>เติมแล้ว จดไว้<span className="heading-dot">.</span></h1><p>บันทึกง่าย ดูย้อนหลังได้ ตัวเลขผิดก็แก้ไขได้เสมอ</p></div><div className="today-label"><span>วันนี้</span><time dateTime={bangkokDate()}>{formatDate(bangkokDate())}</time></div></div>
        <div className="summary-strip" aria-label="สรุปข้อมูลที่บันทึกทั้งหมด"><div><span>บันทึกทั้งหมด</span><strong>{data.records.length}<small>ครั้ง</small></strong></div><div><span>ค่าแก๊สรวม</span><strong>{money(totals.amount)}<small>บาท</small></strong></div><div><span>ปริมาณรวม</span><strong>{totals.liters.toLocaleString('th-TH', { maximumFractionDigits: 3 })}<small>ลิตร</small></strong></div></div>
        {data.error && <p className="message message-error" role="alert">{data.error}</p>}
        <div aria-live="polite">{notice && <p className="message message-success">{notice}</p>}</div>
        {saveError && <p className="message message-error" role="alert">{saveError}</p>}
        <div className="workspace"><FuelForm fields={fields} errors={errors} editingRecord={editingRecord} onChange={changeField} onSubmit={submitForm} onCancel={() => { resetForm(); setNotice('ยกเลิกการแก้ไขแล้ว ข้อมูลเดิมไม่เปลี่ยน') }} formRef={formRef} /><FuelHistory records={data.records} editingId={editingRecord?.id} onEdit={startEditing} /></div>
      </main>
      <footer className="site-footer"><span>LPG FUEL LOG</span><p>ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้ · เปิดกลับมาดูและแก้ไขได้<br />หากล้างข้อมูลเว็บไซต์หรือเปลี่ยนเบราว์เซอร์ ประวัติจะไม่ตามไปด้วย</p></footer>
    </div>
  )
}
