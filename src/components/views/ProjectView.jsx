import { useState, useRef, useCallback } from 'react'
import { useDataStore } from '../../store/dataStore'
import DatePicker from '../ui/DatePicker'

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

// ─── Card 1: Project Timeline ─────────────────────────────────────────────────
function TimelineCard({ project, onUpdate }) {
  const [startDate, setStartDate] = useState(project.startDate ?? '')
  const [endDate,   setEndDate]   = useState(project.endDate   ?? '')
  const [ongoing,   setOngoing]   = useState(project.ongoing   ?? true)

  const handleStartChange = e => {
    const val = e.target.value || '2026-01-01'
    setStartDate(val)
    onUpdate({ startDate: val })
  }

  const handleEndChange = e => {
    const val = e.target.value || null
    setEndDate(val ?? '')
    onUpdate({ endDate: val })
  }

  const handleOngoingChange = e => {
    const checked = e.target.checked
    setOngoing(checked)
    if (checked) {
      setEndDate('')
      onUpdate({ ongoing: true, endDate: null })
    } else {
      onUpdate({ ongoing: false })
    }
  }

  return (
    <Card title="Project Timeline" icon="calendar_month">
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
            <input
              type="checkbox"
              checked={ongoing}
              className="accent-primary cursor-pointer"
              onChange={handleOngoingChange}
            />
            Ongoing
          </label>
        </div>
      </FieldRow>
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
          onClick={() => { if (window.confirm(`Remove release "${release.name}"?`)) onRemoveRelease(release.id) }}
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

// ─── Card 3: Capacity Buffer ──────────────────────────────────────────────────
function BufferCard({ project, onUpdate }) {
  const [value, setValue] = useState(project.bufferPercent ?? 0)

  const handleChange = e => {
    const val = Math.max(0, Math.min(100, +e.target.value || 0))
    setValue(val)
    onUpdate({ bufferPercent: val })
  }

  return (
    <Card title="Capacity Buffer" icon="tune">
      <p className="text-sm text-slate-500">
        Reserves a percentage of total capacity across all disciplines. Affects the capacity tooltip in Roadmap View.
      </p>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min="0"
          max="100"
          step="1"
          value={value}
          className="w-20 text-sm font-semibold bg-slate-50 border border-outline-variant/30 rounded-lg py-1.5 px-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
          onChange={handleChange}
        />
        <span className="text-sm font-bold text-slate-600">% reserved</span>
      </div>
    </Card>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function ProjectView() {
  const {
    data, updateProject,
    addRelease, updateRelease, removeRelease,
    addMilestone, updateMilestone, removeMilestone,
  } = useDataStore()
  const project = data.project
  const releases = [...(project.releases ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

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
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-6 max-w-2xl">
        <TimelineCard
          project={project}
          onUpdate={handleUpdateProject}
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

        <BufferCard
          project={project}
          onUpdate={handleUpdateProject}
        />
      </div>
    </div>
  )
}
