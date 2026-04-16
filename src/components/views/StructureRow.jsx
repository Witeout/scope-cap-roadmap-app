import { useUIStore } from '../../store/uiStore'
import {
  TYPE_ICON, TYPE_COLOR, priClasses,
  initials, avatarBg, avatarColor,
} from '../../lib/display'

/**
 * A single row in the StructureView.
 *
 * Props:
 *  item        — initiative / epic / task object
 *  type        — 'initiative' | 'epic' | 'task'
 *  indent      — 0 | 1 | 2
 *  sprints     — full sprint array (from dataStore)
 *  isDragging  — bool: this item is being dragged
 *  dropPos     — null | 'above' | 'below' | 'inside'  (drop indicator)
 *  onDragStart — (e) => void
 *  onDragOver  — (e) => void
 *  onDragLeave — (e) => void
 *  onDrop      — (e) => void
 *  onDragEnd   — (e) => void
 */
export default function StructureRow({
  item,
  type,
  indent,
  sprints,
  isDragging,
  dropPos,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onCheckboxClick,
  isViolated,
  violationTooltip,
}) {
  const { panel, collapsed, allCollapsed, toggleCollapsed, openPanel, setPendingDelete, openContextMenu, selectedIds } =
    useUIStore()

  const isSelected    = panel.open && panel.id === item.id
  const isChecked     = type === 'task' && selectedIds.has(item.id)
  const isCollapsed   = collapsed[item.id] !== false && (allCollapsed || !!collapsed[item.id])
  const hasChildren   = type !== 'task'

  // ── Row class ──────────────────────────────────────────────────────────────
  let rowCls =
    'group flex items-center gap-2.5 px-4 py-2.5 border-b border-surface-container-low transition-colors cursor-pointer relative select-none'
  if (type === 'initiative') rowCls += ' bg-surface-container/50'
  else rowCls += ' bg-surface-container-lowest'
  if (isChecked)    rowCls += ' !bg-primary-container/10 ring-1 ring-inset ring-primary/20'
  else if (isSelected)   rowCls += ' !bg-primary-container/20 ring-1 ring-inset ring-primary/20'
  else if (type === 'initiative') rowCls += ' hover:bg-surface-container'
  else rowCls += ' hover:bg-surface-container/60'
  if (isDragging) rowCls += ' opacity-40'

  // Drop indicator classes
  if (dropPos === 'above')  rowCls += ' drop-above'
  if (dropPos === 'below')  rowCls += ' drop-below'
  if (dropPos === 'inside') rowCls += ' drop-inside'

  // ── Sprint badge (tasks in structure view only) ────────────────────────────
  const sprint = type === 'task' && item.sprintId
    ? sprints.find(s => s.id === item.sprintId)
    : null

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleClick() {
    openPanel(type, item.id)
  }

  function handleCollapseClick(e) {
    e.stopPropagation()
    toggleCollapsed(item.id)
  }

  function handleDeleteClick(e) {
    e.stopPropagation()
    setPendingDelete({ type, id: item.id, summary: item.summary })
  }

  function handleContextMenu(e) {
    if (type !== 'task') return
    e.preventDefault()
    openContextMenu(e.clientX, e.clientY, { taskId: item.id, currentSprintId: item.sprintId })
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const avBg    = avatarBg(item.assignee)
  const avTxt   = initials(item.assignee)
  const avColor = avatarColor(item.assignee)
  const priCls  = priClasses(item.priority)

  return (
    <div
      className={rowCls}
      data-id={item.id}
      data-type={type}
      draggable
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* Drag handle */}
      <span className="material-symbols-outlined text-base text-slate-300 opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0 transition-opacity">
        drag_indicator
      </span>

      {/* Checkbox (tasks only) */}
      {type === 'task' && (
        <input
          type="checkbox"
          checked={isChecked}
          className="flex-shrink-0 w-4 h-4 accent-primary cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
          style={isChecked ? { opacity: 1 } : undefined}
          onClick={e => {
            e.stopPropagation()
            onCheckboxClick?.(e, item.id)
          }}
          onChange={() => {}}
        />
      )}

      {/* Left section: collapse + icon + id + summary */}
      <div
        className="flex items-center gap-2 flex-1 min-w-0"
        style={indent > 0 ? { paddingLeft: `${indent * 24}px` } : undefined}
      >
        {hasChildren ? (
          <button
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-surface-container text-slate-400 transition-colors"
            onClick={handleCollapseClick}
          >
            <span className="material-symbols-outlined text-sm">
              {isCollapsed ? 'keyboard_arrow_right' : 'keyboard_arrow_down'}
            </span>
          </button>
        ) : (
          <span className="flex-shrink-0 w-5" />
        )}

        {type === 'initiative' && (
          <div className="w-1.5 h-5 rounded-full bg-tertiary-fixed flex-shrink-0" />
        )}

        <span
          className="material-symbols-outlined text-lg flex-shrink-0"
          style={{ color: TYPE_COLOR[type] }}
        >
          {TYPE_ICON[type]}
        </span>

        {type === 'task' && (
          <span className="font-mono text-[10px] text-slate-400 flex-shrink-0 font-semibold">
            {item.id}
          </span>
        )}

        <span className={`text-sm flex-1 truncate text-on-background ${type === 'task' ? 'font-normal' : 'font-bold'}`}>
          {item.summary}
        </span>
      </div>

      {/* Right section: badges + avatar + delete */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {type === 'task' && item.discipline && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-secondary-container/50 text-secondary flex-shrink-0">
            {item.discipline}
          </span>
        )}

        {sprint && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex-shrink-0">
            {sprint.label}
          </span>
        )}

        {type === 'initiative' && (
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container tracking-wider flex-shrink-0">
            INITIATIVE
          </span>
        )}

        {type === 'epic' && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container flex-shrink-0">
            {item.id}
          </span>
        )}

        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex-shrink-0 ${priCls}`}>
          {item.priority || '—'}
        </span>

        {isViolated && (
          <span
            className="material-symbols-outlined flex-shrink-0"
            style={{
              fontSize: 15,
              color: '#b53832',
              fontVariationSettings: "'FILL' 1,'wght' 500,'GRAD' 0,'opsz' 20",
              cursor: 'help',
            }}
            title={violationTooltip ?? 'Dependency issue'}
          >
            warning
          </span>
        )}

        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
          style={{ background: avBg, color: avColor }}
          title={item.assignee || 'Unassigned'}
        >
          {avTxt}
        </div>

        {type === 'task' && item.estimate && (
          <span className="text-[11px] font-bold text-slate-400 w-7 text-center flex-shrink-0">
            {item.estimate}h
          </span>
        )}

        <button
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-slate-300 hover:text-error hover:bg-error/10 transition-all"
          onClick={handleDeleteClick}
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </div>
  )
}
