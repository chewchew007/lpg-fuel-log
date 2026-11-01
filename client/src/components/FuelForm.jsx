import { formatDate } from '../lib/fuelLog.js'

const inputs = [
  { name: 'distanceKm', label: 'วิ่งมาแล้วกี่กิโลเมตร', unit: 'กม.', placeholder: 'เช่น 320.5' },
  { name: 'amount', label: 'เติมแก๊สกี่บาท', unit: 'บาท', placeholder: 'เช่น 500', hint: 'จำนวนเงินที่จ่ายในการเติมครั้งนี้' },
  { name: 'liters', label: 'ได้แก๊สกี่ลิตร', unit: 'ลิตร', placeholder: 'เช่น 32.5', hint: 'ดูจำนวนลิตรจากหน้าปั๊มหรือใบเสร็จ' },
]

export default function FuelForm({ fields, errors, editingRecord, onChange, onSubmit, onCancel, formRef }) {
  const price = Number(fields.amount) > 0 && Number(fields.liters) > 0
    ? (Number(fields.amount) / Number(fields.liters)).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null
  return (
    <section className="form-panel" aria-labelledby="form-heading" ref={formRef}>
      <div className="panel-heading"><span className="section-kicker">{editingRecord ? 'แก้ไขรายการเดิม' : 'บันทึกรายการใหม่'}</span>
        <h2 id="form-heading">{editingRecord ? 'แก้ไขการเติมแก๊ส' : 'เติมแก๊ส'}</h2>
        <p>{editingRecord ? 'แก้ตัวเลขได้ทั้ง 3 ช่อง วันที่ของรายการจะคงเดิม' : 'กรอกเพียง 3 ช่อง แล้วกดบันทึกได้เลย'}</p></div>
      <div className="date-notice"><span className="date-symbol" aria-hidden="true">LPG</span><div>
        <strong>{editingRecord ? formatDate(editingRecord.filledDate) : 'วันที่เติมบันทึกให้อัตโนมัติ'}</strong>
        <span>{editingRecord ? 'วันที่เดิมของรายการ · เปลี่ยนไม่ได้' : 'ใช้วันที่ตอนกดบันทึก · ไม่ต้องกรอกเอง'}</span></div></div>
      <form onSubmit={onSubmit} noValidate>
        {inputs.map(({ name, label, unit, placeholder, hint }, index) => (
          <div className="form-field" key={name}>
            <label htmlFor={name}><span className="field-number" aria-hidden="true">{index + 1}</span>{label}</label>
            <div className={`input-wrap ${errors[name] ? 'has-error' : ''}`}><input id={name} name={name} type="text" inputMode="decimal" autoComplete="off" required
              value={fields[name]} onChange={(event) => onChange(name, event.target.value)} placeholder={placeholder}
              aria-invalid={Boolean(errors[name])} aria-describedby={`${name}-hint${errors[name] ? ` ${name}-error` : ''}`} /><span className="input-unit">{unit}</span></div>
            <p className="field-hint" id={`${name}-hint`}>{hint}</p>
            {errors[name] && <p className="field-error" id={`${name}-error`}>{errors[name]}</p>}
          </div>
        ))}
        {price && <p className="price-preview">ราคาต่อลิตร <strong>{price}</strong> บาท</p>}
        <div className="form-actions"><button className="button button-primary" type="submit">{editingRecord ? 'บันทึกการแก้ไข' : 'บันทึกการเติมแก๊ส'}<span aria-hidden="true">→</span></button>
          {editingRecord && <button className="button button-secondary" type="button" onClick={onCancel}>ยกเลิกการแก้ไข</button>}</div>
      </form>
    </section>
  )
}
