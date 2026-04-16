import { useState } from 'react'
import { useUIStore } from './store/uiStore'
import { useDataStore } from './store/dataStore'
import StructureView from './components/views/StructureView'
import SprintView    from './components/views/SprintView'
import RoadmapView   from './components/views/RoadmapView'
import TeamView      from './components/views/TeamView'
import ProjectView   from './components/views/ProjectView'
import SummaryView   from './components/views/SummaryView'
import Panel         from './components/ui/Panel'
import Dialog        from './components/ui/Dialog'

const NAV_ITEMS = [
  { id: 'project',  label: 'Project',   icon: 'folder_open'    },
  { id: 'team',     label: 'Team',      icon: 'group'          },
  { id: 'sprints',  label: 'Sprints',   icon: 'directions_run' },
  { id: 'backlog',  label: 'Structure', icon: 'account_tree'   },
  { id: 'roadmap',  label: 'Roadmap',   icon: 'timeline'       },
  { id: 'summary',  label: 'Summary',   icon: 'bar_chart'      },
]

export default function App() {
  const {
    view, setView,
    filters, setFilter,
    allCollapsed, setAllCollapsed,
    hidePastSprints, setHidePastSprints,
    scenarioId, setScenarioId, clearScenario,
    openDialog,
  } = useUIStore()

  const { data, deleteScenario } = useDataStore()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebarCollapsed') === 'true' } catch { return false }
  })

  function toggleSidebar() {
    setSidebarCollapsed(v => {
      const next = !v
      try { localStorage.setItem('sidebarCollapsed', String(next)) } catch {}
      return next
    })
  }

  const isStructure = view === 'backlog'
  const isSprint    = view === 'sprints'
  const isRoadmap   = view === 'roadmap'

  const handleDeleteScenario = (scn) => {
    openDialog({
      type: 'confirm',
      title: `Delete "${scn.name}"?`,
      message: 'Are you sure you want to delete this scenario? This cannot be undone.',
      onConfirm: () => {
        // If we're currently viewing this scenario, navigate away first
        if (scenarioId === scn.id) {
          const remaining = data.scenarios.filter(s => s.id !== scn.id)
          if (remaining.length > 0) {
            const idx = data.scenarios.findIndex(s => s.id === scn.id)
            const next = remaining[idx] ?? remaining[idx - 1] ?? remaining[0]
            setScenarioId(next.id)
          } else {
            clearScenario()
          }
          setView('roadmap')
        }
        deleteScenario(scn.id)
      },
    })
  }

  const hasTopBar = isStructure || isSprint

  return (
    <div className="min-h-screen h-screen bg-background text-on-background flex flex-row overflow-hidden">

      {/* ── Left Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className="flex-shrink-0 flex flex-col bg-surface-container-low border-r border-outline-variant/20 overflow-hidden transition-all duration-200"
        style={{ width: sidebarCollapsed ? 48 : 200 }}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-2 py-3 border-b border-outline-variant/20 flex-shrink-0" style={{ minHeight: 48 }}>
          {!sidebarCollapsed && (
            <span className="font-extrabold font-headline text-primary text-sm pl-1 truncate">
              Scope Cap
            </span>
          )}
          <button
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-surface-container hover:text-primary transition-colors flex-shrink-0 ml-auto"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="material-symbols-outlined text-lg">
              {sidebarCollapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map(item => {
            const isActive = view === item.id
            return (
              <div key={item.id}>
                <button
                  className={`w-full flex items-center gap-2.5 px-3 py-2 transition-colors rounded-lg mx-1 text-left ${
                    isActive
                      ? 'bg-primary text-on-primary'
                      : 'text-slate-600 hover:bg-surface-container'
                  }`}
                  style={{ width: 'calc(100% - 8px)' }}
                  onClick={() => setView(item.id)}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span
                    className="material-symbols-outlined flex-shrink-0"
                    style={{ fontSize: 18 }}
                  >
                    {item.icon}
                  </span>
                  {!sidebarCollapsed && (
                    <span className="text-[13px] font-semibold truncate">{item.label}</span>
                  )}
                </button>

                {/* Scenario sub-items (Roadmap only, expanded only) */}
                {item.id === 'roadmap' && !sidebarCollapsed && data.scenarios.length > 0 && (
                  <div className="ml-2 mb-1">
                    <button
                      className={`w-full flex items-center gap-1.5 pl-7 pr-3 py-1.5 text-left rounded-lg mx-1 transition-colors ${
                        isRoadmap && !scenarioId
                          ? 'text-primary font-bold'
                          : 'text-slate-500 hover:bg-surface-container'
                      }`}
                      style={{ width: 'calc(100% - 8px)', fontSize: 12 }}
                      onClick={() => { clearScenario(); setView('roadmap') }}
                    >
                      <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: 13 }}>
                        subdirectory_arrow_right
                      </span>
                      <span className="truncate">Main Roadmap</span>
                    </button>
                    {data.scenarios.map(scn => (
                      <div
                        key={scn.id}
                        className="group relative mx-1"
                        style={{ width: 'calc(100% - 8px)' }}
                      >
                        <button
                          className={`w-full flex items-center gap-1.5 pl-7 pr-7 py-1.5 text-left rounded-lg transition-colors ${
                            isRoadmap && scenarioId === scn.id
                              ? 'text-primary font-bold'
                              : 'text-slate-500 hover:bg-surface-container'
                          }`}
                          style={{ fontSize: 12 }}
                          onClick={() => { setScenarioId(scn.id); setView('roadmap') }}
                        >
                          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: 13 }}>
                            fork_right
                          </span>
                          <span className="truncate">{scn.name}</span>
                        </button>
                        <button
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400 rounded p-0.5"
                          title={`Delete "${scn.name}"`}
                          onClick={e => { e.stopPropagation(); handleDeleteScenario(scn) }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </aside>

      {/* ── Right: top bar + content ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">

        {/* Contextual top bar (structure + sprint views only) */}
        {hasTopBar && (
          <header className="h-10 bg-surface-container-low border-b border-surface-container flex items-center gap-2 px-3 flex-shrink-0 flex-wrap">
            {/* Search */}
            <input
              className="text-sm border border-outline-variant/40 rounded-lg px-3 py-1 bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30 w-44"
              placeholder="Search…"
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
            />

            {/* Type filter pills (structure only) */}
            {isStructure && (
              <div className="flex items-center gap-1">
                {['all', 'initiative', 'epic', 'task'].map(f => (
                  <button
                    key={f}
                    className={`text-[11px] font-bold px-3 py-0.5 rounded-full border transition-colors capitalize
                      ${filters.type === f
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-white text-slate-600 border-outline-variant/40 hover:bg-surface-container'}`}
                    onClick={() => setFilter('type', f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}

            {/* Collapse all (structure only) */}
            {isStructure && (
              <button
                className="text-[11px] font-bold px-3 py-0.5 rounded-full border border-outline-variant/40 bg-white text-slate-600 hover:bg-surface-container transition-colors"
                onClick={() => setAllCollapsed(!allCollapsed)}
              >
                {allCollapsed ? 'Expand All' : 'Collapse All'}
              </button>
            )}

            {/* Hide past sprints (sprint view only) */}
            {isSprint && (
              <button
                className="text-[11px] font-bold px-3 py-0.5 rounded-full border border-outline-variant/40 bg-white text-slate-600 hover:bg-surface-container transition-colors"
                onClick={() => setHidePastSprints(!hidePastSprints)}
              >
                {hidePastSprints ? 'Show Past Sprints' : 'Hide Past Sprints'}
              </button>
            )}
          </header>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {isStructure          && <StructureView />}
          {isSprint             && <SprintView />}
          {isRoadmap            && <RoadmapView />}
          {view === 'team'      && <TeamView />}
          {view === 'project'   && <ProjectView />}
          {view === 'summary'   && <SummaryView />}
        </main>
      </div>

      {/* Side panel — rendered outside main so it overlays all views */}
      <Panel />

      {/* In-app dialog — replaces window.alert/confirm/prompt */}
      <Dialog />
    </div>
  )
}
