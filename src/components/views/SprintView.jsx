import { useRef, useState, useMemo, useEffect } from 'react'
import { useDataStore } from '../../store/dataStore'
import { useUIStore } from '../../store/uiStore'
import { currentSprintId } from '../../lib/sprints'
import { getBrokenDependencies } from '../../lib/dependencies'
import StructureRow from './StructureRow'
import SprintContextMenu from '../ui/SprintContextMenu'

const DEFAULT_CAPACITY = 80

// ─── Sprint card header ────────────────────────────────────────────────────────
function SprintCardHeader({ sprintId, label, dates, isCurrent, taskCount, totalH, capacity, onCapacityChange, isCollapsed, onToggle, dropPos }) {
  const [showSlider, setShowSlider] = useState(false)
  const sliderRef = useRef(null)
  const pct  = Math.min((totalH / capacity) * 100, 100)
  const over = pct > 90

  // Close slider on outside click
  useEffect(() => {
    if (!showSlider) return
    function onDown(e) {
      if (sliderRef.current && !sliderRef.current.contains(e.target)) setShowSlider(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showSlider])

  let cls = `flex items-center justify-between px-4 py-3 cursor-pointer transition-colors`
  cls += isCurrent
    ? ' bg-primary-container/20 hover:bg-primary-container/30'
    : ' bg-surface-container-lowest hover:bg-surface-container/60'
  if (dropPos === 'inside') cls += ' drop-inside'

  return (
    <div>
      <div className={cls} data-id={sprintId} data-type="sprint">
        <div className="flex items-center gap-2.5">
          <button
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-surface-container text-slate-400 transition-colors"
            onClick={e => { e.stopPropagation(); onToggle() }}
          >
            <span className="material-symbols-outlined text-sm">
              {isCollapsed ? 'keyboard_arrow_right' : 'keyboard_arrow_down'}
            </span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-on-background font-headline">{label}</span>
              {isCurrent && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-primary text-on-primary tracking-wider">
                  CURRENT
                </span>
              )}
              {taskCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                  {taskCount} task{taskCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{dates}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            className="text-xs font-semibold text-slate-500 hover:text-primary transition-colors"
            onClick={e => { e.stopPropagation(); setShowSlider(v => !v) }}
            title="Set sprint capacity"
          >
            {totalH}h / {capacity}h
          </button>
          <div className="w-24 h-1.5 bg-surface-container rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${over ? 'bg-error' : isCurrent ? 'bg-primary' : 'bg-primary-fixed-dim'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {showSlider && (
        <div
          ref={sliderRef}
          className="flex items-center gap-3 px-4 py-2 bg-surface-container-lowest border-t border-outline-variant/20"
          onClick={e => e.stopPropagation()}
        >
          <span className="text-[11px] text-slate-500 flex-shrink-0">Capacity:</span>
          <input
            type="range"
            min="0"
            max="400"
            step="8"
            value={capacity}
            onChange={e => onCapacityChange(Number(e.target.value))}
            className="flex-1 accent-primary"
          />
          <span className="text-xs font-semibold text-on-background w-12 text-right flex-shrink-0">{capacity}h</span>
        </div>
      )}
    </div>
  )
}

// ─── Drop zone (shown when a sprint card is empty) ─────────────────────────────
function EmptyDropZone({ sprintId, onDragOver, onDragLeave, onDrop, isActive }) {
  return (
    <div
      className={`sprint-drop-zone${isActive ? ' drag-active' : ''}`}
      data-sprint-id={sprintId}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      Drop tasks here to assign to this sprint
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function SprintView() {
  const { data, sprints, updateItem, setSprintCapacity } = useDataStore()
  const {
    filters,
    collapsed, toggleCollapsed,
    hidePastSprints,
    openPanel, setPendingDelete,
    contextMenu, openContextMenu, closeContextMenu,
    selectedIds, lastSelectedId, toggleSelected, clearSelection, setSelection,
  } = useUIStore()

  // Drag ref (same pattern as StructureView — no re-renders on dragover)
  const dragRef    = useRef(null)
  const [activeDropZone, setActiveDropZone] = useState(null)   // sprintId of active empty-zone hover
  const [headerDrop,     setHeaderDrop]     = useState(null)   // sprintId of header hover

  const curId = useMemo(() => currentSprintId(sprints), [sprints])
  const q     = filters.search.trim().toLowerCase()
  const taskMatches = t => !q || (t.summary || '').toLowerCase().includes(q)

  // ── Broken dependency detection ────────────────────────────────────────────
  const { violatedIds: depViolatedIds, tooltipMap: depTooltipMap } = useMemo(
    () => getBrokenDependencies(data.dependencies, sprints, data, null),
    [sprints, data]
  )

  const sorted = arr => [...arr].sort((a, b) => a.order - b.order)

  // ── Task drag handlers for rows inside sprint cards ──────────────────────
  function makeTaskDragHandlers(taskId) {
    return {
      onDragStart(e) {
        dragRef.current = { type: 'task', id: taskId }
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', taskId)
      },
      onDragOver(e) {
        // Tasks dragged over other tasks in sprint view do nothing (no reorder here)
        e.preventDefault()
      },
      onDragLeave() {},
      onDrop(e) {
        e.preventDefault()
        // Drop on another task → reassign to same sprint (no-op effectively)
        dragRef.current = null
      },
      onDragEnd() {
        dragRef.current = null
        setActiveDropZone(null)
        setHeaderDrop(null)
      },
    }
  }

  // ── Sprint header / card drag handlers (for reassigning to sprint) ────────
  function makeSprintDropHandlers(sprintId) {
    return {
      onDragOver(e) {
        if (!dragRef.current || dragRef.current.type !== 'task') return
        e.preventDefault()
        setHeaderDrop(sprintId)
      },
      onDragLeave(e) {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setHeaderDrop(prev => (prev === sprintId ? null : prev))
        }
      },
      onDrop(e) {
        e.preventDefault()
        setHeaderDrop(null)
        if (!dragRef.current || dragRef.current.type !== 'task') return
        const draggedId = dragRef.current.id
        dragRef.current = null
        const target = sprintId === '__backlog' ? null : sprintId
        const ids = selectedIds.size > 1 && selectedIds.has(draggedId)
          ? [...selectedIds] : [draggedId]
        ids.forEach(id => updateItem('task', id, { sprintId: target }))
        clearSelection()
      },
    }
  }

  // ── Empty-zone drag handlers ───────────────────────────────────────────────
  function makeEmptyZoneHandlers(sprintId) {
    return {
      onDragOver(e) {
        if (!dragRef.current || dragRef.current.type !== 'task') return
        e.preventDefault()
        setActiveDropZone(sprintId)
      },
      onDragLeave() {
        setActiveDropZone(prev => (prev === sprintId ? null : prev))
      },
      onDrop(e) {
        e.preventDefault()
        setActiveDropZone(null)
        if (!dragRef.current || dragRef.current.type !== 'task') return
        const draggedId = dragRef.current.id
        dragRef.current = null
        const target = sprintId === '__backlog' ? null : sprintId
        const ids = selectedIds.size > 1 && selectedIds.has(draggedId)
          ? [...selectedIds] : [draggedId]
        ids.forEach(id => updateItem('task', id, { sprintId: target }))
        clearSelection()
      },
    }
  }

  // ── Sprint context menu handler — bulk-aware ──────────────────────────────
  function handleSprintAssign(sprintId) {
    if (!contextMenu?.taskId) return
    const ids = selectedIds.size > 1 && selectedIds.has(contextMenu.taskId)
      ? [...selectedIds] : [contextMenu.taskId]
    ids.forEach(id => updateItem('task', id, { sprintId }))
    clearSelection()
    closeContextMenu()
  }

  // ── Checkbox multi-select ──────────────────────────────────────────────────
  function handleCheckboxClick(e, id) {
    e.stopPropagation()
    if (e.shiftKey && lastSelectedId) {
      // Only range-select within the same bucket (same sprintId)
      const curTask  = data.tasks.find(t => t.id === id)
      const lastTask = data.tasks.find(t => t.id === lastSelectedId)
      if (curTask && lastTask && curTask.sprintId === lastTask.sprintId) {
        const bucketTasks = sorted(
          data.tasks.filter(t => t.sprintId === curTask.sprintId && taskMatches(t))
        )
        const lastIdx = bucketTasks.findIndex(t => t.id === lastSelectedId)
        const curIdx  = bucketTasks.findIndex(t => t.id === id)
        if (lastIdx >= 0) {
          const [a, b] = [Math.min(lastIdx, curIdx), Math.max(lastIdx, curIdx)]
          setSelection(bucketTasks.slice(a, b + 1).map(t => t.id))
          return
        }
      }
    }
    if (e.ctrlKey || e.metaKey) {
      toggleSelected(id)
    } else {
      if (selectedIds.size === 1 && selectedIds.has(id)) clearSelection()
      else setSelection([id])
    }
  }

  // ── Build sprint buckets ───────────────────────────────────────────────────
  const unscheduled = sorted(data.tasks.filter(t => !t.sprintId)).filter(taskMatches)

  const sprintBuckets = useMemo(() => {
    return sprints.map(sprint => {
      const tasks    = sorted(data.tasks.filter(t => t.sprintId === sprint.id)).filter(taskMatches)
      const isCurrent = sprint.id === curId
      const isPast    = sprint.end < new Date() && !isCurrent
      return { sprint, tasks, isCurrent, isPast }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.tasks, sprints, curId, q])

  const totalTaskCount = sprintBuckets.reduce((s, b) => s + b.tasks.length, 0)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div id="backlog-list" className="flex-1 overflow-y-auto px-3 py-3 space-y-2">

        {/* Unscheduled bucket */}
        {(() => {
          const sprintId   = '__backlog'
          const isCollapsed = !!collapsed[sprintId]
          const totalH     = unscheduled.reduce((s, t) => s + (t.estimate || 0), 0)
          const headerHandlers = makeSprintDropHandlers(sprintId)

          return (
            <div className="rounded-xl overflow-hidden border border-outline-variant/10 shadow-sm">
              <div
                {...headerHandlers}
                onDragOver={headerHandlers.onDragOver}
              >
                <SprintCardHeader
                  sprintId={sprintId}
                  label="Unscheduled"
                  dates="Not yet assigned to a sprint"
                  isCurrent={false}
                  taskCount={unscheduled.length}
                  totalH={totalH}
                  capacity={data.project?.sprintCapacities?.[sprintId] ?? DEFAULT_CAPACITY}
                  onCapacityChange={h => setSprintCapacity(sprintId, h)}
                  isCollapsed={isCollapsed}
                  onToggle={() => toggleCollapsed(sprintId)}
                  dropPos={headerDrop === sprintId ? 'inside' : null}
                />
              </div>

              {!isCollapsed && (
                unscheduled.length === 0
                  ? <EmptyDropZone
                      sprintId={sprintId}
                      isActive={activeDropZone === sprintId}
                      {...makeEmptyZoneHandlers(sprintId)}
                    />
                  : unscheduled.map(task => (
                      <StructureRow
                        key={task.id}
                        item={task}
                        type="task"
                        indent={0}
                        sprints={sprints}
                        isDragging={dragRef.current?.id === task.id}
                        dropPos={null}
                        onCheckboxClick={handleCheckboxClick}
                        isViolated={depViolatedIds.has(task.id)}
                        violationTooltip={depTooltipMap.get(task.id)}
                        {...makeTaskDragHandlers(task.id)}
                      />
                    ))
              )}
            </div>
          )
        })()}

        {/* Sprint cards */}
        {sprintBuckets.map(({ sprint, tasks, isCurrent, isPast }) => {
          if (isPast && hidePastSprints) return null
          const isCollapsed   = !!collapsed[sprint.id]
          const totalH        = tasks.reduce((s, t) => s + (t.estimate || 0), 0)
          const headerHandlers = makeSprintDropHandlers(sprint.id)

          let cardCls = 'rounded-xl overflow-hidden border shadow-sm'
          if (isCurrent) cardCls += ' border-l-4 border-primary border-y border-r border-outline-variant/20'
          else if (isPast) cardCls += ' border-outline-variant/20 opacity-75'
          else cardCls += ' border-outline-variant/10'

          return (
            <div key={sprint.id} className={cardCls}>
              <div {...headerHandlers}>
                <SprintCardHeader
                  sprintId={sprint.id}
                  label={sprint.label}
                  dates={sprint.dates}
                  isCurrent={isCurrent}
                  taskCount={tasks.length}
                  totalH={totalH}
                  capacity={data.project?.sprintCapacities?.[sprint.id] ?? DEFAULT_CAPACITY}
                  onCapacityChange={h => setSprintCapacity(sprint.id, h)}
                  isCollapsed={isCollapsed}
                  onToggle={() => toggleCollapsed(sprint.id)}
                  dropPos={headerDrop === sprint.id ? 'inside' : null}
                />
              </div>

              {!isCollapsed && (
                tasks.length === 0
                  ? <EmptyDropZone
                      sprintId={sprint.id}
                      isActive={activeDropZone === sprint.id}
                      {...makeEmptyZoneHandlers(sprint.id)}
                    />
                  : tasks.map(task => (
                      <StructureRow
                        key={task.id}
                        item={task}
                        type="task"
                        indent={0}
                        sprints={sprints}
                        isDragging={dragRef.current?.id === task.id}
                        dropPos={null}
                        onCheckboxClick={handleCheckboxClick}
                        isViolated={depViolatedIds.has(task.id)}
                        violationTooltip={depTooltipMap.get(task.id)}
                        {...makeTaskDragHandlers(task.id)}
                      />
                    ))
              )}
            </div>
          )
        })}
      </div>

      {/* Sprint context menu */}
      {contextMenu && (
        <SprintContextMenu
          taskId={contextMenu.taskId}
          currentSprintId={contextMenu.currentSprintId}
          sprints={sprints}
          onAssign={handleSprintAssign}
          onClose={closeContextMenu}
          x={contextMenu.x}
          y={contextMenu.y}
        />
      )}

      {/* Hidden count span for TopBar */}
      <span id="backlog-count" className="hidden">
        {totalTaskCount} task{totalTaskCount !== 1 ? 's' : ''}
      </span>
    </>
  )
}
