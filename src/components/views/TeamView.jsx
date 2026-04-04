import { useState, useCallback } from 'react'
import { useDataStore } from '../../store/dataStore'
import { memberAvailableHours } from '../../lib/capacity'
import { initials, avatarBg, avatarColor } from '../../lib/display'

const DISCIPLINES = ['Art', 'Animation', 'Audio', 'Design', 'Code', 'UX', 'UI', 'VFX', 'VO']

// ─── Individual member card ───────────────────────────────────────────────────
function MemberCard({ member, sprintCount, onDelete }) {
  const { updateItem } = useDataStore()

  // Local form state — mirrors the stored member. Saves to store on blur.
  const [fields, setFields] = useState({
    name:          member.name          ?? '',
    hoursPerSprint: member.hoursPerSprint ?? 0,
    statHolidays:  member.statHolidays  ?? 0,
    ptoDays:       member.ptoDays       ?? 0,
    sickDays:      member.sickDays      ?? 0,
    discipline:    member.discipline    ?? '',
  })

  // Live-computed capacity from local fields (no store round-trip needed)
  const liveAvail = memberAvailableHours({ ...member, ...fields }, sprintCount)
  const gross     = sprintCount * (+fields.hoursPerSprint || 0)
  const totalDays = (+fields.statHolidays || 0) + (+fields.ptoDays || 0) + (+fields.sickDays || 0)
  const pct       = gross > 0 ? Math.round((liveAvail / gross) * 100) : 0
  const barColor  = pct >= 70 ? 'bg-secondary' : pct >= 40 ? 'bg-tertiary-fixed' : 'bg-error'

  const avBg    = avatarBg(fields.name)
  const avColor = avatarColor(fields.name)
  const avText  = initials(fields.name || '?')

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleNameBlur = useCallback(() => {
    const val = fields.name.trim() || 'Unnamed'
    setFields(f => ({ ...f, name: val }))
    updateItem('member', member.id, { name: val })
  }, [fields.name, member.id, updateItem])

  const handleNumberBlur = useCallback(field => {
    const val = +fields[field] || 0
    updateItem('member', member.id, { [field]: val })
  }, [fields, member.id, updateItem])

  const handleDisciplineChange = useCallback(e => {
    const val = e.target.value || null
    setFields(f => ({ ...f, discipline: val ?? '' }))
    updateItem('member', member.id, { discipline: val })
  }, [member.id, updateItem])

  const setField = (key, value) => setFields(f => ({ ...f, [key]: value }))

  return (
    <div className="bg-white rounded-xl border border-outline-variant/20 shadow-sm overflow-hidden" data-member-id={member.id}>
      {/* Card header — avatar + name + delete */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-100">
        <div
          className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
          style={{ background: avBg, color: avColor }}
        >
          {avText}
        </div>
        <input
          type="text"
          className="flex-1 text-sm font-bold text-on-background bg-transparent border-none outline-none focus:bg-slate-50 focus:px-2 focus:rounded-lg transition-all"
          value={fields.name}
          placeholder="Member name"
          onChange={e => setField('name', e.target.value)}
          onBlur={handleNameBlur}
        />
        <button
          className="p-1.5 text-slate-300 hover:text-error hover:bg-error/10 rounded-lg transition-all flex-shrink-0"
          title="Delete member"
          onClick={() => onDelete(member.id)}
        >
          <span className="material-symbols-outlined text-lg">delete</span>
        </button>
      </div>

      {/* Number + discipline fields */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {[
          { label: 'Hours / Sprint',       field: 'hoursPerSprint', min: 0, max: 80  },
          { label: 'Stat Holidays (days)', field: 'statHolidays',  min: 0, max: 365 },
          { label: 'PTO Days',             field: 'ptoDays',       min: 0, max: 365 },
          { label: 'Sick Days',            field: 'sickDays',      min: 0, max: 365 },
        ].map(({ label, field, min, max }) => (
          <div key={field}>
            <label className="field-label">{label}</label>
            <input
              type="number"
              min={min}
              max={max}
              className="w-full text-sm bg-slate-50 border border-outline-variant/30 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              value={fields[field]}
              onChange={e => setField(field, e.target.value)}
              onBlur={() => handleNumberBlur(field)}
            />
          </div>
        ))}

        <div className="col-span-2">
          <label className="field-label">Discipline</label>
          <select
            className="w-full appearance-none text-sm font-semibold bg-slate-50 border border-outline-variant/30 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
            value={fields.discipline ?? ''}
            onChange={handleDisciplineChange}
          >
            <option value="">— Select —</option>
            {DISCIPLINES.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Capacity summary */}
      <div className="px-4 pb-4">
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xl font-extrabold text-on-background font-headline">{liveAvail}</span>
            <span className="text-xs font-semibold text-slate-400">available hours / year</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-slate-400">
            ({sprintCount} sprints × {+fields.hoursPerSprint || 0}h) − ({totalDays} days × 6h)
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function TeamView() {
  const { data, sprints, createItem, removeItem } = useDataStore()
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  const sprintCount = sprints.length

  const handleAddMember = () => {
    createItem('member', {
      name: 'New Member',
      hoursPerSprint: 40,
      statHolidays: 11,
      ptoDays: 15,
      sickDays: 5,
      discipline: null,
    })
    // Focus the new card's name input after it mounts
    setTimeout(() => {
      const cards = document.querySelectorAll('[data-member-id]')
      const last  = cards[cards.length - 1]
      const input = last?.querySelector('input[type="text"]')
      if (input) { input.focus(); input.select() }
    }, 50)
  }

  const handleDeleteConfirm = () => {
    if (pendingDeleteId) removeItem('member', pendingDeleteId)
    setPendingDeleteId(null)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm font-bold text-on-surface-variant">
          {data.team.length} member{data.team.length !== 1 ? 's' : ''}
        </span>
        <button
          className="flex items-center gap-2 bg-primary text-on-primary px-4 py-1.5 rounded-lg font-semibold text-sm hover:bg-primary-dim transition-all active:scale-95"
          onClick={handleAddMember}
        >
          <span className="material-symbols-outlined text-base">person_add</span>
          Add Member
        </button>
      </div>

      {/* Empty state */}
      {data.team.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="material-symbols-outlined text-6xl text-outline-variant mb-4">group</span>
          <p className="text-base font-bold text-on-background mb-1 font-headline">No team members yet</p>
          <p className="text-sm text-slate-400 mb-6">Add your first team member to start tracking capacity.</p>
          <button
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-semibold text-sm hover:bg-primary-dim transition-all"
            onClick={handleAddMember}
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            Add Member
          </button>
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
        >
          {data.team.map(m => (
            <MemberCard
              key={m.id}
              member={m}
              sprintCount={sprintCount}
              onDelete={id => setPendingDeleteId(id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {pendingDeleteId && (() => {
        const member = data.team.find(m => m.id === pendingDeleteId)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-error text-2xl">delete</span>
                <span className="font-bold text-on-background text-base">Remove team member?</span>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                <span className="font-semibold">"{member?.name}"</span> will be permanently removed from the team.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
                  onClick={() => setPendingDeleteId(null)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-error text-white hover:bg-error/90 transition-colors"
                  onClick={handleDeleteConfirm}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
