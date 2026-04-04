import { useRef, useMemo, useEffect, useCallback, useState } from 'react'
import { useDataStore } from '../../store/dataStore'
import { useUIStore }   from '../../store/uiStore'
import {
  buildGanttRows,
  getItemSprintRange,
  getItemSprintRangeForScenario,
} from '../../lib/gantt'
import { getBrokenDependencies } from '../../lib/dependencies'
import { currentSprintId } from '../../lib/sprints'
import { useGanttDrag }    from '../../hooks/useGanttDrag'
import { useDepDraw }      from '../../hooks/useDepDraw'
import DependencyArrows    from './DependencyArrows'
import { TYPE_ICON, TYPE_COLOR } from '../../lib/display'
import FilterPills from '../ui/FilterPills'

// ─── Layout constants ─────────────────────────────────────────────────────────
const SPRINT_W = 100
const ROW_H    = 52
const MIN_LABEL_W = 140
const MAX_LABEL_W = 520

// ─── Row backgrounds ──────────────────────────────────────────────────────────
const ROW_BG = { initiative: '#e8e7df', epic: '#efeee6', task: 'white' }

// ─── Roadmap toolbar ──────────────────────────────────────────────────────────
function RoadmapToolbar({
  scenarioId, compareMode, roadmapLocked, data,
  onLockToggle, onAddScenario, onCompare, onCommitScenario, onExitScenario, onExitCompare,
  filterPills,
  depIssueCount, showDepIssues, onToggleDepIssues,
}) {
  if (scenarioId) {
    const scn = data.scenarios.find(s => s.id === scenarioId)
    return (
      <div className="roadmap-toolbar">
        <span className="roadmap-toolbar__badge">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>fork_right</span>
          Scenario: {scn?.name ?? 'Unknown'}
        </span>
        {depIssueCount > 0 && (
          <button
            className={`roadmap-btn ${showDepIssues ? 'roadmap-btn--primary' : 'roadmap-btn--secondary'}`}
            style={!showDepIssues ? { color: '#9f403d', borderColor: 'rgba(159,64,61,0.35)' } : {}}
            onClick={onToggleDepIssues}
            title="View dependency issues"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15, fontVariationSettings: "'FILL' 1,'wght' 500,'GRAD' 0,'opsz' 20" }}>warning</span>
            {depIssueCount} Issue{depIssueCount !== 1 ? 's' : ''}
          </button>
        )}
        <button className="roadmap-btn roadmap-btn--primary" onClick={onCommitScenario}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
          Commit Changes
        </button>
        <button className="roadmap-btn roadmap-btn--secondary" onClick={onExitScenario}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
          Back to Main Roadmap
        </button>
      </div>
    )
  }

  if (compareMode) {
    return (
      <div className="roadmap-toolbar">
        <span className="roadmap-toolbar__badge">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>compare_arrows</span>
          Comparing scenarios
        </span>
        <button className="roadmap-btn roadmap-btn--secondary" onClick={onExitCompare}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
          Exit Comparison
        </button>
      </div>
    )
  }

  return (
    <div className="roadmap-toolbar">
      {roadmapLocked && (
        <span className="roadmap-toolbar__badge">
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>info</span>
          Roadmap is locked – drag, drop and dependency editing are disabled
        </span>
      )}
      {/* Filter pills — left-aligned, fills available space */}
      <div style={{ flex: 1 }}>
        {filterPills}
      </div>
      {/* Dependency issues button */}
      {depIssueCount > 0 && (
        <button
          className={`roadmap-btn ${showDepIssues ? 'roadmap-btn--primary' : 'roadmap-btn--secondary'}`}
          style={!showDepIssues ? { color: '#9f403d', borderColor: 'rgba(159,64,61,0.35)' } : {}}
          onClick={onToggleDepIssues}
          title="View dependency issues"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15, fontVariationSettings: "'FILL' 1,'wght' 500,'GRAD' 0,'opsz' 20" }}>warning</span>
          {depIssueCount} Dep Issue{depIssueCount !== 1 ? 's' : ''}
        </button>
      )}
      <button className="roadmap-btn roadmap-btn--secondary" onClick={onAddScenario}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>fork_right</span>
        Add Scenario
      </button>
      <button className="roadmap-btn roadmap-btn--secondary" onClick={onCompare}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>compare_arrows</span>
        Compare Scenarios
      </button>
      <button
        className={`roadmap-btn ${roadmapLocked ? 'roadmap-btn--primary' : 'roadmap-btn--secondary'}`}
        onClick={onLockToggle}
        title={roadmapLocked ? 'Unlock to allow editing' : 'Lock to prevent editing'}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 16, fontVariationSettings: `'FILL' ${roadmapLocked ? 1 : 0},'wght' 500,'GRAD' 0,'opsz' 20` }}
        >
          {roadmapLocked ? 'lock' : 'lock_open'}
        </span>
        {roadmapLocked ? 'Unlock Roadmap' : 'Lock Roadmap'}
      </button>
    </div>
  )
}

// ─── Dependency Issues Panel ──────────────────────────────────────────────────
function DepIssuesPanel({ brokenDeps, onScrollTo, onClose }) {
  if (!brokenDeps || brokenDeps.length === 0) return null
  return (
    <div
      style={{
        position: 'absolute',
        top: 41,
        right: 0,
        width: 340,
        background: 'white',
        borderLeft: '1px solid #c5c6bb',
        borderBottom: '1px solid #c5c6bb',
        boxShadow: '-4px 4px 16px rgba(0,0,0,.10)',
        zIndex: 30,
        maxHeight: 'calc(100% - 41px)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #efeee6', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#9f403d', fontVariationSettings: "'FILL' 1,'wght' 500,'GRAD' 0,'opsz' 20" }}>warning</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#31332c' }}>
            {brokenDeps.length} Dependency Issue{brokenDeps.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: '#9e9f95' }}
          onClick={onClose}
          title="Close"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>

      {/* Issue list */}
      <div style={{ padding: '6px 0' }}>
        {brokenDeps.map(({ dep, predecessorItem, predecessorType, dependentItem, dependentType, reasons }) => (
          <div
            key={dep.id}
            style={{ padding: '8px 14px', borderBottom: '1px solid #f5f4ed', cursor: 'pointer' }}
            onClick={() => onScrollTo(dep.fromId)}
            onMouseEnter={e => e.currentTarget.style.background = '#fafaf6'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {/* Predecessor → Dependent flow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#9e9f95', flexShrink: 0 }}>{predecessorItem.id}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#31332c', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{predecessorItem.summary}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: 8, marginBottom: 5 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#9f403d' }}>arrow_downward</span>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#9e9f95', flexShrink: 0 }}>{dependentItem.id}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#31332c', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{dependentItem.summary}</span>
            </div>
            {/* Reason tags */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {reasons.includes('schedule') && (
                <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(159,64,61,0.10)', color: '#9f403d', borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Schedule conflict
                </span>
              )}
              {reasons.includes('status') && (
                <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(122,88,61,0.10)', color: '#7a583d', borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Predecessor incomplete
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Compare modal ────────────────────────────────────────────────────────────
function CompareModal({ scenarios, onConfirm, onCancel }) {
  const [base,   setBase]   = useState(null)
  const [target, setTarget] = useState(scenarios[0]?.id ?? null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-2xl">compare_arrows</span>
          <span className="font-bold text-on-background text-base">Compare Scenarios</span>
        </div>
        <div className="flex flex-col gap-3">
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Baseline</label>
          <select
            className="text-sm border border-outline-variant/40 rounded-lg px-3 py-2 bg-surface-container-lowest focus:outline-none"
            value={base ?? ''}
            onChange={e => setBase(e.target.value || null)}
          >
            <option value="">Main Roadmap</option>
            {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Compare to</label>
          <select
            className="text-sm border border-outline-variant/40 rounded-lg px-3 py-2 bg-surface-container-lowest focus:outline-none"
            value={target ?? ''}
            onChange={e => setTarget(e.target.value || null)}
          >
            {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-40"
            disabled={!target}
            onClick={() => target && onConfirm(base, target)}
          >
            Compare
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function RoadmapView() {
  const {
    data, sprints,
    updateItem, createItem,
    commitScenario, createScenario, deleteScenario,
    addDependency, removeDependency,
  } = useDataStore()

  const {
    scenarioId, setScenarioId, clearScenario,
    compareMode, compareBase, compareTarget,
    openCompare, closeCompare,
    roadmapLocked, toggleRoadmapLocked,
    selectedDepId, setSelectedDepId, clearSelectedDep,
    ganttLabelW, setGanttLabelW,
    openPanel, panel,
  } = useUIStore()

  const [showCompareModal, setShowCompareModal] = useState(false)
  const [capacityTip,     setCapacityTip]     = useState(null) // { sprintId, x, y }
  const [showDepIssues,   setShowDepIssues]   = useState(false)

  // ── View filters ───────────────────────────────────────────────────────────
  const ALL_TYPES = new Set(['initiative', 'epic', 'task'])
  const [activeFilters, setActiveFilters] = useState(new Set(ALL_TYPES))

  // ── Layout ─────────────────────────────────────────────────────────────────
  const LABEL_W = ganttLabelW
  const totalW  = LABEL_W + sprints.length * SPRINT_W
  const curSpId = useMemo(() => currentSprintId(sprints), [sprints])

  // ── Scenario / active data ─────────────────────────────────────────────────
  const activeScenario = scenarioId
    ? data.scenarios.find(s => s.id === scenarioId) ?? null
    : null

  const locked = roadmapLocked && !scenarioId

  // ── Build rows ─────────────────────────────────────────────────────────────
  const rows = useMemo(
    () => buildGanttRows(data, activeScenario),
    [data, activeScenario]
  )

  // ── Filter rows by active type filters ─────────────────────────────────────
  const filteredRows = useMemo(
    () => rows.filter(r => activeFilters.has(r.type)),
    [rows, activeFilters]
  )

  // ── Compute sprint ranges for every row item ───────────────────────────────
  const ranges = useMemo(() => {
    const map = new Map()
    for (const { item, type } of rows) {
      map.set(item.id, getItemSprintRange(item.id, type, sprints, data, activeScenario))
    }
    return map
  }, [rows, sprints, data, activeScenario])

  // Compare-mode base ranges
  const baseRanges = useMemo(() => {
    if (!compareMode) return new Map()
    const map = new Map()
    for (const { item, type } of rows) {
      map.set(item.id, getItemSprintRangeForScenario(item.id, type, compareBase, sprints, data))
    }
    return map
  }, [compareMode, compareBase, rows, sprints, data])

  // ── Active dependencies ────────────────────────────────────────────────────
  const activeDeps = useMemo(() => {
    if (scenarioId && activeScenario) return activeScenario.dependencies ?? data.dependencies
    return data.dependencies
  }, [scenarioId, activeScenario, data.dependencies])

  // ── Broken dependency detection ────────────────────────────────────────────
  const { brokenDeps, violatedIds, violatedDepIds, tooltipMap } = useMemo(() => {
    if (compareMode) return { brokenDeps: [], violatedIds: new Set(), violatedDepIds: new Set(), tooltipMap: new Map() }
    return getBrokenDependencies(activeDeps, sprints, data, activeScenario)
  }, [compareMode, activeDeps, sprints, data, activeScenario])

  // ── Bar registry ref (for dep draw hit testing) ───────────────────────────
  const barRegistryRef = useRef([])

  // Clear registry on each render cycle — bars re-register via ref callbacks
  barRegistryRef.current = []

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const { attachBarDrag }  = useGanttDrag()
  const { startDepDraw }   = useDepDraw(barRegistryRef)

  // ── Scroll preservation ────────────────────────────────────────────────────
  const scrollRef = useRef({ left: 0, top: 0 })
  const wrapperRef = useRef(null)

  const onWrapperRef = useCallback(el => {
    wrapperRef.current = el
    if (el) {
      el.scrollLeft = scrollRef.current.left
      el.scrollTop  = scrollRef.current.top
    }
  }, [])

  const saveScroll = useCallback(() => {
    const el = wrapperRef.current
    if (el) scrollRef.current = { left: el.scrollLeft, top: el.scrollTop }
  }, [])

  // ── Label column resize ────────────────────────────────────────────────────
  const onColResizeMouseDown = useCallback(e => {
    e.preventDefault()
    const startX = e.clientX
    const startW = ganttLabelW

    document.body.style.cursor     = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = mv => {
      const newW = Math.min(MAX_LABEL_W, Math.max(MIN_LABEL_W, startW + (mv.clientX - startX)))
      setGanttLabelW(newW)
    }
    const onUp = () => {
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
  }, [ganttLabelW, setGanttLabelW])

  // ── Keyboard: Delete selected dep, Escape to deselect ─────────────────────
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape' && selectedDepId) {
        clearSelectedDep()
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDepId && !locked) {
        removeDependency(selectedDepId, scenarioId || null)
        clearSelectedDep()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selectedDepId, locked, scenarioId, removeDependency, clearSelectedDep])

  // ── Click outside dep to deselect ─────────────────────────────────────────
  useEffect(() => {
    const onDown = e => {
      if (!selectedDepId) return
      if (!e.target?.dataset?.depHit) clearSelectedDep()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [selectedDepId, clearSelectedDep])

  // ── Dep issues scroll-to ───────────────────────────────────────────────────
  const scrollToItem = useCallback(itemId => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const el = wrapper.querySelector(`[data-item-id="${itemId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.animate(
        [{ background: 'rgba(159,64,61,0.15)' }, { background: 'transparent' }],
        { duration: 1400, easing: 'ease-out' }
      )
    }
  }, [])

  // ── Toolbar actions ────────────────────────────────────────────────────────
  const handleAddScenario = () => {
    const name = window.prompt('Scenario name:', 'New Scenario')
    if (!name?.trim()) return
    const id = createScenario(name.trim())
    setScenarioId(id)
  }

  const handleCommitScenario = () => {
    if (!scenarioId) return
    const scn = data.scenarios.find(s => s.id === scenarioId)
    if (!window.confirm(`Commit scenario "${scn?.name}" to the main roadmap?\n\nThis will apply all sprint changes, add new tasks to the backlog, and delete this scenario.`)) return
    commitScenario(scenarioId)
    clearScenario()
  }

  const handleExitScenario = () => clearScenario()

  const handleExitCompare = () => closeCompare()

  const handleCompareConfirm = (base, target) => {
    setShowCompareModal(false)
    openCompare(base, target)
  }

  // ── Add task in cell ───────────────────────────────────────────────────────
  const handleAddTaskInCell = (epicId, sprintId) => {
    if (activeScenario) {
      // Create scenario-private task
      const scn = data.scenarios.find(s => s.id === scenarioId)
      if (!scn) return
      const maxOrder = scn.tasks.length ? Math.max(...scn.tasks.map(t => t.order)) + 1 : 0
      const newTask = {
        id: `TASK-scn-${Date.now()}`,
        order: maxOrder,
        summary: 'New Task', priority: 'Medium', assignee: 'Unassigned',
        estimate: null, discipline: null, description: '',
        epicId, sprintId,
      }
      scn.tasks.push(newTask)
      // Trigger a store save via a dummy update
      updateItem('task', data.tasks[0]?.id, {}, scenarioId)
      openPanel('task', newTask.id)
    } else {
      const item = createItem('task', {
        summary: 'New Task', priority: 'Medium', assignee: 'Unassigned',
        estimate: null, discipline: null, description: '', epicId, sprintId,
      })
      if (item) openPanel('task', item.id)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const totalH = ROW_H + filteredRows.length * ROW_H

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative' }}
      onClick={() => { if (selectedDepId) clearSelectedDep() }}
    >
      {/* Toolbar */}
      <RoadmapToolbar
        scenarioId={scenarioId}
        compareMode={compareMode}
        roadmapLocked={roadmapLocked}
        data={data}
        onLockToggle={toggleRoadmapLocked}
        onAddScenario={handleAddScenario}
        onCompare={() => {
          if (!data.scenarios.length) { alert('Create at least one scenario to compare.'); return }
          setShowCompareModal(true)
        }}
        onCommitScenario={handleCommitScenario}
        onExitScenario={handleExitScenario}
        onExitCompare={handleExitCompare}
        filterPills={
          <FilterPills
            active={activeFilters}
            onChange={setActiveFilters}
          />
        }
        depIssueCount={brokenDeps.length}
        showDepIssues={showDepIssues}
        onToggleDepIssues={() => setShowDepIssues(v => !v)}
      />

      {/* Dependency issues side panel */}
      {showDepIssues && (
        <DepIssuesPanel
          brokenDeps={brokenDeps}
          onScrollTo={id => scrollToItem(id)}
          onClose={() => setShowDepIssues(false)}
        />
      )}

      {/* Scrollable grid wrapper */}
      <div
        ref={onWrapperRef}
        id="roadmap-scroll-wrapper"
        style={{ flex: 1, overflow: 'auto', position: 'relative' }}
        onScroll={saveScroll}
      >
        {/* CSS grid */}
        <div
          className="gantt-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: `${LABEL_W}px repeat(${sprints.length}, ${SPRINT_W}px)`,
            width: totalW,
            minHeight: totalH,
            position: 'relative',
          }}
        >
          {/* ── Header row ── */}
          {/* Corner cell */}
          <div
            className="gantt-header-corner"
            style={{ height: ROW_H, display: 'flex', alignItems: 'center', padding: '0 12px', background: '#fbf9f4', position: 'sticky', top: 0, zIndex: 20 }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: '#5e6058', textTransform: 'uppercase', letterSpacing: '.06em' }}>Item</span>
            {/* Column resize handle */}
            <div
              style={{ position: 'absolute', top: 0, right: 0, width: 5, height: '100%', cursor: 'col-resize', zIndex: 25 }}
              onMouseDown={onColResizeMouseDown}
            />
          </div>

          {/* Sprint header cells */}
          {sprints.map(sp => {
            const isCur = sp.id === curSpId
            const sprintMilestones = (data.project?.milestones ?? []).filter(ms => {
              if (!ms.date) return false
              const d = new Date(ms.date); d.setHours(12, 0, 0, 0)
              return d >= sp.start && d <= sp.end
            })
            return (
              <div
                key={sp.id}
                className={`gantt-sprint-header${isCur ? ' current-sprint' : ''}`}
                style={{
                  height: ROW_H,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  padding: '2px 4px', position: 'sticky', top: 0, zIndex: 20,
                  overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setCapacityTip({ sprintId: sp.id, x: rect.left + rect.width / 2, y: rect.bottom + 4 })
                }}
                onMouseLeave={() => setCapacityTip(null)}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: isCur ? '#5b5f63' : '#5e6058', whiteSpace: 'nowrap' }}>
                  {sp.label}
                </span>
                <span style={{ fontSize: 9, color: '#9e9f95', whiteSpace: 'nowrap' }}>{sp.dates}</span>
                {isCur && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5b5f63', marginTop: 2, display: 'block' }} />}
                {sprintMilestones.map(ms => (
                  <span
                    key={ms.id}
                    style={{ fontSize: 8, fontWeight: 700, background: '#7a583d', color: 'white', borderRadius: 3, padding: '1px 4px', whiteSpace: 'nowrap', maxWidth: 88, overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}
                    title={`${ms.name}: ${ms.date}`}
                  >
                    {ms.name}
                  </span>
                ))}
              </div>
            )
          })}

          {/* ── Data rows ── */}
          {filteredRows.map((rowDef, rowIdx) => {
            const { item, type, indent } = rowDef
            const range     = ranges.get(item.id)
            const baseRange = baseRanges.get(item.id)
            const isSelected = panel.open && panel.id === item.id

            return (
              <GanttRow
                key={item.id}
                item={item}
                type={type}
                indent={indent}
                range={range}
                baseRange={baseRange}
                sprints={sprints}
                curSpId={curSpId}
                isSelected={isSelected}
                violatedIds={violatedIds}
                tooltipMap={tooltipMap}
                locked={locked}
                compareMode={compareMode}
                scenarioId={scenarioId}
                SPRINT_W={SPRINT_W}
                ROW_H={ROW_H}
                LABEL_W={LABEL_W}
                barRegistryRef={barRegistryRef}
                attachBarDrag={attachBarDrag}
                startDepDraw={startDepDraw}
                onOpenPanel={() => openPanel(type, item.id)}
                onAddTask={handleAddTaskInCell}
              />
            )
          })}
        </div>

        {/* SVG dependency arrows overlay */}
        <DependencyArrows
          deps={activeDeps}
          rows={filteredRows}
          ranges={ranges}
          violatedDepIds={violatedDepIds}
          selectedDepId={selectedDepId}
          onSelectDep={id => setSelectedDepId(selectedDepId === id ? null : id)}
          locked={locked && !scenarioId}
          SPRINT_W={SPRINT_W}
          LABEL_W={LABEL_W}
          ROW_H={ROW_H}
          sprintCount={sprints.length}
        />
      </div>

      {/* Lock wash overlay */}
      {locked && (
        <div style={{ position: 'absolute', top: 41, left: 0, right: 0, bottom: 0, background: 'rgba(251,249,244,0.45)', pointerEvents: 'none', zIndex: 50 }} />
      )}

      {/* Compare modal */}
      {showCompareModal && (
        <CompareModal
          scenarios={data.scenarios}
          onConfirm={handleCompareConfirm}
          onCancel={() => setShowCompareModal(false)}
        />
      )}

      {/* Sprint capacity tooltip */}
      {(() => {
        if (!capacityTip) return null
        const tipSprint = sprints.find(s => s.id === capacityTip.sprintId)
        if (!tipSprint) return null
        const sprintTasks = data.tasks.filter(t => t.sprintId === capacityTip.sprintId)
        const tipCapacity = data.project?.sprintCapacities?.[capacityTip.sprintId] ?? 80
        const tipBuffer   = data.project?.bufferPercent ?? 0

        // Group by discipline
        const byDiscipline = {}
        for (const t of sprintTasks) {
          const d = t.discipline || 'Unassigned'
          byDiscipline[d] = (byDiscipline[d] || 0) + (t.estimate || 0)
        }
        const disciplines = Object.entries(byDiscipline).sort((a, b) => b[1] - a[1])
        const tipTotal = disciplines.reduce((s, [, h]) => s + h, 0)
        const tipOver  = tipTotal > tipCapacity

        return (
          <div style={{ position: 'fixed', left: capacityTip.x, top: capacityTip.y, transform: 'translateX(-50%)', zIndex: 9999, background: 'white', border: '1px solid #c5c6bb', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,.12)', padding: '10px 14px', minWidth: 180, pointerEvents: 'none' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#5e6058', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{tipSprint.label}</div>

            {disciplines.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9e9f95' }}>No tasks assigned</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {disciplines.map(([disc, hours]) => {
                  const pct = tipCapacity > 0 ? Math.min(100, Math.round((hours / tipCapacity) * 100)) : 0
                  return (
                    <div key={disc}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: '#31332c', marginBottom: 2 }}>
                        <span>{disc}</span>
                        <span style={{ color: '#5e6058' }}>{hours}h</span>
                      </div>
                      <div style={{ height: 3, borderRadius: 2, background: '#efeee6', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: '#5b5f63' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ borderTop: '1px solid #efeee6', marginTop: 8, paddingTop: 7, display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: tipOver ? '#9f403d' : '#31332c' }}>
              <span>Total</span>
              <span>{tipTotal}h / {tipCapacity}h</span>
            </div>
            {tipBuffer > 0 && (
              <div style={{ fontSize: 10, color: '#9e9f95', marginTop: 3 }}>{tipBuffer}% buffer reserved</div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// ─── GanttRow ─────────────────────────────────────────────────────────────────
// Renders the label cell + all sprint cells for one row.
function GanttRow({
  item, type, indent, range, baseRange, sprints, curSpId,
  isSelected, violatedIds, tooltipMap, locked, compareMode, scenarioId,
  SPRINT_W, ROW_H, LABEL_W,
  barRegistryRef, attachBarDrag, startDepDraw,
  onOpenPanel, onAddTask,
}) {
  const rowBg = isSelected ? 'rgba(91,95,99,0.08)' : ROW_BG[type]

  return (
    <>
      {/* Label cell */}
      <div
        className="gantt-row-label"
        data-item-id={item.id}
        style={{
          height: ROW_H,
          display: 'flex', alignItems: 'center',
          paddingLeft: 10 + indent * 18, paddingRight: 8,
          background: rowBg,
          cursor: locked ? 'default' : 'pointer',
          gap: 6,
          position: 'sticky', left: 0, zIndex: 10,
        }}
        onClick={locked ? undefined : onOpenPanel}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: TYPE_COLOR[type], flexShrink: 0 }}>
          {TYPE_ICON[type]}
        </span>
        <span style={{ fontSize: 12, fontWeight: type === 'task' ? 500 : 700, color: '#31332c', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {item.summary}
        </span>
        {violatedIds?.has(item.id) && (
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 14,
              color: '#b53832',
              flexShrink: 0,
              fontVariationSettings: "'FILL' 1,'wght' 500,'GRAD' 0,'opsz' 20",
              cursor: 'help',
            }}
            title={tooltipMap?.get(item.id) ?? 'Dependency issue'}
          >
            warning
          </span>
        )}
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#9e9f95', flexShrink: 0 }}>
          {item.id}
        </span>
      </div>

      {/* Sprint cells */}
      {sprints.map((sp, si) => {
        const isCurCol = sp.id === curSpId

        // Infer epicId for "add task" affordance
        const getEpicId = () => {
          if (type === 'epic')        return item.id
          if (type === 'task')        return item.epicId ?? null
          if (type === 'initiative') {
            // Not ideal — component would need data for this; pass null
            return null
          }
          return null
        }

        return (
          <div
            key={sp.id}
            className={`gantt-cell${isCurCol ? ' current-sprint-col' : ''}`}
            style={{ height: ROW_H, position: 'relative' }}
          >
            {/* Compare-mode ghost bar */}
            {compareMode && baseRange && si === baseRange.startIndex && (() => {
              const sameAsActive = range &&
                baseRange.startIndex === range.startIndex &&
                baseRange.endIndex   === range.endIndex
              if (sameAsActive) return null
              const ghostSpan = baseRange.endIndex - baseRange.startIndex + 1
              return (
                <div
                  className={`gantt-bar gantt-bar--${type}`}
                  style={{ left: 10, width: ghostSpan * SPRINT_W - 20, opacity: 0.35, cursor: 'default', pointerEvents: 'none', filter: 'blur(0.6px)', zIndex: 2 }}
                >
                  {item.summary}
                </div>
              )
            })()}

            {/* Active bar — rendered at startIndex cell */}
            {range && si === range.startIndex && (() => {
              const span    = range.endIndex - range.startIndex + 1
              const barW    = span * SPRINT_W - 20
              const isViol  = violatedIds.has(item.id)

              const barStyle = {
                left: 10,
                width: barW,
                ...(locked || compareMode ? { cursor: 'default' } : {}),
                ...(locked ? { opacity: 0.75 } : {}),
                ...(isViol ? { outline: '2px solid rgba(175,50,45,0.55)', outlineOffset: 1 } : {}),
              }

              return (
                <div
                  className={`gantt-bar gantt-bar--${type}`}
                  style={barStyle}
                  ref={el => {
                    if (!el || locked || compareMode) return
                    // Register for dep-draw hit testing
                    barRegistryRef.current.push({ id: item.id, el })
                    // Attach drag behaviour
                    attachBarDrag(el, item, type, range, sprints, LABEL_W, ROW_H)
                  }}
                  title={`${item.id}: ${item.summary}`}
                >
                  {item.summary}
                  {isViol && (
                    <span style={{
                      position: 'absolute', top: 1, right: 2, fontSize: 8, fontWeight: 900,
                      color: '#fff', background: 'rgba(175,50,45,0.92)',
                      width: 12, height: 12, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      pointerEvents: 'none', zIndex: 3, lineHeight: 1,
                    }}>!</span>
                  )}
                  {/* Dependency draw handles */}
                  {!locked && !compareMode && (
                    <>
                      <div
                        className="gantt-dep-handle"
                        title="← Blocked By: drag to the task that must finish first (this task depends on it)"
                        style={{ left: 10 }}
                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); startDepDraw(item.id, e.currentTarget, 'left') }}
                      />
                      <div
                        className="gantt-dep-handle"
                        title="Blocks →: drag to the task that depends on this one finishing first"
                        style={{ left: 10 + barW }}
                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); startDepDraw(item.id, e.currentTarget, 'right') }}
                      />
                    </>
                  )}
                </div>
              )
            })()}

            {/* Unscheduled bar — rendered in first cell only */}
            {!range && !baseRange && si === 0 && (
              <div
                className="gantt-bar gantt-bar--unscheduled"
                style={{ left: 10, width: sprints.length * SPRINT_W - 20 }}
              >
                Unscheduled
              </div>
            )}

            {/* Add-task affordance (hover) */}
            {!locked && !compareMode && (
              <div
                className="gantt-add-btn"
                title={`Add task in ${sp.label}`}
                onClick={e => { e.stopPropagation(); onAddTask(getEpicId(), sp.id) }}
              >
                +
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
