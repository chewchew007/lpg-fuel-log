import { formatDate } from '../lib/fuelLog.js'

const number = (value, digits = 0) => value.toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: 3 })

export default function FuelHistory({ records, editingId, onEdit }) {
  const ordered = [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <section className="history-panel" id="history" aria-labelledby="history-heading">
      <div className="history-heading"><div><span className="section-kicker">ดูย้อนหลังและแก้ไขได้</span><h2 id="history-heading">ประวัติเติมแก๊ส</h2></div><span className="count-badge">{records.length} รายการ</span></div>
      {records.length === 0 ? <div className="empty-state"><div className="empty-mark" aria-hidden="true">—</div><h3>เริ่มต้นจากการเติมครั้งแรก</h3><p>เมื่อบันทึกแล้ว ประวัติจะอยู่ตรงนี้<br />กดแก้ไขได้เสมอหากกรอกตัวเลขผิด</p></div> :
        <ol className="history-list">{ordered.map((record) => (
          <li key={record.id} className={`history-item ${editingId === record.id ? 'is-editing' : ''}`}>
            <div className="record-top"><time dateTime={record.filledDate}>{formatDate(record.filledDate)}</time>{editingId === record.id && <span className="editing-tag">กำลังแก้ไข</span>}</div>
            <div className="record-money">{number(record.amount, 2)} <span>บาท</span></div>
            <dl className="record-details"><div><dt>ระยะทางจากรอบก่อน</dt><dd>{number(record.distanceKm)} กม.</dd></div><div><dt>ปริมาณที่เติม</dt><dd>{number(record.liters)} ลิตร</dd></div></dl>
            <button type="button" className="edit-button" onClick={() => onEdit(record)} aria-label={`แก้ไขรายการ ${formatDate(record.filledDate)} จำนวน ${number(record.amount, 2)} บาท`}>แก้ไขรายการ<span aria-hidden="true">↗</span></button>
          </li>
        ))}</ol>}
    </section>
  )
}
