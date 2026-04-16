import { useState, useMemo, useRef, useCallback } from 'react'
import { useDataStore } from '../../store/dataStore'
import { useUIStore } from '../../store/uiStore'
import DatePicker from '../ui/DatePicker'
import { SUPPORTED_REGIONS, getHolidaysForRegions } from '../../data/holidayDb'

// ─── Release color palette ────────────────────────────────────────────────────
const RELEASE_COLORS = [
  '#4a6fa5', '#4a8c5c', '#8c5a4a', '#7a5b8c', '#8c7a4a',
  '#4a7a8c', '#8c4a6f', '#5a8c4a', '#6f4a8c', '#8c6f4a',
]

// ─── Shared card shell ────────────────────────────────────────────────────────
function Card({ title, icon, children }) {
  return (
    <div className="bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/20 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-outline-variant/20 bg-surface-container-low">
        <span className="material-symbols-outlined text-slate-500 text-lg">{icon}</span>
        <span className="font-bold text-sm text-on-background">{title}</span>
      </div>
      <div className="p-4 flex flex-col gap-4">
        {children}
      </div>
    </div>
  )
}

// ─── Field row (label + input side by side) ───────────────────────────────────
function FieldRow({ label, children }) {
  return (
    <div className="flex items-center gap-4">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide w-28 shrink-0">
        {label}
      </label>
      {children}
    </div>
  )
}

// ─── Card 1: Project Details (timeline + regions + holidays) ─────────────────
const REGION_COLORS = {
  CA: '#4a6fa5', US: '#8c5a4a', UK: '#4a8c5c',
  AU: '#7a5b8c', FR: '#8c6f4a', DE: '#5b8c8c',
}
const regionColor = code => REGION_COLORS[code] || '#9e9f95'

function TimelineCard({ project, onUpdate, onUpdateRegions, onAddHoliday, onRemoveHoliday }) {
  const [name,      setName]      = useState(project.name      ?? '')
  const [startDate, setStartDate] = useState(project.startDate ?? '')
  const [endDate,   setEndDate]   = useState(project.endDate   ?? '')
  const [ongoing,   setOngoing]   = useState(project.ongoing   ?? true)
  const [buffer,    setBuffer]    = useState(project.bufferPercent ?? 0)
  const [showHolidayInfo, setShowHolidayInfo] = useState(false)
  const [showAddCustom,  setShowAddCustom]  = useState(false)
  const [customForm, setCustomForm] = useState({ name: '', startDate: '', endDate: '' })

  const regions       = project.regions       ?? []
  const customHolidays = project.customHolidays ?? []

  // Derive year range from project start date
  const fromYear = useMemo(() => {
    const y = project.startDate ? new Date(project.startDate).getFullYear() : new Date().getFullYear()
    return Math.max(2025, y)
  }, [project.startDate])
  const toYear = Math.min(fromYear + 2, 2028)

  // Auto-populated holidays from DB for active regions
  const dbHolidays = useMemo(
    () => getHolidaysForRegions(regions, fromYear, toYear),
    [regions, fromYear, toYear]
  )

  // Merge and group all holidays by year
  const allHolidays = useMemo(() => {
    const merged = [
      ...dbHolidays,
      ...customHolidays.map(h => ({ ...h, source: 'custom' })),
    ].sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))
    const byYear = {}
    for (const h of merged) {
      const y = h.startDate ? h.startDate.slice(0, 4) : 'Unknown'
      if (!byYear[y]) byYear[y] = []
      byYear[y].push(h)
    }
    return byYear
  }, [dbHolidays, customHolidays])

  const handleOngoingChange = e => {
    const checked = e.target.checked
    setOngoing(checked)
    if (checked) { setEndDate(''); onUpdate({ ongoing: true, endDate: null }) }
    else onUpdate({ ongoing: false })
  }

  const handleBufferChange = e => {
    const val = Math.max(0, Math.min(100, +e.target.value || 0))
    setBuffer(val)
    onUpdate({ bufferPercent: val })
  }

  const handleToggleRegion = code => {
    if (regions.includes(code)) onUpdateRegions(regions.filter(r => r !== code))
    else onUpdateRegions([...regions, code])
  }

  const handleAddCustom = () => {
    if (!customForm.name.trim() || !customForm.startDate) return
    onAddHoliday({
      name:      customForm.name.trim(),
      startDate: customForm.startDate,
      endDate:   customForm.endDate || customForm.startDate,
      region:    'Custom',
    })
    setCustomForm({ name: '', startDate: '', endDate: '' })
    setShowAddCustom(false)
  }

  const hasHolidays = Object.keys(allHolidays).length > 0

  return (
    <Card title="Project Details" icon="calendar_month">
      {/* ── Project name ── */}
      <FieldRow label="Project Name">
        <input
          type="text"
          value={name}
          className="flex-1 text-sm font-semibold bg-slate-50 border border-outline-variant/30 rounded-lg py-1.5 px-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
          onChange={e => setName(e.target.value)}
          onBlur={e => { if (e.target.value.trim()) onUpdate({ name: e.target.value.trim() }) }}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
          placeholder="Project name"
        />
      </FieldRow>

      {/* ── Timeline fields ── */}
      <FieldRow label="Start Date">
        <DatePicker
          value={startDate}
          onChange={val => { const v = val || '2026-01-01'; setStartDate(v); onUpdate({ startDate: v }) }}
        />
      </FieldRow>
      <FieldRow label="End Date">
        <div className="flex items-center gap-3 flex-1">
          <DatePicker
            value={endDate}
            disabled={ongoing}
            onChange={val => { setEndDate(val ?? ''); onUpdate({ endDate: val || null }) }}
          />
          <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap">
            <input type="checkbox" checked={ongoing} className="accent-primary cursor-pointer" onChange={handleOngoingChange} />
            Ongoing
          </label>
        </div>
      </FieldRow>
      <FieldRow label="Capacity Buffer">
        <div className="flex items-center gap-3 flex-1">
          <input
            type="number" min="0" max="100" step="1" value={buffer}
            className="w-20 text-sm font-semibold bg-slate-50 border border-outline-variant/30 rounded-lg py-1.5 px-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
            onChange={handleBufferChange}
          />
          <span className="text-sm font-bold text-slate-600">% reserved</span>
        </div>
      </FieldRow>

      {/* ── Divider ── */}
      <div className="border-t border-outline-variant/20" />

      {/* ── Regions ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Team Regions</span>
          {regions.length > 0 && (
            <button
              onClick={() => { setShowHolidayInfo(v => !v); setShowAddCustom(false) }}
              title={showHolidayInfo ? 'Hide stat holidays' : 'View stat holidays for selected regions'}
              className="flex items-center justify-center rounded-full transition-colors"
              style={{
                width: 16, height: 16, flexShrink: 0,
                background: showHolidayInfo ? '#4a6fa5' : '#e2e3dc',
                color: showHolidayInfo ? 'white' : '#9e9f95',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 11, fontVariationSettings: "'FILL' 1" }}>info</span>
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_REGIONS.map(({ code, label }) => {
            const active = regions.includes(code)
            const color  = regionColor(code)
            return (
              <button
                key={code}
                onClick={() => handleToggleRegion(code)}
                className="flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1 border transition-colors"
                style={active
                  ? { background: color + '18', color, borderColor: color + '60' }
                  : { background: 'transparent', color: '#9e9f95', borderColor: '#e2e3dc' }
                }
                title={label}
              >
                {active && <span className="material-symbols-outlined" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
                {code}
                <span className="font-normal opacity-70">{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Holiday info panel (toggled by "i" icon) ── */}
      {showHolidayInfo && regions.length > 0 && (
        <div className="flex flex-col gap-2 bg-slate-50 rounded-xl border border-outline-variant/20 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Stat Holidays</span>
            <button
              className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
              onClick={() => setShowAddCustom(v => !v)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{showAddCustom ? 'remove' : 'add'}</span>
              Custom
            </button>
          </div>

          {/* Add custom holiday form */}
          {showAddCustom && (
            <div className="flex flex-col gap-2 bg-white rounded-lg p-3 border border-outline-variant/20">
              <input
                type="text"
                placeholder="Holiday name"
                value={customForm.name}
                className="text-sm font-semibold bg-slate-50 border border-outline-variant/30 rounded-lg py-1.5 px-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
                onChange={e => setCustomForm(f => ({ ...f, name: e.target.value }))}
              />
              <div className="flex items-center gap-2">
                <DatePicker value={customForm.startDate} onChange={val => setCustomForm(f => ({ ...f, startDate: val ?? '' }))} />
                <span className="text-xs text-slate-400">to</span>
                <DatePicker value={customForm.endDate} onChange={val => setCustomForm(f => ({ ...f, endDate: val ?? '' }))} />
                <button className="text-sm font-bold text-primary hover:underline whitespace-nowrap" onClick={handleAddCustom}>
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Grouped by year */}
          {!hasHolidays && (
            <p className="text-xs text-slate-400 italic">No holidays found for the selected regions.</p>
          )}
          {Object.entries(allHolidays).sort().map(([year, holidays]) => (
            <div key={year}>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 mt-1">{year}</div>
              <div className="flex flex-col gap-1">
                {holidays.map(h => {
                  const color = h.region === 'Custom' ? '#9e9f95' : regionColor(h.region)
                  return (
                    <div key={h.id} className="flex items-center gap-2 rounded-lg bg-white border border-outline-variant/15 px-2.5 py-1.5">
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span className="flex-1 text-xs font-semibold text-on-background truncate">{h.name}</span>
                      <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                        {h.startDate}{h.endDate && h.endDate !== h.startDate ? ` – ${h.endDate}` : ''}
                      </span>
                      <span className="text-xs font-bold rounded px-1.5 py-0.5 flex-shrink-0" style={{ background: color + '18', color }}>
                        {h.region}
                      </span>
                      {h.source === 'custom' && (
                        <button onClick={() => onRemoveHoliday(h.id)} title="Remove custom holiday">
                          <span className="material-symbols-outlined text-slate-300 hover:text-error transition-colors" style={{ fontSize: 14 }}>close</span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Card 2: Releases & Milestones ───────────────────────────────────────────
function MilestoneRow({ ms, onNameChange, onDateChange, onDelete, dragHandlers }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg bg-white border border-outline-variant/20 px-2 py-1.5"
      draggable
      {...dragHandlers}
    >
      <span className="material-symbols-outlined text-slate-300 text-base cursor-grab select-none">
        drag_indicator
      </span>
      <input
        type="text"
        defaultValue={ms.name}
        placeholder="Milestone name"
        className="flex-1 text-sm font-semibold bg-transparent border-none outline-none min-w-0"
        onChange={e => onNameChange(ms.id, e.target.value)}
      />
      <DatePicker
        value={ms.date ?? ''}
        onChange={val => onDateChange(ms.id, val || null)}
      />
      <button className="flex-shrink-0" onClick={() => onDelete(ms.id)}>
        <span className="material-symbols-outlined text-base text-slate-300 hover:text-error transition-colors">
          close
        </span>
      </button>
    </div>
  )
}

function ReleaseCard({
  release, index,
  onUpdateRelease, onRemoveRelease,
  onAddMilestone, onUpdateMilestone, onRemoveMilestone, onReorderMilestone,
  openDialog,
}) {
  const [editingName, setEditingName] = useState(false)
  const dragSrcRef = useRef(null)
  const sorted = [...(release.milestones ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const color = release.color || RELEASE_COLORS[index % RELEASE_COLORS.length]

  const makeDragHandlers = ms => ({
    onDragStart: e => {
      dragSrcRef.current = ms
      e.currentTarget.style.opacity = '0.4'
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragEnd: e => {
      e.currentTarget.style.opacity = ''
      dragSrcRef.current = null
    },
    onDragOver: e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' },
    onDrop: e => {
      e.preventDefault()
      const src = dragSrcRef.current
      if (!src || src.id === ms.id) return
      onReorderMilestone(release.id, src.id, ms.id)
    },
  })

  return (
    <div className="bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/20 shadow-sm">
      {/* Card header — color accent + editable name */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-outline-variant/20"
        style={{ background: color + '18' }}
      >
        {/* Color swatch */}
        <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />

        {/* Editable release name */}
        {editingName ? (
          <input
            autoFocus
            className="flex-1 text-sm font-bold bg-transparent border-b border-outline-variant/40 outline-none min-w-0"
            defaultValue={release.name}
            onBlur={e => { onUpdateRelease(release.id, { name: e.target.value }); setEditingName(false) }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur() }}
          />
        ) : (
          <span
            className="flex-1 text-sm font-bold text-on-background cursor-pointer hover:underline"
            title="Click to rename"
            onClick={() => setEditingName(true)}
          >
            {release.name || 'Untitled Release'}
          </span>
        )}

        {/* Color picker */}
        <label title="Release color" className="flex-shrink-0 cursor-pointer">
          <input
            type="color"
            value={color}
            className="w-0 h-0 opacity-0 absolute"
            onChange={e => onUpdateRelease(release.id, { color: e.target.value })}
          />
          <span className="material-symbols-outlined text-base text-slate-400 hover:text-slate-600 transition-colors">palette</span>
        </label>

        {/* Remove release button */}
        <button
          className="flex-shrink-0"
          onClick={() => openDialog({
            type: 'confirm',
            title: `Remove "${release.name}"?`,
            message: 'This will remove the release and clear its assignment from all linked initiatives, epics, and tasks.',
            onConfirm: () => onRemoveRelease(release.id),
          })}
          title="Remove release"
        >
          <span className="material-symbols-outlined text-base text-slate-300 hover:text-error transition-colors">delete</span>
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Date range */}
        <div className="flex items-center gap-4">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide w-28 shrink-0">Start Date</label>
          <DatePicker
            value={release.startDate ?? ''}
            onChange={val => onUpdateRelease(release.id, { startDate: val || null })}
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide w-28 shrink-0">End Date</label>
          <DatePicker
            value={release.endDate ?? ''}
            onChange={val => onUpdateRelease(release.id, { endDate: val || null })}
          />
        </div>

        {/* Milestones */}
        {sorted.length > 0 && (
          <div className="flex flex-col gap-2">
            {sorted.map(ms => (
              <MilestoneRow
                key={ms.id}
                ms={ms}
                onNameChange={(id, name) => onUpdateMilestone(id, { name })}
                onDateChange={(id, val) => onUpdateMilestone(id, { date: val })}
                onDelete={onRemoveMilestone}
                dragHandlers={makeDragHandlers(ms)}
              />
            ))}
          </div>
        )}

        <button
          className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline self-start"
          onClick={() => onAddMilestone(release.id)}
        >
          <span className="material-symbols-outlined text-base">add</span>
          Add Milestone
        </button>
      </div>
    </div>
  )
}

// ─── Project switcher header ──────────────────────────────────────────────────
function ProjectSwitcher({ meta, onSwitch, onCreate }) {
  const [open, setOpen] = useState(false)
  const activeProject = meta.projects.find(p => p.id === meta.activeProjectId)

  return (
    <div className="flex items-center gap-3 px-6 pt-5 pb-3 border-b border-outline-variant/20 bg-surface-container-low relative">
      {/* Current project name + dropdown trigger */}
      <button
        className="flex items-center gap-2 text-sm font-bold text-on-background hover:text-primary transition-colors"
        onClick={() => setOpen(v => !v)}
        title="Switch project"
      >
        <span className="material-symbols-outlined text-base text-slate-400">folder_open</span>
        {activeProject?.name || 'Untitled Project'}
        <span className="material-symbols-outlined text-base text-slate-400" style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          expand_more
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-6 top-full mt-1 z-20 bg-white border border-outline-variant/30 rounded-xl shadow-lg overflow-hidden min-w-56">
            {meta.projects.map(p => (
              <button
                key={p.id}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-surface-container transition-colors ${
                  p.id === meta.activeProjectId ? 'font-bold text-primary bg-primary/5' : 'font-semibold text-on-background'
                }`}
                onClick={() => { onSwitch(p.id); setOpen(false) }}
              >
                <span className="material-symbols-outlined text-base text-slate-400">folder</span>
                {p.name}
                {p.id === meta.activeProjectId && (
                  <span className="material-symbols-outlined text-sm text-primary ml-auto">check</span>
                )}
              </button>
            ))}
            <div className="border-t border-outline-variant/20" />
            <button
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-surface-container transition-colors"
              onClick={() => { onCreate(); setOpen(false) }}
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              New Project
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function ProjectView() {
  const {
    meta, data, updateProject,
    createProject, switchProject,
    addRelease, updateRelease, removeRelease,
    addMilestone, updateMilestone, removeMilestone,
    updateRegions, addHoliday, removeHoliday,
  } = useDataStore()
  const { openDialog, clearScenario, closePanel } = useUIStore()
  const project = data.project
  const releases = [...(project.releases ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const handleSwitchProject = (id) => {
    closePanel?.()
    clearScenario?.()
    switchProject(id)
  }

  const handleNewProject = () => {
    openDialog({
      type: 'prompt',
      title: 'New Project',
      message: 'Give this project a name:',
      defaultValue: 'New Project',
      onConfirm: name => {
        if (!name?.trim()) return
        openDialog({
          type: 'prompt',
          title: 'Start Date',
          message: 'Enter the project start date (YYYY-MM-DD):',
          defaultValue: new Date().toISOString().slice(0, 10),
          onConfirm: startDate => {
            closePanel?.()
            clearScenario?.()
            createProject(name.trim(), startDate?.trim() || undefined)
          },
        })
      },
    })
  }

  // ── Project field updates ──────────────────────────────────────────────────
  const handleUpdateProject = useCallback(updates => {
    updateProject(updates)
  }, [updateProject])

  // ── Release actions ────────────────────────────────────────────────────────
  const handleAddRelease = useCallback(() => {
    const idx = (project.releases ?? []).length
    addRelease({
      name: 'New Release',
      color: RELEASE_COLORS[idx % RELEASE_COLORS.length],
    })
  }, [addRelease, project.releases])

  const handleUpdateRelease = useCallback((id, updates) => {
    updateRelease(id, updates)
  }, [updateRelease])

  const handleRemoveRelease = useCallback(id => {
    removeRelease(id)
  }, [removeRelease])

  // ── Milestone actions (scoped to release) ──────────────────────────────────
  const handleAddMilestone = useCallback(releaseId => {
    addMilestone(releaseId, { name: '', date: null })
  }, [addMilestone])

  const handleUpdateMilestone = useCallback((id, updates) => {
    updateMilestone(id, updates)
  }, [updateMilestone])

  const handleRemoveMilestone = useCallback(id => {
    removeMilestone(id)
  }, [removeMilestone])

  const handleReorderMilestone = useCallback((releaseId, srcId, tgtId) => {
    const release = (project.releases ?? []).find(r => r.id === releaseId)
    if (!release) return
    const src = release.milestones?.find(m => m.id === srcId)
    const tgt = release.milestones?.find(m => m.id === tgtId)
    if (!src || !tgt) return
    updateMilestone(srcId, { order: tgt.order })
    updateMilestone(tgtId, { order: src.order })
  }, [project.releases, updateMilestone])

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <ProjectSwitcher
        meta={meta}
        onSwitch={handleSwitchProject}
        onCreate={handleNewProject}
      />
      <div className="grid grid-cols-2 gap-6 p-6">
        <TimelineCard
          project={project}
          onUpdate={handleUpdateProject}
          onUpdateRegions={updateRegions}
          onAddHoliday={addHoliday}
          onRemoveHoliday={removeHoliday}
        />

        {/* Release cards */}
        {releases.map((release, idx) => (
          <ReleaseCard
            key={release.id}
            release={release}
            index={idx}
            onUpdateRelease={handleUpdateRelease}
            onRemoveRelease={handleRemoveRelease}
            onAddMilestone={handleAddMilestone}
            onUpdateMilestone={handleUpdateMilestone}
            onRemoveMilestone={handleRemoveMilestone}
            onReorderMilestone={handleReorderMilestone}
            openDialog={openDialog}
          />
        ))}

        {/* Add release */}
        <button
          className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline self-start"
          onClick={handleAddRelease}
        >
          <span className="material-symbols-outlined text-base">add_circle</span>
          Add Release
        </button>

      </div>
    </div>
  )

}
