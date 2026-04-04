import { useState, useRef, useEffect } from 'react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

function parseValue(val) {
  if (!val) return null
  const d = new Date(val + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}

function toISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function clampDay(y, m, day) {
  const max = new Date(y, m + 1, 0).getDate()
  return Math.min(day, max)
}

export default function DatePicker({ value, onChange, disabled, className }) {
  const parsed = parseValue(value)
  const today = new Date(); today.setHours(0,0,0,0)

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('calendar') // 'calendar' | 'picker'
  const [viewDate, setViewDate] = useState(() => parsed ?? new Date())
  const [pickerYear, setPickerYear] = useState(() => (parsed ?? new Date()).getFullYear())
  const [pickerMonth, setPickerMonth] = useState(() => (parsed ?? new Date()).getMonth())
  const wrapRef = useRef(null)

  // Sync viewDate when value changes externally
  useEffect(() => {
    const d = parseValue(value)
    if (d) { setViewDate(d); setPickerYear(d.getFullYear()); setPickerMonth(d.getMonth()) }
  }, [value])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setMode('calendar')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // ── Calendar helpers ──────────────────────────────────────────────────────
  function getDaysGrid(year, month) {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }

  const vy = viewDate.getFullYear()
  const vm = viewDate.getMonth()
  const cells = getDaysGrid(vy, vm)
  const selectedDay = parsed?.getFullYear() === vy && parsed?.getMonth() === vm ? parsed.getDate() : null
  const todayDay = today.getFullYear() === vy && today.getMonth() === vm ? today.getDate() : null

  function selectDay(day) {
    if (!day) return
    onChange(toISO(new Date(vy, vm, day)))
    setOpen(false)
    setMode('calendar')
  }

  function selectToday() {
    onChange(toISO(today))
    setOpen(false)
    setMode('calendar')
  }

  function prevMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }
  function nextMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }

  // ── Picker helpers ────────────────────────────────────────────────────────
  function applyPickerChange(year, month) {
    const origDay = parsed ? parsed.getDate() : 1
    const day = clampDay(year, month, origDay)
    onChange(toISO(new Date(year, month, day)))
    setViewDate(new Date(year, month, 1))
  }

  function handlePickerMonth(m) {
    setPickerMonth(m)
    applyPickerChange(pickerYear, m)
  }

  function handlePickerYearChange(delta) {
    const y = pickerYear + delta
    setPickerYear(y)
    applyPickerChange(y, pickerMonth)
  }

  function commitPicker() {
    setMode('calendar')
    setViewDate(new Date(pickerYear, pickerMonth, 1))
  }

  function openPicker() {
    const d = parseValue(value) ?? new Date()
    setPickerYear(d.getFullYear())
    setPickerMonth(d.getMonth())
    setMode('picker')
  }

  // ── Trigger display ───────────────────────────────────────────────────────
  const displayValue = value || ''

  return (
    <div ref={wrapRef} className="dp-root" style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger input */}
      <input
        type="text"
        readOnly
        value={displayValue}
        disabled={disabled}
        placeholder="YYYY-MM-DD"
        className={`dp-input ${className ?? ''}`}
        onClick={() => { if (!disabled) { setOpen(o => !o); setMode('calendar') } }}
      />

      {open && (
        <div className="dp-popover">
          {mode === 'calendar' ? (
            <>
              {/* Calendar header */}
              <div className="dp-cal-header">
                <button className="dp-nav-btn" onClick={prevMonth}>‹</button>
                <button className="dp-month-label" onClick={openPicker}>
                  {MONTHS[vm]} {vy}
                </button>
                <button className="dp-nav-btn" onClick={nextMonth}>›</button>
              </div>

              {/* Day-of-week headers */}
              <div className="dp-day-grid">
                {DAYS.map(d => (
                  <div key={d} className="dp-dow">{d}</div>
                ))}
                {cells.map((day, i) => {
                  const isSelected = day === selectedDay
                  const isToday    = day === todayDay
                  let cls = 'dp-day'
                  if (!day) cls += ' dp-day--empty'
                  else if (isSelected) cls += ' dp-day--selected'
                  else if (isToday) cls += ' dp-day--today'
                  return (
                    <div
                      key={i}
                      className={cls}
                      onClick={() => selectDay(day)}
                    >
                      {day ?? ''}
                    </div>
                  )
                })}
              </div>

              {/* Footer */}
              <div className="dp-footer">
                <button className="dp-today-btn" onClick={selectToday}>Today</button>
              </div>
            </>
          ) : (
            <>
              {/* Picker header */}
              <div className="dp-cal-header">
                <button className="dp-back-btn" onClick={commitPicker}>← Back</button>
                <button className="dp-ok-btn" onClick={commitPicker}>OK</button>
              </div>

              {/* Year selector */}
              <div className="dp-year-row">
                <button className="dp-nav-btn" onClick={() => handlePickerYearChange(-1)}>‹</button>
                <span className="dp-year-label">{pickerYear}</span>
                <button className="dp-nav-btn" onClick={() => handlePickerYearChange(1)}>›</button>
              </div>

              {/* Month grid */}
              <div className="dp-month-grid">
                {MONTHS_SHORT.map((mo, idx) => (
                  <div
                    key={mo}
                    className={`dp-mo${idx === pickerMonth ? ' dp-mo--selected' : ''}`}
                    onClick={() => handlePickerMonth(idx)}
                  >
                    {mo}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
