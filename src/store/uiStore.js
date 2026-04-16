import { create } from 'zustand'

/**
 * UI state store — mirrors the original `appState` object from the single-file app.
 * All view-layer state lives here; no persistence (resets on page load).
 */
export const useUIStore = create(set => ({
  // ── Active view ────────────────────────────────────────────────────────────
  view: 'backlog',
  setView: view => set({ view }),

  // ── Structure tree collapse state ──────────────────────────────────────────
  // Map of { [id]: true } for collapsed items
  collapsed: {},
  allCollapsed: false,
  toggleCollapsed: id =>
    set(s => {
      const effective = s.collapsed[id] !== false && (s.allCollapsed || !!s.collapsed[id])
      return { collapsed: { ...s.collapsed, [id]: !effective } }
    }),
  setCollapsed: (id, value) =>
    set(s => ({ collapsed: { ...s.collapsed, [id]: value } })),
  setAllCollapsed: allCollapsed =>
    set({ allCollapsed, collapsed: {} }),

  // ── Filters ────────────────────────────────────────────────────────────────
  filters: { search: '', type: 'all' },
  setFilter: (key, value) =>
    set(s => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () =>
    set({ filters: { search: '', type: 'all' } }),

  // ── Side panel ─────────────────────────────────────────────────────────────
  panel: { open: false, type: null, id: null },
  openPanel: (type, id) => set({ panel: { open: true, type, id } }),
  closePanel: () => set({ panel: { open: false, type: null, id: null } }),

  // ── Pending delete confirmation ────────────────────────────────────────────
  pendingDelete: null,
  setPendingDelete: pendingDelete => set({ pendingDelete }),
  clearPendingDelete: () => set({ pendingDelete: null }),

  // ── Comment author (persists within session) ───────────────────────────────
  commentAuthor: '',
  setCommentAuthor: commentAuthor => set({ commentAuthor }),

  // ── Gantt / roadmap layout ─────────────────────────────────────────────────
  ganttLabelW: 260,
  setGanttLabelW: ganttLabelW => set({ ganttLabelW }),

  roadmapLocked: false,
  setRoadmapLocked: roadmapLocked => set({ roadmapLocked }),
  toggleRoadmapLocked: () => set(s => ({ roadmapLocked: !s.roadmapLocked })),

  // ── Sprint visibility ──────────────────────────────────────────────────────
  hidePastSprints: false,
  setHidePastSprints: hidePastSprints => set({ hidePastSprints }),
  toggleHidePastSprints: () => set(s => ({ hidePastSprints: !s.hidePastSprints })),

  // ── Active scenario ────────────────────────────────────────────────────────
  scenarioId: null,
  setScenarioId: scenarioId => set({ scenarioId }),
  clearScenario: () => set({ scenarioId: null }),

  // ── Compare mode ───────────────────────────────────────────────────────────
  compareMode: false,
  compareBase: null,
  compareTarget: null,
  openCompare: (base, target) => set({ compareMode: true, compareBase: base, compareTarget: target }),
  closeCompare: () => set({ compareMode: false, compareBase: null, compareTarget: null }),
  setCompareBase: compareBase => set({ compareBase }),
  setCompareTarget: compareTarget => set({ compareTarget }),

  // ── Selected dependency arrow (roadmap) ───────────────────────────────────
  selectedDepId: null,
  setSelectedDepId: selectedDepId => set({ selectedDepId }),
  clearSelectedDep: () => set({ selectedDepId: null }),

  // ── Summary comparison ─────────────────────────────────────────────────────
  summaryBase: 'main',
  summaryTarget: null,
  setSummaryBase: summaryBase => set({ summaryBase }),
  setSummaryTarget: summaryTarget => set({ summaryTarget }),

  // ── Multi-select ────────────────────────────────────────────────────────────
  selectedIds: new Set(),
  lastSelectedId: null,
  toggleSelected: id => set(s => {
    const next = new Set(s.selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    return { selectedIds: next, lastSelectedId: id }
  }),
  clearSelection: () => set({ selectedIds: new Set(), lastSelectedId: null }),
  setSelection: ids => set({ selectedIds: new Set(ids), lastSelectedId: [...ids].pop() ?? null }),

  // ── Context menu ───────────────────────────────────────────────────────────
  contextMenu: null, // { x, y, taskId, currentSprintId }
  openContextMenu: (x, y, data) => set({ contextMenu: { x, y, ...data } }),
  closeContextMenu: () => set({ contextMenu: null }),

  // ── Drag state (non-reactive, managed externally by dnd-kit) ──────────────
  // dnd-kit manages its own drag state; nothing to store here.

  // ── Team group filter ──────────────────────────────────────────────────────
  teamGroupFilter: null,
  setTeamGroupFilter: teamGroupFilter => set({ teamGroupFilter }),

  // ── Release collapse state ─────────────────────────────────────────────────
  // Map of { [releaseId]: true } for collapsed releases
  collapsedReleases: {},
  toggleReleaseCollapsed: id =>
    set(s => ({ collapsedReleases: { ...s.collapsedReleases, [id]: !s.collapsedReleases[id] } })),
  setReleaseCollapsed: (id, value) =>
    set(s => ({ collapsedReleases: { ...s.collapsedReleases, [id]: value } })),

  // ── Release filter ────────────────────────────────────────────────────────
  releaseFilter: null,
  setReleaseFilter: releaseFilter => set({ releaseFilter }),
  clearReleaseFilter: () => set({ releaseFilter: null }),

  // ── In-app dialog (replaces window.alert / confirm / prompt) ─────────────
  // type: 'alert' | 'confirm' | 'prompt'
  // title: string
  // message: string
  // defaultValue: string (prompt only)
  // onConfirm: (value?) => void
  // onCancel: () => void (confirm/prompt only)
  dialog: null,
  openDialog: config => set({ dialog: config }),
  closeDialog: () => set({ dialog: null }),
}))
