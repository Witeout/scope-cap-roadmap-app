import { useState, useRef, useEffect, useCallback } from 'react'
import { useUIStore }  from '../../store/uiStore'
import { useDataStore } from '../../store/dataStore'
import {
  TYPE_ICON, TYPE_COLOR, priClasses,
  initials, avatarBg, avatarColor,
} from '../../lib/display'

const DISCIPLINES = ['Art', 'Animation', 'Audio', 'Design', 'Code', 'UX', 'UI', 'VFX', 'VO']
const PRIORITIES  = ['Critical', 'High', 'Medium', 'Low']
const STATUSES    = ['To Do', 'In Progress', 'Done']

const STATUS_STYLES = {
  'To Do':      { bg: '#f1f0e9', color: '#5e6058' },
  'In Progress': { bg: '#dae7ca', color: '#4a553f' },
  'Done':        { bg: '#c8e6c9', color: '#2e7d32' },
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function FieldLabel({ children }) {
  return (
    <span className="field-label block mb-1">{children}</span>
  )
}

function resolveItem(id, data) {
  const t = data.tasks.find(x => x.id === id)
  if (t) return { item: t, type: 'task' }
  const e = data.epics.find(x => x.id === id)
  if (e) return { item: e, type: 'epic' }
  const i = data.initiatives.find(x => x.id === id)
  if (i) return { item: i, type: 'initiative' }
  return null
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
function Breadcrumb({ type, item, data }) {
  const parts = []
  if (type === 'task' && item.epicId) {
    const epic = data.epics.find(e => e.id === item.epicId)
    if (epic) {
      if (epic.initiativeId) {
        const ini = data.initiatives.find(i => i.id === epic.initiativeId)
        if (ini) parts.push(ini.summary)
      }
      parts.push(epic.summary)
    }
  } else if (type === 'epic' && item.initiativeId) {
    const ini = data.initiatives.find(i => i.id === item.initiativeId)
    if (ini) parts.push(ini.summary)
  }
  if (!parts.length) parts.push(type.charAt(0).toUpperCase() + type.slice(1))

  return (
    <nav className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[300px] gap-0.5">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && (
            <span className="material-symbols-outlined text-[11px]">chevron_right</span>
          )}
          <span className="truncate">{p}</span>
        </span>
      ))}
    </nav>
  )
}

// ─── Dependency row ───────────────────────────────────────────────────────────
function DepRow({ dep, isBlocker, data, onRemove, onNavigate }) {
  const targetId = isBlocker ? dep.toId : dep.fromId
  const res = resolveItem(targetId, data)
  if (!res) return null
  const { item, type } = res

  return (
    <div className="flex items-center gap-2 py-1 group">
      <span
        className="material-symbols-outlined flex-shrink-0"
        style={{ fontSize: 14, color: TYPE_COLOR[type] }}
      >
        {TYPE_ICON[type]}
      </span>
      <span className="font-mono text-[9px] text-slate-400 flex-shrink-0">{targetId}</span>
      <button
        className="flex-1 text-left text-xs text-on-background truncate hover:text-primary transition-colors"
        onClick={() => onNavigate(type, targetId)}
      >
        {item.summary}
      </button>
      {!isBlocker && (
        <button
          className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-error hover:bg-error/10 transition-all"
          onClick={() => onRemove(dep.id)}
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      )}
    </div>
  )
}

// ─── Dependency typeahead ─────────────────────────────────────────────────────
function DepTypeahead({ currentId, data, scenarioId, linkedIds, onAdd }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [open,    setOpen]    = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return }
    const q   = query.toLowerCase()
    const all = [
      ...data.initiatives.map(i => ({ item: i, type: 'initiative' })),
      ...data.epics.map(e => ({ item: e, type: 'epic' })),
      ...data.tasks.map(t => ({ item: t, type: 'task' })),
    ].filter(({ item }) =>
      item.id !== currentId &&
      !linkedIds.has(item.id) &&
      `${item.id} ${item.summary}`.toLowerCase().includes(q)
    ).slice(0, 10)
    setResults(all)
    setOpen(true)
  }, [query, currentId, data, linkedIds])

  const handleSelect = useCallback(item => {
    onAdd(currentId, item.id)
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }, [currentId, onAdd])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder="Search items…"
        autoComplete="off"
        className="w-full text-xs bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        onChange={e => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => query && setOpen(true)}
      />
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-outline-variant/30 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400 italic">No matches found</div>
          ) : results.map(({ item, type }) => (
            <button
              key={item.id}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-container-low transition-colors"
              onMouseDown={e => { e.preventDefault(); handleSelect(item) }}
            >
              <span
                className="material-symbols-outlined flex-shrink-0"
                style={{ fontSize: 14, color: TYPE_COLOR[type] }}
              >
                {TYPE_ICON[type]}
              </span>
              <span className="font-mono text-[9px] text-slate-400 flex-shrink-0">{item.id}</span>
              <span className="text-xs text-on-background truncate">{item.summary}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Dependencies section ─────────────────────────────────────────────────────
function DepsSection({ type, id, data, scenarioId, onNavigate }) {
  const { addDependency, removeDependency } = useDataStore()

  // Deps where this item is the "from" side (depends on "to")
  const dependsOn = data.dependencies.filter(d => d.fromId === id)
  // Deps where this item is the "to" side (is blocked by "from")
  const blocks    = data.dependencies.filter(d => d.toId   === id)
  const linkedIds = new Set(dependsOn.map(d => d.toId))

  return (
    <section className="pt-4 border-t border-slate-100 space-y-3">
      <FieldLabel>Dependencies</FieldLabel>

      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Depends On</p>
        <div className="space-y-0.5">
          {dependsOn.length
            ? dependsOn.map(d => (
                <DepRow
                  key={d.id}
                  dep={d}
                  isBlocker={true}
                  data={data}
                  onRemove={depId => removeDependency(depId, scenarioId)}
                  onNavigate={onNavigate}
                />
              ))
            : <p className="text-[11px] text-slate-400 italic">None</p>
          }
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Blocks</p>
        <div className="space-y-0.5">
          {blocks.length
            ? blocks.map(d => (
                <DepRow
                  key={d.id}
                  dep={d}
                  isBlocker={false}
                  data={data}
                  onRemove={depId => removeDependency(depId, scenarioId)}
                  onNavigate={onNavigate}
                />
              ))
            : <p className="text-[11px] text-slate-400 italic">None</p>
          }
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Add Dependency</p>
        <DepTypeahead
          currentId={id}
          data={data}
          scenarioId={scenarioId}
          linkedIds={linkedIds}
          onAdd={addDependency}
        />
      </div>
    </section>
  )
}

// ─── Comment list ─────────────────────────────────────────────────────────────
function CommentItem({ comment, itemId, currentAuthor }) {
  const { removeComment, updateComment } = useDataStore()
  const bg    = avatarBg(comment.author)
  const color = avatarColor(comment.author)
  const ini   = initials(comment.author || '?')
  const date  = comment.createdAt
    ? new Date(comment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : ''

  const [editing, setEditing]   = useState(false)
  const [editText, setEditText] = useState(comment.text)
  const textareaRef             = useRef(null)

  const isAuthor = currentAuthor && comment.author === currentAuthor

  const handleEdit = () => {
    setEditText(comment.text)
    setEditing(true)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const handleSaveEdit = () => {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== comment.text) {
      updateComment(itemId, comment.id, trimmed)
    }
    setEditing(false)
  }

  const handleCancelEdit = () => {
    setEditText(comment.text)
    setEditing(false)
  }

  const handleDelete = () => removeComment(itemId, comment.id)

  return (
    <div className="flex gap-3 group">
      <div
        className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
        style={{ background: bg, color }}
      >
        {ini}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-bold text-on-background">{comment.author}</span>
          {date && <span className="text-[10px] text-slate-400">{date}</span>}
          {isAuthor && !editing && (
            <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
              <button
                title="Edit comment"
                className="p-0.5 rounded text-slate-400 hover:text-primary transition-colors"
                onClick={handleEdit}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit</span>
              </button>
              <button
                title="Delete comment"
                className="p-0.5 rounded text-slate-400 hover:text-red-400 transition-colors"
                onClick={handleDelete}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>delete</span>
              </button>
            </span>
          )}
        </div>

        {editing ? (
          <div>
            <textarea
              ref={textareaRef}
              value={editText}
              rows={2}
              className="w-full text-xs border border-primary/40 rounded-lg p-2 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none resize-none"
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit() }
                if (e.key === 'Escape') handleCancelEdit()
              }}
            />
            <div className="flex gap-1.5 justify-end mt-1">
              <button
                className="text-[11px] px-2 py-1 rounded-lg border border-outline-variant/40 text-slate-500 hover:bg-surface-container transition-colors"
                onClick={handleCancelEdit}
              >Cancel</button>
              <button
                className="text-[11px] font-bold bg-primary text-on-primary px-2 py-1 rounded-lg hover:bg-primary-dim transition-colors disabled:opacity-40"
                disabled={!editText.trim()}
                onClick={handleSaveEdit}
              >Save</button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg leading-relaxed border border-slate-100">
            {comment.text}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Activity section ─────────────────────────────────────────────────────────
function ActivitySection({ itemId, data }) {
  const { addComment } = useDataStore()
  const { commentAuthor, setCommentAuthor } = useUIStore()
  const [text,   setText]   = useState('')
  const [author, setAuthor] = useState(commentAuthor)

  const comments = data.comments?.[itemId] ?? []

  const handleSave = () => {
    const a = author.trim()
    const t = text.trim()
    if (!a || !t) return
    setCommentAuthor(a)
    addComment(itemId, t, a)
    setText('')
  }

  // Update local author when store changes
  useEffect(() => { setAuthor(commentAuthor) }, [commentAuthor])

  const teamNames = (data.team ?? []).map(m => m.name)

  return (
    <section className="pt-4 border-t border-slate-100">
      <FieldLabel>Activity ({comments.length})</FieldLabel>

      <div className="space-y-4 mb-4 mt-2">
        {comments.length
          ? comments.map(c => <CommentItem key={c.id} comment={c} itemId={itemId} currentAuthor={author} />)
          : <p className="text-xs text-slate-400 italic">No comments yet.</p>
        }
      </div>

      {/* Add comment */}
      <div className="flex gap-3">
        <div className="w-7 h-7 rounded-full bg-primary-container flex-shrink-0 flex items-center justify-center text-primary font-bold text-[10px]">
          {initials(author || 'You') === '?' ? 'You' : initials(author)}
        </div>
        <div className="flex-1">
          <input
            type="text"
            list="assignees-list"
            placeholder="Your name"
            value={author}
            className="w-full text-xs border border-outline-variant/30 rounded-lg px-2 py-1.5 mb-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            onChange={e => setAuthor(e.target.value)}
          />
          <datalist id="assignees-list">
            {teamNames.map(n => <option key={n} value={n} />)}
          </datalist>
          <textarea
            placeholder="Add a comment…"
            value={text}
            rows={2}
            className="w-full text-xs border border-outline-variant/30 rounded-lg p-2 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none resize-none"
            onChange={e => setText(e.target.value)}
          />
          <div className="flex justify-end mt-2">
            <button
              className="text-[11px] font-bold bg-primary text-on-primary px-3 py-1.5 rounded-lg hover:bg-primary-dim transition-colors disabled:opacity-40"
              disabled={!author.trim() || !text.trim()}
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
const MIN_PANEL_W = 280
const MAX_PANEL_W = 800
const STORAGE_KEY_W = 'panelWidth'

export default function Panel() {
  const { panel, openPanel, closePanel, setPendingDelete, scenarioId } = useUIStore()
  const { data, sprints, updateItem, updateScenarioSprintOverride } = useDataStore()

  // ── Panel width (resizable) ────────────────────────────────────────────────
  const [panelWidth, setPanelWidth] = useState(() => {
    const stored = parseInt(localStorage.getItem(STORAGE_KEY_W), 10)
    return !isNaN(stored) ? stored : 384
  })
  const onResizeMouseDown = useCallback(e => {
    e.preventDefault()
    const startX = e.clientX
    const startW = panelWidth

    function onMove(ev) {
      const delta = startX - ev.clientX
      const newW = Math.min(MAX_PANEL_W, Math.max(MIN_PANEL_W, startW + delta))
      setPanelWidth(newW)
    }
    function onUp(ev) {
      const delta = startX - ev.clientX
      const newW = Math.min(MAX_PANEL_W, Math.max(MIN_PANEL_W, startW + delta))
      localStorage.setItem(STORAGE_KEY_W, String(newW))
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [panelWidth])

  const { open, type, id } = panel

  // Resolve item from store (scenario-private tasks live in scn.tasks, not data.tasks)
  const scnTasks = scenarioId
    ? (data.scenarios.find(s => s.id === scenarioId)?.tasks ?? [])
    : []

  const item = open && type && id
    ? (type === 'initiative' ? data.initiatives.find(x => x.id === id)
     : type === 'epic'       ? data.epics.find(x => x.id === id)
     : type === 'task'       ? (data.tasks.find(x => x.id === id) ?? scnTasks.find(x => x.id === id))
     : null)
    : null

  const isScnPrivate = type === 'task' && !!scenarioId && !data.tasks.find(x => x.id === id)

  // Local field state — mirrors stored item, saves on blur/change
  const [fields, setFields] = useState({
    summary:     '',
    description: '',
    priority:    'Medium',
    assignee:    '',
    estimate:    '',
    discipline:  '',
    sprintId:    '',
    epicId:      '',
    initiativeId: '',
    status:      '',
    teamId:      '',
  })

  // Sync local state when panel opens a new item
  useEffect(() => {
    if (!item) return
    setFields({
      summary:      item.summary      ?? '',
      description:  item.description  ?? '',
      priority:     item.priority     ?? 'Medium',
      assignee:     (item.assignee && item.assignee !== 'Unassigned') ? item.assignee : '',
      estimate:     item.estimate     != null ? String(item.estimate) : '',
      discipline:   item.discipline   ?? '',
      sprintId:     item.sprintId     ?? '',
      epicId:       item.epicId       ?? '',
      initiativeId: item.initiativeId ?? '',
      status:       item.status       ?? '',
      teamId:       item.teamId       ?? '',
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, type]) // intentional: sync only on item navigation, not on every live edit

  if (!open || !item) return null

  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1)
  const teamNames = (data.team ?? []).map(m => m.name)

  // ── Save helpers ─────────────────────────────────────────────────────────
  const save = (field, value) => {
    updateItem(type, id, { [field]: value }, isScnPrivate ? scenarioId : null)
  }

  const handleBlur = (field, transform) => e => {
    let val = e.target.value
    if (transform) val = transform(val)
    setFields(f => ({ ...f, [field]: val }))
    save(field, val)
  }

  const handleSelectChange = (field, transform) => e => {
    let val = e.target.value
    if (transform) val = transform(val)
    setFields(f => ({ ...f, [field]: val }))
    save(field, val)
  }

  // Sprint is scenario-aware
  const handleSprintChange = e => {
    const newSpId = e.target.value || null
    setFields(f => ({ ...f, sprintId: newSpId ?? '' }))
    if (scenarioId) {
      // Is the task private to the scenario?
      const scn = data.scenarios.find(s => s.id === scenarioId)
      const isScnPrivate = scn && !data.tasks.find(x => x.id === id)
      if (isScnPrivate) {
        updateItem('task', id, { sprintId: newSpId }, scenarioId)
      } else {
        updateScenarioSprintOverride(scenarioId, id, newSpId)
      }
    } else {
      updateItem('task', id, { sprintId: newSpId })
    }
  }

  // Effective sprint for the task (scenario override or direct)
  const activeSprintId = (() => {
    if (type !== 'task') return null
    if (scenarioId) {
      const scn = data.scenarios.find(s => s.id === scenarioId)
      if (scn?.sprintOverrides?.[id] !== undefined) return scn.sprintOverrides[id]
    }
    return item.sprintId ?? null
  })()

  const disciplineHasNoMember = fields.discipline &&
    !(data.team ?? []).some(m => m.discipline === fields.discipline)

  return (
    <>
      {/* Backdrop (mobile / click-outside) */}
      <div
        className="fixed inset-0 z-30 bg-black/10"
        onClick={closePanel}
      />

      {/* Panel */}
      <aside
        className="fixed top-12 right-0 bottom-0 z-40 bg-white border-l border-slate-100 shadow-2xl flex flex-col overflow-hidden"
        style={{ width: panelWidth }}
        onClick={e => e.stopPropagation()}
      >
        {/* Resize handle */}
        <div
          style={{ position: 'absolute', left: 0, top: 0, width: 5, height: '100%', cursor: 'ew-resize', zIndex: 10 }}
          onMouseDown={onResizeMouseDown}
        />
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex-shrink-0 p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <Breadcrumb type={type} item={item} data={data} />
            <button
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-all flex-shrink-0 ml-2"
              onClick={closePanel}
            >
              <span className="material-symbols-outlined text-slate-500 text-lg">close</span>
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="material-symbols-outlined text-xl"
                style={{ color: TYPE_COLOR[type] }}
              >
                {TYPE_ICON[type]}
              </span>
              <h2 className="font-extrabold text-base text-on-background font-headline">{id}</h2>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex-shrink-0 ${priClasses(fields.priority)}`}>
              {fields.priority || '—'}
            </span>
          </div>
        </header>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Summary */}
          <section>
            <FieldLabel>Summary</FieldLabel>
            <input
              type="text"
              value={fields.summary}
              placeholder="Enter summary"
              className="w-full text-base font-extrabold text-on-background font-headline bg-transparent border-none outline-none focus:bg-slate-50 focus:px-2 focus:rounded-lg transition-all py-0.5"
              onChange={e => setFields(f => ({ ...f, summary: e.target.value }))}
              onBlur={handleBlur('summary')}
            />
          </section>

          {/* Description */}
          <section>
            <FieldLabel>Description</FieldLabel>
            <textarea
              rows={3}
              placeholder="Add a description…"
              value={fields.description}
              className="w-full text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              onChange={e => setFields(f => ({ ...f, description: e.target.value }))}
              onBlur={handleBlur('description')}
            />
          </section>

          {/* Fields grid */}
          <section className="grid grid-cols-2 gap-y-5 gap-x-4">

            {/* Priority */}
            <div>
              <FieldLabel>Priority</FieldLabel>
              <select
                value={fields.priority}
                className="w-full text-sm font-semibold bg-slate-50 border-none rounded-lg py-2 px-2 focus:ring-2 focus:ring-primary/20 focus:outline-none cursor-pointer"
                onChange={handleSelectChange('priority')}
              >
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Team */}
            <div>
              <FieldLabel>Team</FieldLabel>
              <select
                value={fields.teamId}
                className="w-full text-sm font-semibold bg-slate-50 border-none rounded-lg py-2 px-2 focus:ring-2 focus:ring-primary/20 focus:outline-none cursor-pointer"
                onChange={handleSelectChange('teamId', v => v || null)}
              >
                <option value="">— No Team —</option>
                {(data.teamGroups ?? []).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div>
              <FieldLabel>Assignee</FieldLabel>
              <input
                type="text"
                list="assignees-list"
                value={fields.assignee}
                placeholder="Unassigned"
                className="w-full text-sm font-semibold bg-slate-50 border-none rounded-lg py-2 px-2 focus:ring-2 focus:ring-primary/20 focus:outline-none"
                onChange={e => setFields(f => ({ ...f, assignee: e.target.value }))}
                onBlur={handleBlur('assignee', v => v.trim() || 'Unassigned')}
              />
              <datalist id="assignees-list">
                {teamNames.map(n => <option key={n} value={n} />)}
              </datalist>
            </div>

            {/* Task-only fields */}
            {type === 'task' && <>
              {/* Estimate */}
              <div>
                <FieldLabel>Estimate</FieldLabel>
                <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1.5">
                  <span className="material-symbols-outlined text-slate-400 text-lg">schedule</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={fields.estimate}
                    placeholder="0"
                    className="flex-1 text-sm font-semibold bg-transparent border-none outline-none w-full"
                    onChange={e => setFields(f => ({ ...f, estimate: e.target.value }))}
                    onBlur={handleBlur('estimate', v => v !== '' ? parseFloat(v) : null)}
                  />
                  <span className="text-xs text-slate-400 font-medium">hrs</span>
                </div>
              </div>

              {/* Discipline */}
              <div>
                <FieldLabel>Discipline</FieldLabel>
                <div className="relative">
                  <select
                    value={fields.discipline}
                    className="w-full appearance-none text-sm font-semibold bg-slate-50 border-none rounded-lg py-2 pl-2 pr-7 focus:ring-2 focus:ring-primary/20 focus:outline-none cursor-pointer"
                    onChange={handleSelectChange('discipline', v => v || null)}
                  >
                    <option value="">— None —</option>
                    {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">
                    expand_more
                  </span>
                </div>
                {disciplineHasNoMember && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs font-semibold text-amber-600">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    No team members assigned to "{fields.discipline}"
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="col-span-2">
                <FieldLabel>Status</FieldLabel>
                <div className="flex gap-2">
                  {STATUSES.map(s => {
                    const active = (fields.status || 'To Do') === s
                    const style  = STATUS_STYLES[s]
                    return (
                      <button
                        key={s}
                        className="flex-1 text-xs font-bold py-1.5 rounded-lg border transition-all"
                        style={active
                          ? { background: style.bg, color: style.color, borderColor: style.color + '60' }
                          : { background: 'transparent', color: '#9e9f95', borderColor: '#e2e3d8' }
                        }
                        onClick={() => {
                          setFields(f => ({ ...f, status: s }))
                          save('status', s)
                        }}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Sprint */}
              <div className="col-span-2">
                <FieldLabel>Sprint</FieldLabel>
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1.5">
                  <span className="material-symbols-outlined text-primary text-lg">target</span>
                  <select
                    value={activeSprintId ?? ''}
                    className="flex-1 text-sm font-semibold text-primary bg-transparent border-none outline-none cursor-pointer"
                    onChange={handleSprintChange}
                  >
                    <option value="">— No Sprint —</option>
                    {sprints.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.label} · {s.dates}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Epic */}
              <div className="col-span-2">
                <FieldLabel>Epic</FieldLabel>
                <select
                  value={fields.epicId}
                  className="w-full text-sm font-semibold bg-slate-50 border-none rounded-lg py-2 px-2 focus:ring-2 focus:ring-primary/20 focus:outline-none cursor-pointer"
                  onChange={handleSelectChange('epicId', v => v || null)}
                >
                  <option value="">— No Epic —</option>
                  {[...data.epics].sort((a, b) => a.order - b.order).map(e => (
                    <option key={e.id} value={e.id}>{e.id}: {e.summary}</option>
                  ))}
                </select>
              </div>
            </>}

            {/* Epic-only: Initiative */}
            {type === 'epic' && (
              <div className="col-span-2">
                <FieldLabel>Initiative</FieldLabel>
                <select
                  value={fields.initiativeId}
                  className="w-full text-sm font-semibold bg-slate-50 border-none rounded-lg py-2 px-2 focus:ring-2 focus:ring-primary/20 focus:outline-none cursor-pointer"
                  onChange={handleSelectChange('initiativeId', v => v || null)}
                >
                  <option value="">— No Initiative —</option>
                  {[...data.initiatives].sort((a, b) => a.order - b.order).map(i => (
                    <option key={i.id} value={i.id}>{i.id}: {i.summary}</option>
                  ))}
                </select>
              </div>
            )}

          </section>

          {/* Dependencies */}
          <DepsSection
            type={type}
            id={id}
            data={data}
            scenarioId={scenarioId}
            onNavigate={(t, newId) => openPanel(t, newId)}
          />

          {/* Activity */}
          <ActivitySection itemId={id} data={data} />

        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100">
          <button
            className="flex items-center gap-2 text-sm font-semibold text-error hover:bg-error/10 px-3 py-2 rounded-xl transition-all border border-error/20 w-full justify-center"
            onClick={() => { closePanel(); setPendingDelete({ type, id, scenarioId: isScnPrivate ? scenarioId : null }) }}
          >
            <span className="material-symbols-outlined text-lg">delete</span>
            Delete {typeLabel}
          </button>
        </div>
      </aside>
    </>
  )
}
