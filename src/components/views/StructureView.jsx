import { useRef, useState, useMemo, useCallback } from 'react'
import { useDataStore } from '../../store/dataStore'
import { useUIStore } from '../../store/uiStore'
import StructureRow from './StructureRow'
import SprintContextMenu from '../ui/SprintContextMenu'

// ─── Filter helpers ────────────────────────────────────────────────────────────
function matchSearch(item, q) {
  return !q || (item.summary || '').toLowerCase().includes(q)
}

function matchTeamFilter(item, teamGroupFilter) {
  if (!teamGroupFilter) return true
  return item.teamId === teamGroupFilter
}

function shouldShowTask(task, filters, teamGroupFilter) {
  const tf = filters.type
  if (tf === 'initiative' || tf === 'epic') return false
  return matchSearch(task, filters.search.trim().toLowerCase()) && matchTeamFilter(task, teamGroupFilter)
}

function shouldShowEpic(epic, tasks, filters, teamGroupFilter) {
  const tf = filters.type
  const q  = filters.search.trim().toLowerCase()
  if (tf === 'initiative') return false
  if (matchSearch(epic, q) && tf !== 'task' && matchTeamFilter(epic, teamGroupFilter)) return true
  if (tf === 'task' || tf === 'all')
    return tasks.filter(t => t.epicId === epic.id).some(t => shouldShowTask(t, filters, teamGroupFilter))
  return false
}

function shouldShowInitiative(ini, epics, tasks, filters, teamGroupFilter) {
  const tf = filters.type
  const q  = filters.search.trim().toLowerCase()
  if (tf === 'task')
    return epics
      .filter(e => e.initiativeId === ini.id)
      .some(e => tasks.filter(t => t.epicId === e.id).some(t => shouldShowTask(t, filters, teamGroupFilter)))
  if (tf === 'epic')
    return epics.filter(e => e.initiativeId === ini.id).some(e => matchSearch(e, q) && matchTeamFilter(e, teamGroupFilter))
  if (matchSearch(ini, q) && tf !== 'task' && matchTeamFilter(ini, teamGroupFilter)) return true
  return epics
    .filter(e => e.initiativeId === ini.id)
    .some(e => shouldShowEpic(e, tasks, filters, teamGroupFilter))
}

// ─── Delete confirmation modal ─────────────────────────────────────────────────
function DeleteModal({ pending, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-error text-2xl">delete</span>
          <span className="font-bold text-on-background text-base">Delete {pending.type}?</span>
        </div>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          <span className="font-semibold">"{pending.summary}"</span> will be permanently removed.
          {pending.type !== 'task' && ' All child items will be unlinked.'}
        </p>
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-lg text-sm font-bold bg-error text-white hover:bg-error/90 transition-colors"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function StructureView() {
  const { data, sprints, updateItem, removeItem, createItem, reorderItems } = useDataStore()
  const {
    filters, collapsed, allCollapsed,
    panel, openPanel,
    pendingDelete, setPendingDelete, clearPendingDelete,
    contextMenu, openContextMenu, closeContextMenu,
    setAllCollapsed,
    selectedIds, lastSelectedId, toggleSelected, clearSelection, setSelection,
    teamGroupFilter, setTeamGroupFilter,
  } = useUIStore()

  // 3-state collapse check: explicit false overrides allCollapsed; otherwise follow flag or map
  const isItemCollapsed = useCallback(id =>
    collapsed[id] !== false && (allCollapsed || !!collapsed[id]),
  [collapsed, allCollapsed])

  // Drag state stored in a ref to avoid triggering re-renders on every dragover
  const dragRef = useRef(null)
  const [dropState, setDropState] = useState({}) // { [id]: 'above'|'below'|'inside' }

  // ── Sorted collections ─────────────────────────────────────────────────────
  const sorted = useCallback(arr => [...arr].sort((a, b) => a.order - b.order), [])

  const sortedInitiatives = useMemo(() => sorted(data.initiatives), [data.initiatives, sorted])
  const sortedEpics       = useMemo(() => sorted(data.epics),       [data.epics,       sorted])
  const sortedTasks       = useMemo(() => sorted(data.tasks),       [data.tasks,       sorted])

  // ── Build flat row list (for rendering + count) ────────────────────────────
  const rows = useMemo(() => {
    const result = []

    for (const ini of sortedInitiatives) {
      if (!shouldShowInitiative(ini, sortedEpics, sortedTasks, filters, teamGroupFilter)) continue
      result.push({ item: ini, type: 'initiative', indent: 0 })
      if (isItemCollapsed(ini.id)) continue

      for (const epic of sortedEpics.filter(e => e.initiativeId === ini.id)) {
        if (!shouldShowEpic(epic, sortedTasks, filters, teamGroupFilter)) continue
        result.push({ item: epic, type: 'epic', indent: 1 })
        if (isItemCollapsed(epic.id)) continue

        for (const task of sortedTasks.filter(t => t.epicId === epic.id)) {
          if (!shouldShowTask(task, filters, teamGroupFilter)) continue
          result.push({ item: task, type: 'task', indent: 2 })
        }
      }
    }

    // Orphan epics (no parent initiative)
    const orphanEpics = sortedEpics
      .filter(e => !e.initiativeId || !data.initiatives.find(i => i.id === e.initiativeId))
      .filter(e => shouldShowEpic(e, sortedTasks, filters, teamGroupFilter))

    if (orphanEpics.length) {
      result.push({ type: 'sep', label: 'Epics without Initiative' })
      for (const epic of orphanEpics) {
        result.push({ item: epic, type: 'epic', indent: 0 })
        if (!isItemCollapsed(epic.id)) {
          for (const task of sortedTasks.filter(t => t.epicId === epic.id)) {
            if (!shouldShowTask(task, filters, teamGroupFilter)) continue
            result.push({ item: task, type: 'task', indent: 1 })
          }
        }
      }
    }

    // Orphan tasks (no parent epic)
    const orphanTasks = sortedTasks
      .filter(t => !t.epicId || !data.epics.find(e => e.id === t.epicId))
      .filter(t => shouldShowTask(t, filters, teamGroupFilter))

    if (orphanTasks.length) {
      result.push({ type: 'sep', label: 'Tasks without Epic' })
      for (const task of orphanTasks) {
        result.push({ item: task, type: 'task', indent: 0 })
      }
    }

    return result
  }, [sortedInitiatives, sortedEpics, sortedTasks, filters, isItemCollapsed, data.initiatives, data.epics, teamGroupFilter])

  const issueCount = rows.filter(r => r.type !== 'sep').length

  // ── Drag handlers ──────────────────────────────────────────────────────────
  function clearDropState() {
    setDropState({})
  }

  function makeDragHandlers(type, id) {
    return {
      onDragStart(e) {
        dragRef.current = { type, id, overType: null, overId: null, position: null }
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', id)
      },
      onDragOver(e) {
        const ds = dragRef.current
        if (!ds || ds.id === id) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'

        const canInside = (ds.type === 'task' && type === 'epic') ||
                          (ds.type === 'epic' && type === 'initiative')
        const canAlong  = ds.type === type

        if (!canInside && !canAlong) return

        let pos
        if (canInside) {
          pos = 'inside'
        } else {
          const rect = e.currentTarget.getBoundingClientRect()
          pos = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below'
        }

        ds.overType = type
        ds.overId   = id
        ds.position = pos

        setDropState({ [id]: pos })
      },
      onDragLeave(e) {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setDropState(prev => {
            const next = { ...prev }
            delete next[id]
            return next
          })
        }
      },
      onDrop(e) {
        e.preventDefault()
        clearDropState()
        const ds = dragRef.current
        if (!ds || !ds.overId || ds.id === ds.overId) { dragRef.current = null; return }
        const { type: dt, id: di, overType: ot, overId: oi, position: pos } = ds
        dragRef.current = null

        if (pos === 'inside') {
          // Reparent
          reorderItems(dt, di, oi, 'inside')
        } else if (dt === ot) {
          // Same-type reorder
          const storePos = pos === 'above' ? 'before' : 'after'
          reorderItems(dt, di, oi, storePos)
        }
      },
      onDragEnd() {
        clearDropState()
        dragRef.current = null
      },
    }
  }

  // ── New item ───────────────────────────────────────────────────────────────
  function handleNewItem() {
    const item = createItem('task', {
      summary: 'New Task',
      priority: 'Medium',
      assignee: 'Unassigned',
      description: '',
      epicId: null,
      estimate: null,
      sprintId: null,
      discipline: null,
    })
    if (item) {
      openPanel('task', item.id)
    }
  }

  // ── Expand / collapse all ──────────────────────────────────────────────────
  function handleExpandCollapseAll() {
    setAllCollapsed(!allCollapsed)
  }

  // ── Delete confirm ─────────────────────────────────────────────────────────
  function handleDeleteConfirm() {
    if (!pendingDelete) return
    removeItem(pendingDelete.type, pendingDelete.id)
    clearPendingDelete()
    if (panel.id === pendingDelete.id) {
      // close panel if deleting the open item
      useUIStore.getState().closePanel()
    }
  }

  // ── Sprint assign (context menu) — bulk-aware ──────────────────────────────
  function handleSprintAssign(sprintId) {
    if (!contextMenu?.taskId) return
    const ids = selectedIds.size > 1 && selectedIds.has(contextMenu.taskId)
      ? [...selectedIds]
      : [contextMenu.taskId]
    ids.forEach(id => updateItem('task', id, { sprintId }))
    clearSelection()
    closeContextMenu()
  }

  // ── Checkbox multi-select ──────────────────────────────────────────────────
  const taskRows = useMemo(() => rows.filter(r => r.type === 'task'), [rows])

  function handleCheckboxClick(e, id) {
    e.stopPropagation()
    if (e.shiftKey && lastSelectedId) {
      const lastIdx = taskRows.findIndex(r => r.item.id === lastSelectedId)
      const curIdx  = taskRows.findIndex(r => r.item.id === id)
      if (lastIdx >= 0) {
        const [a, b] = [Math.min(lastIdx, curIdx), Math.max(lastIdx, curIdx)]
        setSelection(taskRows.slice(a, b + 1).map(r => r.item.id))
        return
      }
    }
    if (e.ctrlKey || e.metaKey) {
      toggleSelected(id)
    } else {
      if (selectedIds.size === 1 && selectedIds.has(id)) clearSelection()
      else setSelection([id])
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Toolbar with team filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #c5c6bb', background: '#fbf9f4' }}>
        <select
          value={teamGroupFilter ?? ''}
          onChange={e => setTeamGroupFilter(e.target.value || null)}
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: '6px 10px',
            border: '1px solid #d1cfc4',
            borderRadius: 6,
            background: '#fbf9f4',
            cursor: 'pointer',
            color: '#31332c',
          }}
          title="Filter by team"
        >
          <option value="">All Teams</option>
          {(data.teamGroups ?? []).map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      <div
        id="backlog-list"
        className="flex-1 overflow-y-auto"
        onDragOver={e => e.preventDefault()}
        onMouseDown={e => {
          // Clear selection when clicking the list background (not a checkbox or ctx menu)
          if (e.target.type !== 'checkbox') clearSelection()
        }}
      >
        {rows.length === 0 && (
          <div className="text-center py-16 px-6 text-slate-400">
            <span className="material-symbols-outlined text-5xl block mb-3 text-slate-300">inbox</span>
            <p className="font-semibold text-slate-500">No items found</p>
            <p className="text-sm mt-1">Try adjusting your filters or create a new item.</p>
          </div>
        )}

        {rows.map((row, idx) => {
          if (row.type === 'sep') {
            return (
              <div
                key={`sep-${idx}`}
                className="px-4 py-2 text-[11px] font-bold text-on-surface-variant bg-surface-container-low border-b border-outline-variant/20 uppercase tracking-widest"
              >
                {row.label}
              </div>
            )
          }

          const { item, type, indent } = row
          const dragHandlers = makeDragHandlers(type, item.id)
          const isDragging = dragRef.current?.id === item.id

          return (
            <StructureRow
              key={item.id}
              item={item}
              type={type}
              indent={indent}
              sprints={sprints}
              isDragging={isDragging}
              dropPos={dropState[item.id] ?? null}
              onCheckboxClick={handleCheckboxClick}
              {...dragHandlers}
            />
          )
        })}

        {/* Add row */}
        <div
          className="flex items-center gap-2 px-4 py-3 text-slate-400 hover:text-primary transition-colors cursor-pointer bg-surface-container-lowest/80 border-t border-surface-container-low"
          onClick={handleNewItem}
        >
          <span className="material-symbols-outlined text-lg">add</span>
          <span className="text-sm font-medium">Create issue</span>
        </div>
      </div>

      {/* Issue count — updated via DOM id for TopBar compatibility */}
      <span id="backlog-count" className="hidden">{issueCount} issue{issueCount !== 1 ? 's' : ''}</span>

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

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <DeleteModal
          pending={pendingDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={clearPendingDelete}
        />
      )}
    </>
  )
}
