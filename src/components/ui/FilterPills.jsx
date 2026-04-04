/**
 * FilterPills — toggle chip row for filtering Roadmap rows by item type.
 *
 * Props:
 *   active   {Set<string>}   — currently active type keys
 *   onChange {fn(Set)}       — called with new Set on every toggle or reset
 */

const FILTER_DEFS = [
  { key: 'initiative', label: 'Initiative', icon: 'bolt',        color: '#7a583d' },
  { key: 'epic',       label: 'Epic',       icon: 'view_quilt',  color: '#57634c' },
  { key: 'task',       label: 'Task',       icon: 'task_alt',    color: '#5b5f63' },
]

const ALL_KEYS = FILTER_DEFS.map(f => f.key)

export default function FilterPills({ active, onChange }) {
  const allActive = ALL_KEYS.every(k => active.has(k))

  const toggle = key => {
    const next = new Set(active)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    // Prevent deselecting everything
    if (next.size === 0) return
    onChange(next)
  }

  const reset = () => onChange(new Set(ALL_KEYS))

  const baseStyle = {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', borderRadius: 6, border: '1px solid',
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
    transition: 'all .12s', whiteSpace: 'nowrap',
  }

  const activeChipStyle = color => ({
    ...baseStyle,
    background: color,
    color: 'white',
    borderColor: color,
  })

  const inactiveChipStyle = {
    ...baseStyle,
    background: 'white',
    color: '#9e9f95',
    borderColor: '#d9dace',
  }

  const allActiveStyle = {
    ...baseStyle,
    background: allActive ? '#5b5f63' : 'white',
    color: allActive ? 'white' : '#9e9f95',
    borderColor: allActive ? '#5b5f63' : '#d9dace',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#9e9f95', textTransform: 'uppercase', letterSpacing: '.06em', marginRight: 2 }}>
        Show
      </span>
      <button style={allActiveStyle} onClick={reset} title="Show all item types">
        All
      </button>
      {FILTER_DEFS.map(({ key, label, icon, color }) => {
        const isActive = active.has(key)
        return (
          <button
            key={key}
            style={isActive ? activeChipStyle(color) : inactiveChipStyle}
            onClick={() => toggle(key)}
            title={isActive ? `Hide ${label}s` : `Show ${label}s`}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 12 }}
            >
              {icon}
            </span>
            {label}
          </button>
        )
      })}
    </div>
  )
}
