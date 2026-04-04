import { useState, useMemo, useCallback, useRef } from 'react'
import { useDataStore } from '../../store/dataStore'
import { useUIStore }   from '../../store/uiStore'

// ─── Shared card shell ────────────────────────────────────────────────────────
function Card({ title, icon, children }) {
  return (
    <div className="bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/20 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-outline-variant/20">
        <span className="material-symbols-outlined text-slate-500 text-lg">{icon}</span>
        <span className="font-bold text-sm text-on-background">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getScenarioSchedule(scenarioId, data) {
  if (scenarioId === null) return data.tasks.map(t => ({ task: t, sprintId: t.sprintId }))
  const scn = data.scenarios.find(s => s.id === scenarioId)
  if (!scn) return data.tasks.map(t => ({ task: t, sprintId: t.sprintId }))
  const allTasks = [...data.tasks, ...(scn.tasks || [])]
  return allTasks.map(t => {
    const isMain = !!data.tasks.find(x => x.id === t.id)
    const spId   = isMain ? (scn.sprintOverrides[t.id] ?? t.sprintId) : t.sprintId
    return { task: t, sprintId: spId }
  })
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function SummaryView() {
  const { data, sprints, updateSummaryNote } = useDataStore()
  const { summaryBase, summaryTarget, setSummaryBase, setSummaryTarget, setView } = useUIStore()

  // Auto-init summaryTarget when scenarios exist
  const defaultTarget = data.scenarios[0]?.id ?? null
  const effectiveTarget = summaryTarget ?? defaultTarget

  const [localBase,   setLocalBase]   = useState(summaryBase   ?? 'main')
  const [localTarget, setLocalTarget] = useState(effectiveTarget ?? '')

  const handleBaseChange = useCallback(e => {
    setLocalBase(e.target.value)
    setSummaryBase(e.target.value)
  }, [setSummaryBase])

  const handleTargetChange = useCallback(e => {
    setLocalTarget(e.target.value)
    setSummaryTarget(e.target.value || null)
  }, [setSummaryTarget])

  // Derived IDs — computed before hooks so they can be used as memo deps
  const baseId   = localBase   === 'main' ? null : localBase
  const targetId = localTarget || null

  // Hooks must all appear before any early return (Rules of Hooks)
  const baseSched   = useMemo(() => getScenarioSchedule(baseId,   data), [baseId,   data])
  const targetSched = useMemo(() => getScenarioSchedule(targetId, data), [targetId, data])

  const noteKey    = `${localBase}__${targetId}`
  const notesTimer = useRef(null)
  const handleNotesChange = useCallback(e => {
    const val = e.target.value
    clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => updateSummaryNote(noteKey, val), 400)
  }, [noteKey, updateSummaryNote])

  // No scenarios yet — early return after all hooks
  if (data.scenarios.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
        <Card title="Compare Scenarios" icon="compare_arrows">
          <div className="flex items-center gap-3 py-3 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-tertiary text-lg">fork_right</span>
            <span>
              Create scenarios in the{' '}
              <button className="text-primary font-semibold hover:underline" onClick={() => setView('roadmap')}>
                Roadmap View
              </button>{' '}
              to start comparing.
            </span>
          </div>
        </Card>
      </div>
    )
  }

  const baseName   = baseId   ? (data.scenarios.find(s => s.id === baseId)?.name   ?? 'Unknown') : 'Main Roadmap'
  const targetName = targetId ? (data.scenarios.find(s => s.id === targetId)?.name ?? 'Unknown') : '—'

  const spIdx  = spId => sprints.findIndex(s => s.id === spId)
  const spLabel = spId => {
    const sp = sprints.find(s => s.id === spId)
    return sp ? `${sp.label} (${sp.dates})` : '—'
  }

  // ── Timeline metrics ───────────────────────────────────────────────────────
  const baseIdxs  = baseSched.filter(e => e.sprintId).map(e => spIdx(e.sprintId)).filter(i => i >= 0)
  const tgtIdxs   = targetSched.filter(e => e.sprintId).map(e => spIdx(e.sprintId)).filter(i => i >= 0)
  const bFirst    = baseIdxs.length ? Math.min(...baseIdxs) : -1
  const bLast     = baseIdxs.length ? Math.max(...baseIdxs) : -1
  const tFirst    = tgtIdxs.length  ? Math.min(...tgtIdxs)  : -1
  const tLast     = tgtIdxs.length  ? Math.max(...tgtIdxs)  : -1
  const bSpan     = bFirst >= 0 ? bLast - bFirst + 1 : 0
  const tSpan     = tFirst >= 0 ? tLast - tFirst + 1 : 0

  const diffCls = (a, b) => a !== b ? 'bg-tertiary-container/30' : ''

  // ── Task changes ───────────────────────────────────────────────────────────
  const baseMap = Object.fromEntries(baseSched.map(e => [e.task.id,   e.sprintId]))
  const tgtMap  = Object.fromEntries(targetSched.map(e => [e.task.id, e.sprintId]))
  const added   = data.tasks.filter(t => !baseMap[t.id]  && tgtMap[t.id])
  const removed = data.tasks.filter(t =>  baseMap[t.id]  && !tgtMap[t.id])
  const moved   = data.tasks.filter(t =>  baseMap[t.id]  && tgtMap[t.id] && baseMap[t.id] !== tgtMap[t.id])

  // ── Scope delta ────────────────────────────────────────────────────────────
  const baseEst  = baseSched.filter(e  => e.sprintId).reduce((s, e) => s + (e.task.estimate  || 0), 0)
  const tgtEst   = targetSched.filter(e => e.sprintId).reduce((s, e) => s + (e.task.estimate || 0), 0)
  const delta    = tgtEst - baseEst
  const pct      = baseEst > 0 ? Math.round((delta / baseEst) * 100) : null
  const deltaColor = delta > 0 ? '#9f403d' : delta < 0 ? '#57634c' : '#5e6058'
  const deltaSign  = delta > 0 ? '+' : ''

  const disciplines = [...new Set(data.tasks.map(t => t.discipline).filter(Boolean))].sort()

  const TaskRow = ({ t }) => (
    <div className="flex items-center gap-2 py-1 border-b border-outline-variant/10 last:border-0">
      <span className="text-xs text-on-background flex-1 min-w-0 truncate" title={t.summary}>{t.summary}</span>
      {t.discipline && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#e8e7df', color: '#5e6058' }}>
          {t.discipline}
        </span>
      )}
      {t.estimate != null && (
        <span className="text-[10px] text-on-surface-variant ml-1">{t.estimate}h</span>
      )}
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-6 max-w-3xl">

        {/* Card 1: Scenario selector */}
        <Card title="Compare Scenarios" icon="compare_arrows">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Base</label>
              <select
                className="w-full text-sm bg-white border border-outline-variant/30 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={localBase}
                onChange={handleBaseChange}
              >
                <option value="main">Main Roadmap</option>
                {data.scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Compare To</label>
              <select
                className="w-full text-sm bg-white border border-outline-variant/30 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={localTarget}
                onChange={handleTargetChange}
              >
                {data.scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </Card>

        {!targetId ? (
          <p className="text-sm text-on-surface-variant">Select a scenario to compare.</p>
        ) : baseId === targetId ? (
          <p className="text-sm text-on-surface-variant">Base and target are the same scenario.</p>
        ) : (<>

          {/* Card 2: Timeline */}
          <Card title="Timeline" icon="date_range">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    <th className="text-left py-1.5 pr-4 font-semibold w-40"></th>
                    <th className="text-left py-1.5 pr-4">{baseName}</th>
                    <th className="text-left py-1.5">{targetName}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={diffCls(bFirst, tFirst)}>
                    <td className="py-2 pr-4 text-xs font-semibold text-on-surface-variant">First Sprint</td>
                    <td className="py-2 pr-4 text-on-background font-medium">{bFirst >= 0 ? spLabel(sprints[bFirst].id) : 'No tasks scheduled'}</td>
                    <td className="py-2 text-on-background font-medium">{tFirst >= 0 ? spLabel(sprints[tFirst].id) : 'No tasks scheduled'}</td>
                  </tr>
                  <tr className={diffCls(bLast, tLast)}>
                    <td className="py-2 pr-4 text-xs font-semibold text-on-surface-variant">Last Sprint</td>
                    <td className="py-2 pr-4 text-on-background font-medium">{bLast >= 0 ? spLabel(sprints[bLast].id) : '—'}</td>
                    <td className="py-2 text-on-background font-medium">{tLast >= 0 ? spLabel(sprints[tLast].id) : '—'}</td>
                  </tr>
                  <tr className={diffCls(bSpan, tSpan)}>
                    <td className="py-2 pr-4 text-xs font-semibold text-on-surface-variant">Sprints Spanned</td>
                    <td className="py-2 pr-4 text-on-background font-medium">{bSpan > 0 ? bSpan : '—'}</td>
                    <td className="py-2 text-on-background font-medium">
                      {tSpan > 0 ? tSpan : '—'}
                      {tSpan > 0 && bSpan > 0 && tSpan !== bSpan && (
                        <span className={`ml-2 text-xs font-bold ${tSpan > bSpan ? 'text-tertiary' : 'text-secondary'}`}>
                          {tSpan > bSpan ? '+' : ''}{tSpan - bSpan}
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Card 3: Task Changes */}
          <Card title="Task Changes" icon="task_alt">
            <div className="flex gap-3 mb-4 flex-wrap">
              {added.length   > 0 && <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: '#57634c' }}>+{added.length} added</span>}
              {removed.length > 0 && <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: '#9f403d' }}>−{removed.length} removed</span>}
              {moved.length   > 0 && <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: '#7a583d' }}>↔ {moved.length} moved</span>}
              {!added.length && !removed.length && !moved.length && (
                <span className="text-sm text-on-surface-variant">No task schedule changes between these scenarios.</span>
              )}
            </div>
            {(added.length > 0 || removed.length > 0 || moved.length > 0) && (
              <div className={`grid gap-4 ${added.length > 0 && removed.length > 0 ? 'grid-cols-2' : ''}`}>
                {added.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">Added to Schedule</div>
                    <div className="text-xs max-h-48 overflow-y-auto">{added.map(t => <TaskRow key={t.id} t={t} />)}</div>
                  </div>
                )}
                {removed.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-error uppercase tracking-wider mb-2">Removed from Schedule</div>
                    <div className="text-xs max-h-48 overflow-y-auto">{removed.map(t => <TaskRow key={t.id} t={t} />)}</div>
                  </div>
                )}
                {moved.length > 0 && (
                  <div className="col-span-full">
                    <div className="text-xs font-bold text-tertiary uppercase tracking-wider mb-2">Moved to Different Sprint</div>
                    <div className="text-xs max-h-48 overflow-y-auto">
                      {moved.map(t => (
                        <div key={t.id} className="flex items-center gap-2 py-1 border-b border-outline-variant/10 last:border-0">
                          <span className="text-xs text-on-background flex-1 min-w-0 truncate" title={t.summary}>{t.summary}</span>
                          {t.discipline && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#e8e7df', color: '#5e6058' }}>{t.discipline}</span>}
                          <span className="text-[10px] text-on-surface-variant whitespace-nowrap">
                            {spLabel(baseMap[t.id])} → {spLabel(tgtMap[t.id])}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Card 4: Scope Delta */}
          <Card title="Scope Delta" icon="scale">
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: baseName,   val: `${baseEst}h`, color: '#31332c' },
                { label: targetName, val: `${tgtEst}h`,  color: '#31332c' },
                { label: 'Delta',    val: `${deltaSign}${delta}h`, color: deltaColor },
                { label: 'Change',   val: pct != null ? `${deltaSign}${pct}%` : '—', color: deltaColor },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-white rounded-lg border border-outline-variant/20 p-3 text-center">
                  <div className="text-xs font-semibold text-on-surface-variant mb-1 truncate" title={label}>{label}</div>
                  <div className="text-lg font-extrabold" style={{ color }}>{val}</div>
                </div>
              ))}
            </div>
            {disciplines.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/20">
                    <th className="text-left py-1.5">Discipline</th>
                    <th className="text-right py-1.5 pr-3">{baseName}</th>
                    <th className="text-right py-1.5 pr-3">{targetName}</th>
                    <th className="text-right py-1.5">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {disciplines.map(disc => {
                    const bH = baseSched.filter(e  => e.sprintId && e.task.discipline === disc).reduce((s, e) => s + (e.task.estimate || 0), 0)
                    const tH = targetSched.filter(e => e.sprintId && e.task.discipline === disc).reduce((s, e) => s + (e.task.estimate || 0), 0)
                    const d  = tH - bH
                    const dc = d > 0 ? '#9f403d' : d < 0 ? '#57634c' : '#b1b3a9'
                    return (
                      <tr key={disc} className="border-b border-outline-variant/10 last:border-0">
                        <td className="py-1.5 text-xs font-medium text-on-background">{disc}</td>
                        <td className="py-1.5 pr-3 text-right text-xs text-on-surface-variant">{bH}h</td>
                        <td className="py-1.5 pr-3 text-right text-xs text-on-surface-variant">{tH}h</td>
                        <td className="py-1.5 text-right text-xs font-bold" style={{ color: dc }}>
                          {d !== 0 ? `${d > 0 ? '+' : ''}${d}h` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Card>

          {/* Card 5: Notes */}
          <Card title="Update Notes" icon="edit_note">
            <textarea
              rows={6}
              className="w-full text-sm bg-white border border-outline-variant/30 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
              placeholder="Add notes about this comparison — key decisions, risks, stakeholder context..."
              defaultValue={data.summaryNotes?.[noteKey] ?? ''}
              onChange={handleNotesChange}
            />
          </Card>

        </>)}
      </div>
    </div>
  )
}
