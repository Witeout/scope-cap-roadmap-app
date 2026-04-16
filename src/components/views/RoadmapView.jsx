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
import { getHolidaysForRegions } from '../../data/holidayDb'
import MultiSelectDropdown from '../ui/MultiSelectDropdown'
import { getCapacityInfo } from '../../lib/capacity'

// ─── Layout constants ─────────────────────────────────────────────────────────
const BASE_SPRINT_W = 125
const ROW_H         = 52   // sprint header row height (fixed)
const MIN_LABEL_W   = 140
const MAX_LABEL_W   = 520

// ─── Row heights by hierarchy ─────────────────────────────────────────────────
// Tallest → shortest: release header → initiative → epic → task
const ROW_HEIGHTS = { releaseHeader: 42, initiative: 35, epic: 29, task: 30 }

// ─── Row backgrounds ──────────────────────────────────────────────────────────
const ROW_BG = { initiative: '#e8e7df', epic: '#efeee6', task: 'white' }

// ─── Release band helper ──────────────────────────────────────────────────────
function getReleaseBandSpan(release, sprints) {
  if (!release.startDate) return null
  const rStart = new Date(release.startDate); rStart.setHours(0, 0, 0, 0)
  const rEnd   = release.endDate ? new Date(release.endDate) : null
  if (rEnd) rEnd.setHours(23, 59, 59, 999)

  const startIdx = sprints.findIndex(s => s.end >= rStart)
  if (startIdx < 0) return null
  const endIdx = rEnd
    ? sprints.reduce((best, s, i) => (s.start <= rEnd ? i : best), -1)
    : sprints.length - 1
  if (endIdx < startIdx) return null
  return { startIdx, endIdx }
}

// ─── Release header row ───────────────────────────────────────────────────────
function ReleaseHeaderRow({ release, sprints, SPRINT_W, ROW_H, LABEL_W, collapsed, onToggle }) {
  const color = release.color || '#9e9f95'
  const bandSpan = getReleaseBandSpan(release, sprints)

  return (
    <>
      {/* Label cell */}
      <div
        style={{
          height: ROW_H,
          display: 'flex', alignItems: 'center', gap: 6,
          paddingLeft: 8, paddingRight: 8,
          background: release.id ? color + '18' : '#f5f4ef',
          borderBottom: `2px solid ${color}50`,
          position: 'sticky', left: 0, zIndex: 10,
          cursor: 'pointer', userSelect: 'none',
        }}
        onClick={onToggle}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 16, flexShrink: 0, color: color,
            transition: 'transform 0.15s',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          }}
        >
          expand_more
        </span>
        {release.id && (
          <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: 12, fontWeight: 700, color: '#31332c', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>
          {release.name || 'Unassigned'}
        </span>
        {release.startDate && (
          <span style={{ fontSize: 10, color: '#9e9f95', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {release.startDate}–{release.endDate ?? '…'}
          </span>
        )}
      </div>

      {/* Sprint span area */}
      <div
        style={{
          gridColumn: `2 / span ${sprints.length}`,
          height: ROW_H,
          background: release.id ? color + '08' : '#f5f4ef',
          borderBottom: `2px solid ${color}50`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {bandSpan && (
          <div style={{
            position: 'absolute',
            left: bandSpan.startIdx * SPRINT_W + 3,
            width: Math.max(0, (bandSpan.endIdx - bandSpan.startIdx + 1) * SPRINT_W - 6),
            top: 8, bottom: 8,
            background: color + '28',
            border: `1.5px solid ${color}80`,
            borderRadius: 4,
          }} />
        )}
        {/* Milestone diamonds */}
        {(release.milestones ?? []).filter(ms => ms.date).map(ms => {
          const d = new Date(ms.date); d.setHours(12, 0, 0, 0)
          const si = sprints.findIndex(s => d >= s.start && d <= s.end)
          if (si < 0) return null
          const cx = si * SPRINT_W + SPRINT_W / 2
          return (
            <div
              key={ms.id}
              title={`${ms.name}: ${ms.date}`}
              style={{
                position: 'absolute',
                left: cx - 5, top: '50%',
                transform: 'translateY(-50%) rotate(45deg)',
                width: 8, height: 8,
                background: color,
                border: '1.5px solid white',
                borderRadius: 1,
                boxShadow: '0 1px 3px rgba(0,0,0,.25)',
              }}
            />
          )
        })}
      </div>
    </>
  )
}

// ─── Roadmap toolbar ──────────────────────────────────────────────────────────
function RoadmapToolbar({
  scenarioId, compareMode, compareBase, compareTarget, roadmapLocked, data,
  onLockToggle, onAddScenario, onCompare, onCommitScenario, onExitScenario, onExitCompare, onSwapFocus,
  filterPills,
  depIssueCount, showDepIssues, onToggleDepIssues,
  showHolidays, onToggleHolidays,
}) {
  // Compare mode takes priority — suppresses the scenario commit toolbar until the user exits comparison
  if (compareMode) {
    const baseName   = compareBase   ? (data.scenarios.find(s => s.id === compareBase)?.name   ?? 'Unknown') : 'Main Roadmap'
    const targetName = compareTarget ? (data.scenarios.find(s => s.id === compareTarget)?.name ?? 'Unknown') : 'Main Roadmap'
    return (
      <div className="roadmap-toolbar">
        {/* Colour-coded legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 13, height: 13, borderRadius: 3, border: '1.5px dashed rgba(80,110,160,0.75)', background: 'rgba(80,110,160,0.25)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#4e6a96' }}>Baseline: {baseName}</span>
          </div>
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#b0b3a8' }}>arrow_forward</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 13, height: 13, borderRadius: 3, background: 'rgba(87,99,76,0.82)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#57634c' }}>Proposed: {targetName}</span>
          </div>
        </div>
        <button className="roadmap-btn roadmap-btn--secondary" onClick={onSwapFocus}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>swap_horiz</span>
          Swap Focus
        </button>
        <button className="roadmap-btn roadmap-btn--secondary" onClick={onExitCompare}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
          Exit Comparison
        </button>
      </div>
    )
  }

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
        className={`roadmap-btn ${showHolidays ? 'roadmap-btn--primary' : 'roadmap-btn--secondary'}`}
        onClick={onToggleHolidays}
        title={showHolidays ? 'Hide holiday indicators' : 'Show holiday indicators'}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>event</span>
        Holidays
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
    updateItem, createItem, removeItem,
    commitScenario, createScenario, deleteScenario,
    addDependency, removeDependency,
  } = useDataStore()

  const {
    scenarioId, setScenarioId, clearScenario,
    compareMode, compareBase, compareTarget,
    openCompare, closeCompare, setCompareBase, setCompareTarget,
    roadmapLocked, toggleRoadmapLocked,
    selectedDepId, setSelectedDepId, clearSelectedDep,
    ganttLabelW, setGanttLabelW,
    openPanel, panel,
    pendingDelete, clearPendingDelete,
    collapsedReleases, toggleReleaseCollapsed,
    openDialog,
  } = useUIStore()

  const [showCompareModal, setShowCompareModal] = useState(false)
  const [capacityTip,     setCapacityTip]     = useState(null) // { sprintId, x, y }
  const [showDepIssues,   setShowDepIssues]   = useState(false)
  const [zoomLevel,       setZoomLevel]       = useState(1)    // 0.5 – 2.0
  const [showHolidays,    setShowHolidays]    = useState(true)

  // ── View filters ───────────────────────────────────────────────────────────
  // Empty Set = all active (no filter applied)
  const [activeFilters,    setActiveFilters]    = useState(new Set())
  const [releaseFilters,   setReleaseFilters]   = useState(new Set())
  const [teamGroupFilters, setTeamGroupFilters] = useState(new Set())

  // ── Layout ─────────────────────────────────────────────────────────────────
  const SPRINT_W = Math.round(BASE_SPRINT_W * zoomLevel)
  const LABEL_W  = ganttLabelW
  const totalW   = LABEL_W + sprints.length * SPRINT_W
  const curSpId = useMemo(() => currentSprintId(sprints), [sprints])

  // ── Scenario / active data ─────────────────────────────────────────────────
  const activeScenario = scenarioId
    ? data.scenarios.find(s => s.id === scenarioId) ?? null
    : null

  const locked = roadmapLocked && !scenarioId

  // ── Active tasks (scenario-aware) ─────────────────────────────────────────
  const activeTasks = useMemo(
    () => activeScenario
      ? [...data.tasks, ...(activeScenario.tasks || [])]
      : data.tasks,
    [data.tasks, activeScenario]
  )

  // ── Overscoped sprint detection (for sprint header warnings) ──────────────
  const overscopedSprintIds = useMemo(() => {
    const set = new Set()
    const bufferPct = data.project?.bufferPercent ?? 0
    for (const sp of sprints) {
      const info = getCapacityInfo(sp.id, data.team, activeTasks, sprints.length, bufferPct)
      if (info.some(d => d.over)) set.add(sp.id)
    }
    return set
  }, [sprints, data.team, activeTasks, data.project?.bufferPercent])

  // ── Holiday → sprint overlap map ──────────────────────────────────────────
  const sprintHolidayMap = useMemo(() => {
    const map = new Map()
    if (!showHolidays) return map
    const regions = data.project?.regions ?? []
    // Derive year range from sprint dates
    const fromYear = sprints.length ? sprints[0].start.getFullYear()  : new Date().getFullYear()
    const toYear   = sprints.length ? sprints[sprints.length - 1].end.getFullYear() : fromYear + 2
    // Merge DB holidays + user custom holidays
    const dbHolidays     = getHolidaysForRegions(regions, Math.max(2025, fromYear), Math.min(2028, toYear + 1))
    const customHolidays = (data.project?.customHolidays ?? [])
    const holidays = [...dbHolidays, ...customHolidays]
    if (!holidays.length) return map
    for (const sp of sprints) {
      const spStart = sp.start
      const spEnd   = sp.end
      const matching = holidays.filter(h => {
        if (!h.startDate) return false
        const hStart = new Date(h.startDate); hStart.setHours(0, 0, 0, 0)
        const hEnd   = new Date(h.endDate ?? h.startDate); hEnd.setHours(23, 59, 59, 999)
        return hStart <= spEnd && hEnd >= spStart
      })
      if (matching.length > 0) map.set(sp.id, matching)
    }
    return map
  }, [sprints, data.project?.regions, data.project?.customHolidays, showHolidays])

  // ── Build rows ─────────────────────────────────────────────────────────────
  const rows = useMemo(
    () => buildGanttRows(data, activeScenario),
    [data, activeScenario]
  )

  // ── Filter rows by release collapse, release filter, type filters, team ───
  const filteredRows = useMemo(() => {
    let currentReleaseId = undefined  // undefined = no release header seen yet
    const result = []

    for (const row of rows) {
      if (row.type === 'releaseHeader') {
        currentReleaseId = row.item.id
        // When a release filter is active, skip headers not matching it
        if (releaseFilters.size > 0 && !releaseFilters.has(currentReleaseId)) continue
        result.push(row)
        continue
      }

      // Skip items in a collapsed release
      if (currentReleaseId !== undefined && collapsedReleases[currentReleaseId]) continue

      // Skip items not matching release filter
      if (releaseFilters.size > 0 && !releaseFilters.has(row.releaseId)) continue

      // Type filter (empty = all active)
      if (activeFilters.size > 0 && !activeFilters.has(row.type)) continue

      // Team group filter (empty = all active)
      if (teamGroupFilters.size > 0 && !teamGroupFilters.has(row.item.teamId)) continue

      result.push(row)
    }

    return result
  }, [rows, collapsedReleases, releaseFilters, activeFilters, teamGroupFilters])

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
    openDialog({
      type: 'prompt',
      title: 'New Scenario',
      message: 'Give this scenario a name:',
      defaultValue: 'New Scenario',
      onConfirm: name => {
        if (!name?.trim()) return
        const id = createScenario(name.trim())
        setScenarioId(id)
      },
    })
  }

  const handleCommitScenario = () => {
    if (!scenarioId) return
    const scn = data.scenarios.find(s => s.id === scenarioId)
    openDialog({
      type: 'confirm',
      title: `Commit "${scn?.name}"?`,
      message: 'This will apply all sprint changes to the main roadmap, add any new scenario tasks to the backlog, and delete this scenario. This cannot be undone.',
      onConfirm: () => {
        commitScenario(scenarioId)
        clearScenario()
      },
    })
  }

  const handleExitScenario = () => clearScenario()

  const handleExitCompare = () => { closeCompare(); clearScenario() }

  const handleCompareConfirm = (base, target) => {
    setShowCompareModal(false)
    openCompare(base, target)
    // Set the active view to the target scenario so comparison is immediately visible
    if (target) setScenarioId(target)
    else clearScenario()
  }

  const handleSwapFocus = () => {
    const newBase   = compareTarget
    const newTarget = compareBase
    setCompareBase(newBase)
    setCompareTarget(newTarget)
    if (newTarget) setScenarioId(newTarget)
    else clearScenario()
  }

  // ── Add task in cell ───────────────────────────────────────────────────────
  const handleAddTaskInCell = (epicId, sprintId) => {
    if (activeScenario) {
      const item = createItem('task', {
        summary: 'New Task', priority: 'Medium', assignee: 'Unassigned',
        estimate: null, discipline: null, description: '', epicId, sprintId,
      }, scenarioId)
      if (item) openPanel('task', item.id)
    } else {
      const item = createItem('task', {
        summary: 'New Task', priority: 'Medium', assignee: 'Unassigned',
        estimate: null, discipline: null, description: '', epicId, sprintId,
      })
      if (item) openPanel('task', item.id)
    }
  }

  // ── Per-row Y offsets for variable-height rows ────────────────────────────
  const { rowYOffsets, rowHeightsArr } = useMemo(() => {
    const offsets = []
    const heights = []
    let y = 0
    for (const row of filteredRows) {
      offsets.push(y)
      const h = ROW_HEIGHTS[row.type] ?? ROW_H
      heights.push(h)
      y += h
    }
    return { rowYOffsets: offsets, rowHeightsArr: heights }
  }, [filteredRows])

  // ── Render ─────────────────────────────────────────────────────────────────
  const dataH  = rowYOffsets.length > 0
    ? rowYOffsets[rowYOffsets.length - 1] + rowHeightsArr[rowHeightsArr.length - 1]
    : 0
  const totalH = ROW_H + dataH

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative' }}
      onClick={() => { if (selectedDepId) clearSelectedDep() }}
    >
      {/* Toolbar */}
      <RoadmapToolbar
        scenarioId={scenarioId}
        compareMode={compareMode}
        compareBase={compareBase}
        compareTarget={compareTarget}
        roadmapLocked={roadmapLocked}
        data={data}
        onLockToggle={toggleRoadmapLocked}
        onAddScenario={handleAddScenario}
        onCompare={() => {
          if (!data.scenarios.length) {
            openDialog({
              type: 'alert',
              title: 'No scenarios yet',
              message: 'Create at least one scenario before comparing. Use the "Add Scenario" button to get started.',
            })
            return
          }
          setShowCompareModal(true)
        }}
        onCommitScenario={handleCommitScenario}
        onExitScenario={handleExitScenario}
        onExitCompare={handleExitCompare}
        onSwapFocus={handleSwapFocus}
        filterPills={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <MultiSelectDropdown
              label="Issue Types"
              options={[
                { key: 'initiative', label: 'Initiative', icon: 'bolt',       color: '#7a583d' },
                { key: 'epic',       label: 'Epic',       icon: 'view_quilt', color: '#57634c' },
                { key: 'task',       label: 'Task',       icon: 'task_alt',   color: '#5b5f63' },
              ]}
              selected={activeFilters}
              onChange={setActiveFilters}
            />
            {(data.project?.releases ?? []).length > 0 && (
              <MultiSelectDropdown
                label="Releases"
                options={(data.project.releases ?? []).map(r => ({ key: r.id, label: r.name }))}
                selected={releaseFilters}
                onChange={setReleaseFilters}
              />
            )}
            {(data.teamGroups ?? []).length > 0 && (
              <MultiSelectDropdown
                label="Teams"
                options={(data.teamGroups ?? []).map(g => ({ key: g.id, label: g.name }))}
                selected={teamGroupFilters}
                onChange={setTeamGroupFilters}
              />
            )}
          </div>
        }
        depIssueCount={brokenDeps.length}
        showDepIssues={showDepIssues}
        onToggleDepIssues={() => setShowDepIssues(v => !v)}
        showHolidays={showHolidays}
        onToggleHolidays={() => setShowHolidays(v => !v)}
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
            const isCur    = sp.id === curSpId
            const isOver   = overscopedSprintIds.has(sp.id)
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
                  background: isOver ? 'rgba(180,120,20,0.10)' : undefined,
                  borderBottom: isOver ? '2px solid rgba(180,120,20,0.40)' : undefined,
                }}
                onMouseEnter={e => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setCapacityTip({ sprintId: sp.id, x: rect.left + rect.width / 2, y: rect.bottom + 4 })
                }}
                onMouseLeave={() => setCapacityTip(null)}
              >
                {isOver && (
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 11, color: '#b47814', fontVariationSettings: "'FILL' 1", position: 'absolute', top: 3, right: 3 }}
                    title="Discipline overscoped in this sprint"
                  >
                    warning
                  </span>
                )}
                {sprintHolidayMap.has(sp.id) && (
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 11, color: '#4a8c5c', fontVariationSettings: "'FILL' 1", position: 'absolute', top: 3, left: 3 }}
                    title={sprintHolidayMap.get(sp.id).map(h =>
                      `${h.name} (${h.region})${h.endDate && h.endDate !== h.startDate ? `: ${h.startDate} – ${h.endDate}` : `: ${h.startDate}`}`
                    ).join('\n')}
                  >
                    event
                  </span>
                )}
                <span style={{ fontSize: 10, fontWeight: 700, color: isCur ? '#5b5f63' : '#5e6058', whiteSpace: 'nowrap' }}>
                  {sp.label}
                </span>
                <span style={{ fontSize: 9, color: '#9e9f95', whiteSpace: 'nowrap' }}>{sp.dates}</span>
                {isCur && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5b5f63', marginTop: 2, display: 'block' }} />}
              </div>
            )
          })}

          {/* ── Data rows ── */}
          {filteredRows.map((rowDef, rowIdx) => {
            // Release header sentinel rows
            if (rowDef.type === 'releaseHeader') {
              return (
                <ReleaseHeaderRow
                  key={`rel-hdr-${rowDef.item.id ?? 'unassigned'}`}
                  release={rowDef.item}
                  sprints={sprints}
                  SPRINT_W={SPRINT_W}
                  ROW_H={ROW_HEIGHTS.releaseHeader}
                  LABEL_W={LABEL_W}
                  collapsed={!!collapsedReleases[rowDef.item.id]}
                  onToggle={() => toggleReleaseCollapsed(rowDef.item.id)}
                />
              )
            }

            const { item, type, indent } = rowDef
            const range     = ranges.get(item.id)
            const baseRange = baseRanges.get(item.id)
            const isSelected = panel.open && panel.id === item.id

            const rowH = ROW_HEIGHTS[type] ?? ROW_H
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
                ROW_H={rowH}
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
          rowYOffsets={rowYOffsets}
          rowHeightsArr={rowHeightsArr}
        />
      </div>

      {/* Bottom bar — view controls */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        padding: '4px 14px', background: '#fbf9f4',
        borderTop: '1px solid #c5c6bb', flexShrink: 0, gap: 6,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#9e9f95', textTransform: 'uppercase', letterSpacing: '.06em', marginRight: 2 }}>Zoom</span>
        <button
          title="Zoom out"
          onClick={() => setZoomLevel(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
          disabled={zoomLevel <= 0.5}
          style={{
            width: 22, height: 22, borderRadius: 5, border: '1px solid #d1cfc4',
            background: '#fbf9f4', cursor: zoomLevel <= 0.5 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, lineHeight: 1, color: zoomLevel <= 0.5 ? '#c5c6bb' : '#5e6058',
            fontWeight: 700, padding: 0, flexShrink: 0,
          }}
        >−</button>
        <button
          title="Reset zoom to 100%"
          onClick={() => setZoomLevel(1)}
          style={{
            padding: '2px 6px', borderRadius: 5, border: '1px solid #d1cfc4',
            background: zoomLevel !== 1 ? '#4a6fa510' : '#fbf9f4',
            cursor: 'pointer', fontSize: 11, fontWeight: 700,
            color: zoomLevel !== 1 ? '#4a6fa5' : '#5e6058', flexShrink: 0,
          }}
        >{Math.round(zoomLevel * 100)}%</button>
        <button
          title="Zoom in"
          onClick={() => setZoomLevel(z => Math.min(2, +(z + 0.25).toFixed(2)))}
          disabled={zoomLevel >= 2}
          style={{
            width: 22, height: 22, borderRadius: 5, border: '1px solid #d1cfc4',
            background: '#fbf9f4', cursor: zoomLevel >= 2 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, lineHeight: 1, color: zoomLevel >= 2 ? '#c5c6bb' : '#5e6058',
            fontWeight: 700, padding: 0, flexShrink: 0,
          }}
        >+</button>
      </div>

      {/* Lock wash overlay */}
      {locked && (
        <div style={{ position: 'absolute', top: 41, left: 0, right: 0, bottom: 0, background: 'rgba(251,249,244,0.45)', pointerEvents: 'none', zIndex: 50 }} />
      )}

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-80">
            <p className="text-sm font-bold text-on-background mb-1">Delete {pendingDelete.type}?</p>
            <p className="text-xs text-slate-500 mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                className="flex-1 py-2 rounded-xl bg-error text-white text-sm font-bold hover:bg-error/90 transition-all"
                onClick={() => {
                  removeItem(pendingDelete.type, pendingDelete.id, pendingDelete.scenarioId ?? null)
                  clearPendingDelete()
                }}
              >Delete</button>
              <button
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50 transition-all"
                onClick={clearPendingDelete}
              >Cancel</button>
            </div>
          </div>
        </div>
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
        const tipBuffer = data.project?.bufferPercent ?? 0

        // Per-discipline capacity info
        const discInfo = getCapacityInfo(capacityTip.sprintId, data.team, activeTasks, sprints.length, tipBuffer)
        const hasAnyWork = discInfo.some(d => d.used > 0)
        const anyOver    = discInfo.some(d => d.over)

        return (
          <div style={{ position: 'fixed', left: capacityTip.x, top: capacityTip.y, transform: 'translateX(-50%)', zIndex: 9999, background: 'white', border: `1px solid ${anyOver ? 'rgba(180,120,20,0.50)' : '#c5c6bb'}`, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,.12)', padding: '10px 14px', minWidth: 200, pointerEvents: 'none' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
              {anyOver && (
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#b47814', fontVariationSettings: "'FILL' 1" }}>warning</span>
              )}
              <span style={{ fontSize: 11, fontWeight: 700, color: '#5e6058', textTransform: 'uppercase', letterSpacing: '.06em' }}>{tipSprint.label}</span>
              {anyOver && (
                <span style={{ fontSize: 9, fontWeight: 700, color: '#b47814', background: 'rgba(180,120,20,0.12)', borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Overscoped</span>
              )}
            </div>

            {!hasAnyWork ? (
              <div style={{ fontSize: 12, color: '#9e9f95' }}>No tasks assigned</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {discInfo.filter(d => d.used > 0 || d.capacity > 0).map(d => {
                  const barPct = d.capacity > 0 ? Math.min(100, Math.round((d.used / d.capacity) * 100)) : 0
                  const barColor = d.over ? '#b47814' : '#5b5f63'
                  return (
                    <div key={d.discipline}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 600, marginBottom: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {d.over && (
                            <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#b47814', fontVariationSettings: "'FILL' 1" }}>warning</span>
                          )}
                          <span style={{ color: d.over ? '#b47814' : '#31332c' }}>{d.discipline}</span>
                        </div>
                        <span style={{ color: d.over ? '#b47814' : '#5e6058' }}>
                          {Math.round(d.used)}h / {Math.round(d.capacity)}h
                          {d.over && <span style={{ marginLeft: 3, fontSize: 10 }}>(+{d.overAmt}h)</span>}
                        </span>
                      </div>
                      <div style={{ height: 3, borderRadius: 2, background: '#efeee6', overflow: 'hidden' }}>
                        <div style={{ width: `${barPct}%`, height: '100%', borderRadius: 2, background: barColor, transition: 'width 0.2s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {tipBuffer > 0 && (
              <div style={{ fontSize: 10, color: '#9e9f95', marginTop: 6, borderTop: '1px solid #efeee6', paddingTop: 5 }}>
                {tipBuffer}% buffer reserved
              </div>
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
            {/* Compare-mode ghost bar — shows baseline scenario position */}
            {compareMode && baseRange && si === baseRange.startIndex && (() => {
              const sameAsActive = range &&
                baseRange.startIndex === range.startIndex &&
                baseRange.endIndex   === range.endIndex
              if (sameAsActive) return null
              const ghostSpan = baseRange.endIndex - baseRange.startIndex + 1
              return (
                <div
                  className="gantt-bar gantt-bar--ghost"
                  style={{ left: 10, width: ghostSpan * SPRINT_W - 20, height: ROW_H - 6 }}
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
                height: ROW_H - 6,
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
                    // Clean up any previously attached drag listener before re-attaching.
                    // Without this, every re-render (triggered by a data change) would add
                    // a new mousedown listener with a stale closure, causing scenario drags
                    // to call updateItem on base data instead of updateScenarioSprintOverride.
                    if (el.__dragCleanup) el.__dragCleanup()
                    el.__dragCleanup = attachBarDrag(el, item, type, range, sprints, LABEL_W, ROW_H, SPRINT_W)
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
                        style={{ left: -5, top: Math.round((ROW_H - 6) / 2) - 5, transform: 'none' }}
                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); startDepDraw(item.id, e.currentTarget, 'left') }}
                      />
                      <div
                        className="gantt-dep-handle"
                        title="Blocks →: drag to the task that depends on this one finishing first"
                        style={{ left: barW - 5, top: Math.round((ROW_H - 6) / 2) - 5, transform: 'none' }}
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
