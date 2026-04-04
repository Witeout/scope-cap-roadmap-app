import { fmtDate } from './utils'

/**
 * Compute sprint list from a project config object.
 * Pure function — returns a new array, no side effects.
 *
 * @param {object} project - { startDate, endDate, ongoing }
 * @returns {Array<{ id, label, start, end, dates }>}
 */
export function computeSprints(project) {
  const startStr = project?.startDate || '2026-01-01'
  const start = new Date(startStr)
  start.setHours(0, 0, 0, 0)

  let count = 26
  if (project && !project.ongoing && project.endDate) {
    const end = new Date(project.endDate)
    const diffDays = Math.ceil((end - start) / 86400000)
    count = Math.max(1, Math.ceil(diffDays / 14))
  }

  return Array.from({ length: count }, (_, i) => {
    const s = new Date(start)
    s.setDate(s.getDate() + i * 14)
    const e = new Date(s)
    e.setDate(e.getDate() + 13)
    return {
      id: `S${i + 1}`,
      label: `Sprint ${i + 1}`,
      start: new Date(s),
      end: new Date(e),
      dates: `${fmtDate(s)} – ${fmtDate(e)}`,
    }
  })
}

/**
 * Return the ID of the sprint that contains today's date.
 * Returns null if today falls outside all sprints.
 *
 * @param {Array} sprints - result of computeSprints()
 * @returns {string|null}
 */
export function currentSprintId(sprints) {
  const now = new Date()
  const sp = sprints.find(s => now >= s.start && now <= s.end)
  return sp ? sp.id : null
}
