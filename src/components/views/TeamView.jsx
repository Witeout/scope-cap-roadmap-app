import { useState, useCallback } from 'react'
import { useDataStore } from '../../store/dataStore'
import { memberAvailableHours } from '../../lib/capacity'
import { initials, avatarBg, avatarColor } from '../../lib/display'

const DISCIPLINES = ['Art', 'Animation', 'Audio', 'Design', 'Code', 'UX', 'UI', 'VFX', 'VO']
const TEAM_GROUP_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

// ─── Team group card ──────────────────────────────────────────────────────────
function TeamGroupCard({ group, teamMembers, onUpdate, onAddMember, onRemoveMember, onDelete }) {
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(group.name)
  const [selectedMemberId, setSelectedMemberId] = useState('')

  // Members not yet in this group
  const availableMembers = teamMembers.filter(m => !group.members.some(gm => gm.memberId === m.id))

  const handleNameChange = () => {
    const trimmed = name.trim() || group.name
    onUpdate(group.id, { name: trimmed })
    setName(trimmed)
    setEditingName(false)
  }

  const handleAddMember = () => {
    if (selectedMemberId) {
      onAddMember(group.id, selectedMemberId, 100)
      setSelectedMemberId('')
    }
  }

  const handleAllocationChange = (memberId, value) => {
    onUpdate(group.id, {
      members: group.members.map(m =>
        m.memberId === memberId ? { ...m, allocation: +value } : m
      )
    })
  }

  return (
    <div className="bg-white rounded-xl border border-outline-variant/20 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-100">
        <div
          className="w-4 h-4 rounded-full flex-shrink-0"
          style={{ background: group.color, cursor: 'pointer' }}
          onClick={() => {
            const idx = TEAM_GROUP_COLORS.indexOf(group.color)
            const nextIdx = (idx + 1) % TEAM_GROUP_COLORS.length
            onUpdate(group.id, { color: TEAM_GROUP_COLORS[nextIdx] })
          }}
          title="Click to change color"
        />
        {editingName ? (
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleNameChange}
            onKeyDown={e => { if (e.key === 'Enter') handleNameChange() }}
            className="flex-1 text-sm font-bold text-on-background bg-transparent border-none outline-none focus:bg-slate-50 focus:px-2 focus:rounded transition-all"
          />
        ) : (
          <span
            className="flex-1 text-sm font-bold text-on-background cursor-pointer hover:bg-slate-50 px-2 rounded transition-all"
            onClick={() => setEditingName(true)}
          >
            {group.name}
          </span>
        )}
        <button
          className="p-1.5 text-slate-300 hover:text-error hover:bg-error/10 rounded-lg transition-all flex-shrink-0"
          title="Delete team"
          onClick={() => onDelete(group.id)}
        >
          <span className="material-symbols-outlined text-lg">delete</span>
        </button>
      </div>

      {/* Members */}
      <div className="p-4 space-y-3">
        {group.members.length > 0 ? (
          <>
            {group.members.map(gm => {
              const member = teamMembers.find(m => m.id === gm.memberId)
              if (!member) return null
              return (
                <div key={gm.memberId} className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                    style={{ background: avatarBg(member.name), color: avatarColor(member.name) }}
                  >
                    {initials(member.name)}
                  </div>
                  <span className="text-xs font-medium text-on-background flex-1">{member.name}</span>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={[0, 25, 50, 100].includes(gm.allocation) ? gm.allocation : 100}
                      onChange={e => handleAllocationChange(gm.memberId, e.target.value)}
                      className="text-xs font-semibold bg-slate-50 border border-outline-variant/30 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    >
                      {[0, 25, 50, 100].map(v => (
                        <option key={v} value={v}>{v}%</option>
                      ))}
                    </select>
                    <button
                      className="p-0.5 text-slate-300 hover:text-error hover:bg-error/10 rounded transition-all"
                      onClick={() => onRemoveMember(group.id, gm.memberId)}
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </>
        ) : (
          <p className="text-xs text-slate-400 italic">No members yet</p>
        )}

        {/* Add member selector */}
        {availableMembers.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <select
              value={selectedMemberId}
              onChange={e => setSelectedMemberId(e.target.value)}
              className="flex-1 appearance-none text-xs font-semibold bg-slate-50 border border-outline-variant/30 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="">Add member…</option>
              {availableMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <button
              className="p-1.5 text-slate-300 hover:text-primary hover:bg-primary/10 rounded transition-all flex-shrink-0"
              onClick={handleAddMember}
              disabled={!selectedMemberId}
            >
              <span className="material-symbols-outlined text-lg">add</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Individual member card ───────────────────────────────────────────────────
const ALLOC_OPTIONS = [0, 25, 50, 100]

function MemberCard({ member, sprintCount, onDelete, teamGroups, onAddToTeam, onUpdateTeamAlloc, onRemoveFromTeam, allocationPct }) {
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
  const [selectedGroupId, setSelectedGroupId] = useState('')

  // Teams this member belongs to / can still be added to
  const memberGroups   = teamGroups.filter(g => g.members.some(gm => gm.memberId === member.id))
  const availableGroups = teamGroups.filter(g => !g.members.some(gm => gm.memberId === member.id))

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
        {allocationPct !== undefined && (
          <span className={`text-xs font-semibold flex-shrink-0 px-1.5 ${allocationPct > 100 ? 'text-error' : 'text-slate-400'}`}>
            {allocationPct}%
          </span>
        )}
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

        {teamGroups.length > 0 && (
          <div className="col-span-2">
            <label className="field-label">Teams</label>
            <div className="space-y-1.5">
              {memberGroups.length > 0 ? memberGroups.map(g => {
                const gm = g.members.find(m => m.memberId === member.id)
                const allocVal = ALLOC_OPTIONS.includes(gm.allocation) ? gm.allocation : 100
                return (
                  <div key={g.id} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: g.color }} />
                    <span className="text-xs font-medium text-on-background flex-1 truncate">{g.name}</span>
                    <select
                      value={allocVal}
                      onChange={e => onUpdateTeamAlloc(g.id, member.id, +e.target.value)}
                      className="text-xs font-semibold bg-slate-50 border border-outline-variant/30 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    >
                      {ALLOC_OPTIONS.map(v => (
                        <option key={v} value={v}>{v}%</option>
                      ))}
                    </select>
                    <button
                      className="p-0.5 text-slate-300 hover:text-error hover:bg-error/10 rounded transition-all"
                      onClick={() => onRemoveFromTeam(g.id, member.id)}
                      title="Remove from team"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                )
              }) : (
                <p className="text-xs text-slate-400 italic">No teams assigned</p>
              )}

              {availableGroups.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <select
                    value={selectedGroupId}
                    onChange={e => setSelectedGroupId(e.target.value)}
                    className="flex-1 appearance-none text-xs font-semibold bg-slate-50 border border-outline-variant/30 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    <option value="">Add to team…</option>
                    {availableGroups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <button
                    className="p-1 text-slate-300 hover:text-primary hover:bg-primary/10 rounded transition-all flex-shrink-0"
                    onClick={() => {
                      if (selectedGroupId) {
                        onAddToTeam(selectedGroupId, member.id, 100)
                        setSelectedGroupId('')
                      }
                    }}
                    disabled={!selectedGroupId}
                    title="Add to team"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
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
  const { data, sprints, createItem, removeItem, createTeamGroup, updateTeamGroup, removeTeamGroup, addTeamGroupMember, updateTeamGroupMember, removeTeamGroupMember } = useDataStore()
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [pendingDeleteGroupId, setPendingDeleteGroupId] = useState(null)

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

  const handleAddTeamGroup = () => {
    const colorIdx = data.teamGroups.length % TEAM_GROUP_COLORS.length
    createTeamGroup('New Team', TEAM_GROUP_COLORS[colorIdx])
  }

  const handleDeleteConfirm = () => {
    if (pendingDeleteId) removeItem('member', pendingDeleteId)
    setPendingDeleteId(null)
  }

  const handleDeleteGroupConfirm = () => {
    if (pendingDeleteGroupId) removeTeamGroup(pendingDeleteGroupId)
    setPendingDeleteGroupId(null)
  }

  // Calculate per-member allocation totals
  const memberAllocations = {}
  data.teamGroups.forEach(group => {
    group.members.forEach(gm => {
      memberAllocations[gm.memberId] = (memberAllocations[gm.memberId] || 0) + gm.allocation
    })
  })

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Teams Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-on-surface-variant">
            {data.teamGroups.length} team group{data.teamGroups.length !== 1 ? 's' : ''}
          </span>
          <button
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-1.5 rounded-lg font-semibold text-sm hover:bg-primary-dim transition-all active:scale-95"
            onClick={handleAddTeamGroup}
          >
            <span className="material-symbols-outlined text-base">group_add</span>
            New Team
          </button>
        </div>

        {data.teamGroups.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm italic">No team groups yet</div>
        ) : (
          <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {data.teamGroups.map(group => (
              <TeamGroupCard
                key={group.id}
                group={group}
                teamMembers={data.team}
                onUpdate={updateTeamGroup}
                onAddMember={addTeamGroupMember}
                onRemoveMember={removeTeamGroupMember}
                onDelete={id => setPendingDeleteGroupId(id)}
              />
            ))}
          </div>
        )}

      </div>

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
              teamGroups={data.teamGroups}
              onAddToTeam={addTeamGroupMember}
              onUpdateTeamAlloc={updateTeamGroupMember}
              onRemoveFromTeam={removeTeamGroupMember}
              allocationPct={memberAllocations[m.id] || 0}
            />
          ))}
        </div>
      )}

      {/* Delete member confirmation modal */}
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

      {/* Delete team group confirmation modal */}
      {pendingDeleteGroupId && (() => {
        const group = data.teamGroups.find(g => g.id === pendingDeleteGroupId)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-error text-2xl">delete</span>
                <span className="font-bold text-on-background text-base">Delete team group?</span>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                <span className="font-semibold">"{group?.name}"</span> will be permanently removed. Items assigned to this team will be unassigned.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
                  onClick={() => setPendingDeleteGroupId(null)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-error text-white hover:bg-error/90 transition-colors"
                  onClick={handleDeleteGroupConfirm}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
