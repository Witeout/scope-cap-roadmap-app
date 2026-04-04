import { useState, useRef, useCallback } from 'react'
import { useDataStore } from '../../store/dataStore'
import DatePicker from '../ui/DatePicker'

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

// ─── Card 2: Milestones ───────────────────────────────────────────────────────
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
      <button
        className="flex-shrink-0"
        onClick={() => onDelete(ms.id)}
      >
        <span className="material-symbols-outlined text-base text-slate-300 hover:text-error transition-colors">
          close
        </span>
      </button>
    </div>
  )
}

function MilestonesCard({ project, onAddMilestone, onUpdateMilestone, onRemoveMilestone, onReorderMilestone }) {
  const dragSrcRef = useRef(null)
  const sorted = [...(project.milestones ?? [])].sort((a, b) => a.order - b.order)

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
    onDragOver: e => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    },
    onDrop: e => {
      e.preventDefault()
      const src = dragSrcRef.current
      if (!src || src.id === ms.id) return
      onReorderMilestone(src.id, ms.id)
    },
  })

  return (
    <Card title="Major Milestones" icon="flag">
      <div className="flex flex-col gap-2">
        {sorted.map(ms => (
          <MilestoneRow
            key={ms.id}
            ms={ms}
            onNameChange={onUpdateMilestone}
            onDateChange={(id, val) => onUpdateMilestone(id, null, val)}
            onDelete={onRemoveMilestone}
            dragHandlers={makeDragHandlers(ms)}
          />
        ))}
      </div>
      <button
        className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline mt-1 self-start"
        onClick={onAddMilestone}
      >
        <span className="material-symbols-outlined text-base">add</span>
        Add Milestone
      </button>
    </Card>
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
  const { data, updateProject, updateMilestone, addMilestone, removeMilestone } = useDataStore()
  const project = data.project

  // ── Project field updates ──────────────────────────────────────────────────
  const handleUpdateProject = useCallback(updates => {
    updateProject(updates)
  }, [updateProject])

  // ── Milestone actions ──────────────────────────────────────────────────────
  const handleAddMilestone = useCallback(() => {
    addMilestone({ name: '', date: null, fixed: false })
    // Focus the new name input after mount
    setTimeout(() => {
      const inputs = document.querySelectorAll('[data-milestone-row] input[type="text"]')
      if (inputs.length) inputs[inputs.length - 1].focus()
    }, 50)
  }, [addMilestone])

  const handleUpdateMilestone = useCallback((id, name, date) => {
    const updates = {}
    if (name  !== null && name  !== undefined) updates.name = name
    if (date  !== undefined)                   updates.date = date
    updateMilestone(id, updates)
  }, [updateMilestone])

  const handleRemoveMilestone = useCallback(id => {
    removeMilestone(id)
  }, [removeMilestone])

  const handleReorderMilestone = useCallback((srcId, tgtId) => {
    const milestones = project.milestones ?? []
    const src = milestones.find(m => m.id === srcId)
    const tgt = milestones.find(m => m.id === tgtId)
    if (!src || !tgt) return
    // Swap orders
    updateMilestone(srcId, { order: tgt.order })
    updateMilestone(tgtId, { order: src.order })
  }, [project.milestones, updateMilestone])

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-6 max-w-2xl">
        <TimelineCard
          project={project}
          onUpdate={handleUpdateProject}
        />
        <MilestonesCard
          project={project}
          onAddMilestone={handleAddMilestone}
          onUpdateMilestone={handleUpdateMilestone}
          onRemoveMilestone={handleRemoveMilestone}
          onReorderMilestone={handleReorderMilestone}
        />
        <BufferCard
          project={project}
          onUpdate={handleUpdateProject}
        />
      </div>
    </div>
  )
}
