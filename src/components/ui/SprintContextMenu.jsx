import { useRef, useState, useEffect } from 'react'

/**
 * Shared sprint-assignment context menu.
 * Props: taskId, currentSprintId, sprints, onAssign(sprintId), onClose, x, y
 */
export default function SprintContextMenu({ taskId, currentSprintId, sprints, onAssign, onClose, x, y }) {
  const menuRef = useRef(null)
  const [q, setQ] = useState('')

  // Close on outside mousedown
  useEffect(() => {
    function onDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  // Clamp to viewport after mount
  const [pos, setPos] = useState({ left: x, top: y })
  useEffect(() => {
    if (!menuRef.current) return
    const { offsetWidth: mw, offsetHeight: mh } = menuRef.current
    const vw = window.innerWidth, vh = window.innerHeight
    setPos({
      left: x + mw > vw ? vw - mw - 8 : x,
      top:  y + mh > vh ? vh - mh - 8 : y,
    })
  }, [x, y])

  const curSpId = sprints.find(s => {
    const now = new Date()
    return now >= s.start && now <= s.end
  })?.id

  const filtered = q.trim()
    ? sprints.filter(s => s.label.toLowerCase().includes(q.trim().toLowerCase()))
    : sprints

  return (
    <div
      ref={menuRef}
      id="ctx-menu"
      style={{ position: 'fixed', left: pos.left, top: pos.top, zIndex: 9999 }}
    >
      <div className="ctx-header">Assign to Sprint</div>
      <input
        autoFocus
        className="ctx-search"
        placeholder="Search sprints…"
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => e.key === 'Escape' && onClose()}
      />
      <div className="ctx-sprint-list">
        {!q.trim() && (
          <>
            <div
              className={`ctx-item${!currentSprintId ? ' ctx-active' : ''}`}
              onClick={() => onAssign(null)}
            >
              <span className="ctx-sprint-label">Unscheduled</span>
            </div>
            <div className="ctx-divider" />
          </>
        )}
        {filtered.map(sprint => (
          <div
            key={sprint.id}
            className={`ctx-item${currentSprintId === sprint.id ? ' ctx-active' : ''}`}
            onClick={() => onAssign(sprint.id)}
          >
            {sprint.id === curSpId
              ? <span className="ctx-current-dot" />
              : <span style={{ width: 6, flexShrink: 0 }} />
            }
            <span className="ctx-sprint-label">{sprint.label}</span>
            <span className="ctx-sprint-dates">{sprint.dates}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="ctx-item" style={{ color: '#9e9f95', cursor: 'default' }}>No sprints found</div>
        )}
      </div>
    </div>
  )
}
