/**
 * Pure display helpers — no state, no side effects.
 * Used across StructureView, SprintView, RoadmapView, and the Panel.
 */

// ─── Type metadata ────────────────────────────────────────────────────────────
export const TYPE_ICON = {
  initiative: 'bolt',
  epic: 'view_quilt',
  task: 'task_alt',
}

export const TYPE_COLOR = {
  initiative: '#7a583d',
  epic: '#57634c',
  task: '#5b5f63',
}

export const TYPE_PREFIX = {
  initiative: 'INI',
  epic: 'EP',
  task: 'TASK',
  member: 'TM',
}

// ─── Priority ─────────────────────────────────────────────────────────────────
const PRI = {
  Critical: 'bg-error/10 text-error border-error/20',
  High:     'bg-tertiary-container/40 text-tertiary border-tertiary/20',
  Medium:   'bg-secondary-container/40 text-secondary border-secondary/20',
  Low:      'bg-surface-container-highest text-on-surface-variant border-outline-variant/30',
}

export function priClasses(p) {
  return PRI[p] ?? PRI.Low
}

// ─── Assignee avatar ──────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#5b5f63', '#57634c', '#7a583d', '#36B37E',
  '#00B8D9', '#FF5630', '#4C6EF5', '#20C997',
]

export function initials(name) {
  if (!name || name === 'Unassigned') return '?'
  return name
    .split(/\s+/)
    .map(w => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function avatarBg(name) {
  if (!name || name === 'Unassigned') return '#c5c6bb'
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length
  return AVATAR_COLORS[h]
}

export function avatarColor(name) {
  return !name || name === 'Unassigned' ? '#5e6058' : 'white'
}

// ─── Date formatting ──────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function fmtDateLong(iso) {
  const d = new Date(iso)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}
