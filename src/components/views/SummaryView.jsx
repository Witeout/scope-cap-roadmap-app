import { useState, useMemo, useCallback, useRef } from 'react'
import { useDataStore }     from '../../store/dataStore'
import { useUIStore }       from '../../store/uiStore'
import { useSnapshotStore } from '../../store/snapshotStore'

// ─── Shared card shell ─────────────────────────────────────────────────────────
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

// ─── Helpers ───────────────────────────────────────────────────────────────────
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

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── PDF export ────────────────────────────────────────────────────────────────
function exportSnapshotAsPDF(snap) {
  const added   = snap.added   || []
  const removed = snap.removed || []
  const moved   = snap.moved   || []

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Snapshot: ${escapeHtml(snap.label)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px; color: #1a1a1a; max-width: 900px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { font-size: 12px; color: #666; margin-bottom: 28px; }
    h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #888; border-bottom: 1px solid #eee; padding-bottom: 6px; margin: 28px 0 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 6px 8px; background: #f9f9f9; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; }
    .metrics { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .metric { border: 1px solid #e8e8e8; padding: 10px 20px; text-align: center; border-radius: 8px; }
    .metric .label { font-size: 11px; color: #888; font-weight: 600; }
    .metric .value { font-size: 22px; font-weight: 800; margin-top: 2px; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; color: white; margin: 0 4px 8px 0; }
    .added { background: #57634c; } .removed { background: #9f403d; } .moved { background: #7a583d; }
    ul { font-size: 12px; padding-left: 20px; margin: 0 0 14px; }
    li { margin: 3px 0; color: #333; }
    p { font-size: 13px; line-height: 1.6; white-space: pre-wrap; color: #333; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>📸 ${escapeHtml(snap.label)}</h1>
  <div class="meta">Saved ${new Date(snap.savedAt).toLocaleString()} &nbsp;·&nbsp; Comparing <strong>${escapeHtml(snap.baseName)}</strong> → <strong>${escapeHtml(snap.targetName)}</strong></div>

  <h2>Timeline</h2>
  <table>
    <thead><tr><th></th><th>${escapeHtml(snap.baseName)}</th><th>${escapeHtml(snap.targetName)}</th></tr></thead>
    <tbody>
      <tr><td>First Sprint</td><td>${escapeHtml(snap.bFirstLabel)}</td><td>${escapeHtml(snap.tFirstLabel)}</td></tr>
      <tr><td>Last Sprint</td><td>${escapeHtml(snap.bLastLabel)}</td><td>${escapeHtml(snap.tLastLabel)}</td></tr>
      <tr><td>Sprints Spanned</td><td>${snap.bSpan || '—'}</td><td>${snap.tSpan || '—'}</td></tr>
    </tbody>
  </table>

  <h2>Scope Delta</h2>
  <div class="metrics">
    <div class="metric"><div class="label">${escapeHtml(snap.baseName)}</div><div class="value">${snap.baseEst}h</div></div>
    <div class="metric"><div class="label">${escapeHtml(snap.targetName)}</div><div class="value">${snap.tgtEst}h</div></div>
    <div class="metric"><div class="label">Delta</div><div class="value" style="color:${snap.deltaColor}">${snap.deltaSign}${snap.delta}h</div></div>
    <div class="metric"><div class="label">Change</div><div class="value" style="color:${snap.deltaColor}">${snap.pct != null ? snap.deltaSign + snap.pct + '%' : '—'}</div></div>
  </div>
  ${snap.disciplineDeltas && snap.disciplineDeltas.length > 0 ? `
  <table>
    <thead><tr><th>Discipline</th><th>${escapeHtml(snap.baseName)}</th><th>${escapeHtml(snap.targetName)}</th><th>Delta</th></tr></thead>
    <tbody>
      ${snap.disciplineDeltas.map(d => `<tr>
        <td>${escapeHtml(d.discipline)}</td><td>${d.bH}h</td><td>${d.tH}h</td>
        <td style="color:${d.d > 0 ? '#9f403d' : d.d < 0 ? '#57634c' : '#b1b3a9'}">${d.d !== 0 ? (d.d > 0 ? '+' : '') + d.d + 'h' : '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  <h2>Task Changes</h2>
  ${added.length === 0 && removed.length === 0 && moved.length === 0
    ? '<p style="color:#888;">No task schedule changes between these scenarios.</p>'
    : ''}
  ${added.length   > 0 ? `<span class="badge added">+${added.length} added</span><ul>${added.map(t => `<li>${escapeHtml(t.summary)}${t.estimate ? ` · ${t.estimate}h` : ''}</li>`).join('')}</ul>` : ''}
  ${removed.length > 0 ? `<span class="badge removed">−${removed.length} removed</span><ul>${removed.map(t => `<li>${escapeHtml(t.summary)}${t.estimate ? ` · ${t.estimate}h` : ''}</li>`).join('')}</ul>` : ''}
  ${moved.length   > 0 ? `<span class="badge moved">↔ ${moved.length} moved</span><ul>${moved.map(t => `<li>${escapeHtml(t.summary)}: ${escapeHtml(t.fromSprintLabel)} → ${escapeHtml(t.toSprintLabel)}</li>`).join('')}</ul>` : ''}

  ${snap.notes ? `<h2>Notes</h2><p>${escapeHtml(snap.notes)}</p>` : ''}
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}

// ─── Save modal ────────────────────────────────────────────────────────────────
function SaveModal({ defaultLabel, onConfirm, onCancel }) {
  const [label, setLabel] = useState(defaultLabel)
  const inputRef = useRef(null)

  // Focus input on mount
  const refCb = useCallback(el => {
    if (el) { el.focus(); el.select() }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-primary text-xl">photo_camera</span>
          <span className="font-bold text-base text-on-background">Save Snapshot</span>
        </div>
        <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
          Label (optional)
        </label>
        <input
          ref={refCb}
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(label); if (e.key === 'Escape') onCancel() }}
          className="w-full text-sm bg-white border border-outline-variant/40 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 mb-5"
          placeholder="e.g. After Q3 scope cut"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-on-surface-variant rounded-lg hover:bg-surface-container transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(label)}
            className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:opacity-90 transition-opacity"
          >
            Save Snapshot
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Snapshots list ────────────────────────────────────────────────────────────
function SnapshotsList({ snapshots, onView, onDelete, onClose }) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-on-background transition-colors"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Back
            </button>
            <span className="text-on-surface-variant/40 text-sm">·</span>
            <span className="font-bold text-sm text-on-background">Saved Snapshots</span>
            <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full ml-1">
              {snapshots.length}
            </span>
          </div>
        </div>

        {snapshots.length === 0 ? (
          <div className="bg-surface-container-low rounded-xl border border-outline-variant/20 p-8 text-center">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant/40 block mb-2">photo_camera</span>
            <p className="text-sm text-on-surface-variant">No snapshots saved yet.</p>
            <p className="text-xs text-on-surface-variant/60 mt-1">Use "Save Snapshot" on the Summary page to capture a comparison.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {snapshots.map(snap => (
              <div
                key={snap.snapshotId}
                className="bg-surface-container-low rounded-xl border border-outline-variant/20 p-4 flex items-start gap-3 hover:border-outline-variant/40 transition-colors"
              >
                <span className="material-symbols-outlined text-primary/70 text-xl mt-0.5 shrink-0">photo_camera</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-on-background truncate">{snap.label}</div>
                  <div className="text-xs text-on-surface-variant mt-0.5">
                    {snap.baseName} → {snap.targetName}
                  </div>
                  <div className="text-xs text-on-surface-variant/60 mt-0.5">
                    {new Date(snap.savedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => exportSnapshotAsPDF(snap)}
                    title="Export as PDF"
                    className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-background transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                  </button>
                  <button
                    onClick={() => onView(snap.snapshotId)}
                    className="px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/8 rounded-lg transition-colors"
                  >
                    View
                  </button>
                  <button
                    onClick={() => onDelete(snap.snapshotId)}
                    title="Delete snapshot"
                    className="p-1.5 rounded-lg text-on-surface-variant/50 hover:bg-error/10 hover:text-error transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Read-only snapshot view ───────────────────────────────────────────────────
function SnapshotReadOnlyView({ snap, onClose }) {
  const added   = snap.added   || []
  const removed = snap.removed || []
  const moved   = snap.moved   || []

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

        {/* Read-only banner */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="material-symbols-outlined text-primary text-xl shrink-0">photo_camera</span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-primary uppercase tracking-wider">Read-only · Saved Snapshot</div>
              <div className="text-sm font-semibold text-on-background truncate mt-0.5">{snap.label}</div>
              <div className="text-xs text-on-surface-variant">
                {new Date(snap.savedAt).toLocaleString()} · {snap.baseName} → {snap.targetName}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => exportSnapshotAsPDF(snap)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-on-surface-variant border border-outline-variant/30 rounded-lg hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-base">picture_as_pdf</span>
              Export PDF
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-on-surface-variant border border-outline-variant/30 rounded-lg hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Back
            </button>
          </div>
        </div>

        {/* Timeline */}
        <Card title="Timeline" icon="date_range">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  <th className="text-left py-1.5 pr-4 font-semibold w-40"></th>
                  <th className="text-left py-1.5 pr-4">{snap.baseName}</th>
                  <th className="text-left py-1.5">{snap.targetName}</th>
                </tr>
              </thead>
              <tbody>
                <tr className={snap.bFirstLabel !== snap.tFirstLabel ? 'bg-tertiary-container/30' : ''}>
                  <td className="py-2 pr-4 text-xs font-semibold text-on-surface-variant">First Sprint</td>
                  <td className="py-2 pr-4 text-on-background font-medium">{snap.bFirstLabel}</td>
                  <td className="py-2 text-on-background font-medium">{snap.tFirstLabel}</td>
                </tr>
                <tr className={snap.bLastLabel !== snap.tLastLabel ? 'bg-tertiary-container/30' : ''}>
                  <td className="py-2 pr-4 text-xs font-semibold text-on-surface-variant">Last Sprint</td>
                  <td className="py-2 pr-4 text-on-background font-medium">{snap.bLastLabel}</td>
                  <td className="py-2 text-on-background font-medium">{snap.tLastLabel}</td>
                </tr>
                <tr className={snap.bSpan !== snap.tSpan ? 'bg-tertiary-container/30' : ''}>
                  <td className="py-2 pr-4 text-xs font-semibold text-on-surface-variant">Sprints Spanned</td>
                  <td className="py-2 pr-4 text-on-background font-medium">{snap.bSpan > 0 ? snap.bSpan : '—'}</td>
                  <td className="py-2 text-on-background font-medium">
                    {snap.tSpan > 0 ? snap.tSpan : '—'}
                    {snap.tSpan > 0 && snap.bSpan > 0 && snap.tSpan !== snap.bSpan && (
                      <span className={`ml-2 text-xs font-bold ${snap.tSpan > snap.bSpan ? 'text-tertiary' : 'text-secondary'}`}>
                        {snap.tSpan > snap.bSpan ? '+' : ''}{snap.tSpan - snap.bSpan}
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Task Changes */}
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
                        {t.discipline && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#e8e7df', color: '#5e6058' }}>
                            {t.discipline}
                          </span>
                        )}
                        <span className="text-[10px] text-on-surface-variant whitespace-nowrap">
                          {t.fromSprintLabel} → {t.toSprintLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Scope Delta */}
        <Card title="Scope Delta" icon="scale">
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: snap.baseName,   val: `${snap.baseEst}h`, color: '#31332c' },
              { label: snap.targetName, val: `${snap.tgtEst}h`,  color: '#31332c' },
              { label: 'Delta',         val: `${snap.deltaSign}${snap.delta}h`, color: snap.deltaColor },
              { label: 'Change',        val: snap.pct != null ? `${snap.deltaSign}${snap.pct}%` : '—', color: snap.deltaColor },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-white rounded-lg border border-outline-variant/20 p-3 text-center">
                <div className="text-xs font-semibold text-on-surface-variant mb-1 truncate" title={label}>{label}</div>
                <div className="text-lg font-extrabold" style={{ color }}>{val}</div>
              </div>
            ))}
          </div>
          {snap.disciplineDeltas && snap.disciplineDeltas.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/20">
                  <th className="text-left py-1.5">Discipline</th>
                  <th className="text-right py-1.5 pr-3">{snap.baseName}</th>
                  <th className="text-right py-1.5 pr-3">{snap.targetName}</th>
                  <th className="text-right py-1.5">Delta</th>
                </tr>
              </thead>
              <tbody>
                {snap.disciplineDeltas.map(d => {
                  const dc = d.d > 0 ? '#9f403d' : d.d < 0 ? '#57634c' : '#b1b3a9'
                  return (
                    <tr key={d.discipline} className="border-b border-outline-variant/10 last:border-0">
                      <td className="py-1.5 text-xs font-medium text-on-background">{d.discipline}</td>
                      <td className="py-1.5 pr-3 text-right text-xs text-on-surface-variant">{d.bH}h</td>
                      <td className="py-1.5 pr-3 text-right text-xs text-on-surface-variant">{d.tH}h</td>
                      <td className="py-1.5 text-right text-xs font-bold" style={{ color: dc }}>
                        {d.d !== 0 ? `${d.d > 0 ? '+' : ''}${d.d}h` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>

        {snap.notes && (
          <Card title="Update Notes" icon="edit_note">
            <p className="text-sm text-on-background whitespace-pre-wrap">{snap.notes}</p>
          </Card>
        )}

      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function SummaryView() {
  const { data, sprints, updateSummaryNote } = useDataStore()
  const { summaryBase, summaryTarget, setSummaryBase, setSummaryTarget, setView } = useUIStore()
  const { snapshots, saveSnapshot, deleteSnapshot } = useSnapshotStore()

  // ── UI mode: 'live' | 'list' | 'view' ─────────────────────────────────────
  const [mode,        setMode]        = useState('live')
  const [viewingId,   setViewingId]   = useState(null)
  const [showModal,   setShowModal]   = useState(false)

  // ── Live scenario state ────────────────────────────────────────────────────
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

  const baseId   = localBase   === 'main' ? null : localBase
  const targetId = localTarget || null

  const baseSched   = useMemo(() => getScenarioSchedule(baseId,   data), [baseId,   data])
  const targetSched = useMemo(() => getScenarioSchedule(targetId, data), [targetId, data])

  const noteKey    = `${localBase}__${targetId}`
  const notesTimer = useRef(null)
  const handleNotesChange = useCallback(e => {
    const val = e.target.value
    clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => updateSummaryNote(noteKey, val), 400)
  }, [noteKey, updateSummaryNote])

  // ── Derived metrics (live) ─────────────────────────────────────────────────
  const spIdx   = useCallback(spId => sprints.findIndex(s => s.id === spId), [sprints])
  const spLabel = useCallback(spId => {
    const sp = sprints.find(s => s.id === spId)
    return sp ? `${sp.label} (${sp.dates})` : '—'
  }, [sprints])

  const baseIdxs = baseSched.filter(e => e.sprintId).map(e => spIdx(e.sprintId)).filter(i => i >= 0)
  const tgtIdxs  = targetSched.filter(e => e.sprintId).map(e => spIdx(e.sprintId)).filter(i => i >= 0)
  const bFirst   = baseIdxs.length ? Math.min(...baseIdxs) : -1
  const bLast    = baseIdxs.length ? Math.max(...baseIdxs) : -1
  const tFirst   = tgtIdxs.length  ? Math.min(...tgtIdxs)  : -1
  const tLast    = tgtIdxs.length  ? Math.max(...tgtIdxs)  : -1
  const bSpan    = bFirst >= 0 ? bLast - bFirst + 1 : 0
  const tSpan    = tFirst >= 0 ? tLast - tFirst + 1 : 0

  const baseMap = Object.fromEntries(baseSched.map(e => [e.task.id,   e.sprintId]))
  const tgtMap  = Object.fromEntries(targetSched.map(e => [e.task.id, e.sprintId]))
  const added   = data.tasks.filter(t => !baseMap[t.id]  && tgtMap[t.id])
  const removed = data.tasks.filter(t =>  baseMap[t.id]  && !tgtMap[t.id])
  const moved   = data.tasks.filter(t =>  baseMap[t.id]  && tgtMap[t.id] && baseMap[t.id] !== tgtMap[t.id])

  const baseEst    = baseSched.filter(e  => e.sprintId).reduce((s, e) => s + (e.task.estimate  || 0), 0)
  const tgtEst     = targetSched.filter(e => e.sprintId).reduce((s, e) => s + (e.task.estimate || 0), 0)
  const delta      = tgtEst - baseEst
  const pct        = baseEst > 0 ? Math.round((delta / baseEst) * 100) : null
  const deltaColor = delta > 0 ? '#9f403d' : delta < 0 ? '#57634c' : '#5e6058'
  const deltaSign  = delta > 0 ? '+' : ''

  const disciplines = [...new Set(data.tasks.map(t => t.discipline).filter(Boolean))].sort()

  const baseName   = baseId   ? (data.scenarios.find(s => s.id === baseId)?.name   ?? 'Unknown') : 'Main Roadmap'
  const targetName = targetId ? (data.scenarios.find(s => s.id === targetId)?.name ?? 'Unknown') : '—'

  const diffCls = (a, b) => a !== b ? 'bg-tertiary-container/30' : ''

  // ── Save snapshot handler ──────────────────────────────────────────────────
  const defaultLabel = `${targetName} · ${new Date().toLocaleDateString()}`

  const handleConfirmSave = useCallback(label => {
    const snap = {
      snapshotId: crypto.randomUUID(),
      savedAt:    new Date().toISOString(),
      label:      label.trim() || defaultLabel,
      baseName,
      targetName,
      baseId,
      targetId,
      // Timeline
      bFirstLabel: bFirst >= 0 ? spLabel(sprints[bFirst].id) : 'No tasks scheduled',
      bLastLabel:  bLast  >= 0 ? spLabel(sprints[bLast].id)  : '—',
      tFirstLabel: tFirst >= 0 ? spLabel(sprints[tFirst].id) : 'No tasks scheduled',
      tLastLabel:  tLast  >= 0 ? spLabel(sprints[tLast].id)  : '—',
      bSpan,
      tSpan,
      // Scope
      baseEst,
      tgtEst,
      delta,
      pct,
      deltaColor,
      deltaSign,
      // Task changes (slim serialisation — no full task objects)
      added:   added.map(t => ({ id: t.id, summary: t.summary, discipline: t.discipline, estimate: t.estimate })),
      removed: removed.map(t => ({ id: t.id, summary: t.summary, discipline: t.discipline, estimate: t.estimate })),
      moved:   moved.map(t => ({
        id: t.id, summary: t.summary, discipline: t.discipline, estimate: t.estimate,
        fromSprintLabel: spLabel(baseMap[t.id]),
        toSprintLabel:   spLabel(tgtMap[t.id]),
      })),
      // Discipline breakdown
      disciplineDeltas: disciplines.map(disc => {
        const bH = baseSched.filter(e  => e.sprintId && e.task.discipline === disc).reduce((s, e) => s + (e.task.estimate || 0), 0)
        const tH = targetSched.filter(e => e.sprintId && e.task.discipline === disc).reduce((s, e) => s + (e.task.estimate || 0), 0)
        return { discipline: disc, bH, tH, d: tH - bH }
      }),
      // Notes
      notes: data.summaryNotes?.[noteKey] ?? '',
    }
    saveSnapshot(snap)
    setShowModal(false)
  }, [
    baseName, targetName, baseId, targetId,
    bFirst, bLast, tFirst, tLast, bSpan, tSpan,
    baseEst, tgtEst, delta, pct, deltaColor, deltaSign,
    added, removed, moved, disciplines, baseSched, targetSched,
    baseMap, tgtMap, sprints, spLabel, data.summaryNotes, noteKey, saveSnapshot, defaultLabel,
  ])

  // ── Mode: show snapshot list ───────────────────────────────────────────────
  if (mode === 'list') {
    return (
      <SnapshotsList
        snapshots={snapshots}
        onView={id => { setViewingId(id); setMode('view') }}
        onDelete={deleteSnapshot}
        onClose={() => setMode('live')}
      />
    )
  }

  // ── Mode: view a specific snapshot ─────────────────────────────────────────
  if (mode === 'view' && viewingId) {
    const snap = snapshots.find(s => s.snapshotId === viewingId)
    if (snap) {
      return <SnapshotReadOnlyView snap={snap} onClose={() => setMode('list')} />
    }
  }

  // ── Mode: live comparison ──────────────────────────────────────────────────
  const canSave = !!targetId && baseId !== targetId

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
      {showModal && (
        <SaveModal
          defaultLabel={defaultLabel}
          onConfirm={handleConfirmSave}
          onCancel={() => setShowModal(false)}
        />
      )}

      <div className="flex flex-col gap-6 max-w-3xl">

        {/* Toolbar row */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setMode('list')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-on-surface-variant border border-outline-variant/30 rounded-lg hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-base">photo_library</span>
            Snapshots
            {snapshots.length > 0 && (
              <span className="ml-0.5 bg-primary/15 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                {snapshots.length}
              </span>
            )}
          </button>
          <button
            onClick={() => canSave && setShowModal(true)}
            disabled={!canSave}
            title={!canSave ? 'Select two different scenarios to save a snapshot' : 'Save a snapshot of this comparison'}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              canSave
                ? 'bg-primary text-white hover:opacity-90'
                : 'bg-surface-container text-on-surface-variant/40 cursor-not-allowed'
            }`}
          >
            <span className="material-symbols-outlined text-base">photo_camera</span>
            Save Snapshot
          </button>
        </div>

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
