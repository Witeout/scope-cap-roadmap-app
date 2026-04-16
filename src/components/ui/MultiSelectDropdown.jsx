import { useState, useRef, useEffect } from 'react'

/**
 * MultiSelectDropdown — uniform multi-select filter pill with checkbox list.
 *
 * Props:
 *   label    string             — e.g. "Issue Types"
 *   options  [{ key, label, icon?, color? }]
 *   selected Set<string>        — empty Set means "all active"
 *   onChange fn(Set<string>)
 *   width    number             — button width in px (default 152)
 */
export default function MultiSelectDropdown({ label, options, selected, onChange, width = 152 }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const isAllActive = selected.size === 0
  const isOptionActive = key => isAllActive || selected.has(key)

  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggleOption = key => {
    if (isAllActive) {
      // All currently showing — deselecting one means "show all except this"
      const next = new Set(options.map(o => o.key).filter(k => k !== key))
      if (next.size === 0) return // only 1 option, can't deselect
      onChange(next)
    } else if (selected.has(key)) {
      const next = new Set(selected)
      next.delete(key)
      if (next.size === 0) {
        onChange(new Set()) // last one removed → back to "all"
      } else {
        onChange(next)
      }
    } else {
      const next = new Set(selected)
      next.add(key)
      if (next.size === options.length) onChange(new Set()) // all checked → normalize to "all"
      else onChange(next)
    }
  }

  const activeLabelStr = isAllActive
    ? `All ${label}`
    : selected.size === 1
      ? (options.find(o => selected.has(o.key))?.label ?? '1 selected')
      : `${selected.size} ${label}`

  const isFiltered = !isAllActive

  return (
    <div ref={ref} style={{ position: 'relative', width, flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
          padding: '5px 10px', borderRadius: 6,
          border: `1px solid ${isFiltered ? '#4a6fa5' : '#d1cfc4'}`,
          background: isFiltered ? '#4a6fa510' : '#fbf9f4',
          color: isFiltered ? '#4a6fa5' : '#31332c',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeLabelStr}
        </span>
        <span style={{ fontSize: 9, opacity: 0.6, flexShrink: 0 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200,
          background: 'white', border: '1px solid #d1cfc4', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          minWidth: '100%', padding: '5px 0',
        }}>
          {/* All row */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px',
            cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#5e6058',
          }}>
            <input
              type="checkbox"
              checked={isAllActive}
              onChange={() => onChange(new Set())}
              style={{ accentColor: '#4a6fa5' }}
            />
            All {label}
          </label>
          <div style={{ borderTop: '1px solid #efeee6', margin: '3px 0' }} />
          {options.map(o => (
            <label key={o.key} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
              color: isOptionActive(o.key) ? (o.color || '#5e6058') : '#9e9f95',
            }}>
              <input
                type="checkbox"
                checked={isOptionActive(o.key)}
                onChange={() => toggleOption(o.key)}
                style={{ accentColor: o.color || '#5b5f63' }}
              />
              {o.icon && (
                <span className="material-symbols-outlined" style={{ fontSize: 12, color: o.color, lineHeight: 1 }}>
                  {o.icon}
                </span>
              )}
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
