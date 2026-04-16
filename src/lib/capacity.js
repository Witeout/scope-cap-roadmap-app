/**
 * Calculate a single member's total available hours across all sprints,
 * accounting for stat holidays, PTO, and sick days.
 *
 * @param {object} member - { hoursPerSprint, statHolidays, ptoDays, sickDays }
 * @param {number} sprintCount
 * @returns {number}
 */
export function memberAvailableHours(member, sprintCount) {
  const raw = sprintCount * (member.hoursPerSprint || 0)
  const daysOff = (+(member.statHolidays || 0) + +(member.ptoDays || 0) + +(member.sickDays || 0))
  return Math.max(0, raw - daysOff * 6)
}

/**
 * Get allocation percentage for a member in a specific team group.
 * If no group is active, returns 1 (100%). If member is not in the group, returns 0.
 *
 * @param {string} memberId
 * @param {string} groupId
 * @param {Array} teamGroups
 * @returns {number} fraction (0–1)
 */
export function getMemberAllocationForGroup(memberId, groupId, teamGroups) {
  if (!groupId) return 1
  const group = teamGroups.find(g => g.id === groupId)
  if (!group) return 1
  const entry = group.members.find(m => m.memberId === memberId)
  if (!entry) return 0
  return entry.allocation / 100
}

/**
 * Return a sorted, deduplicated list of all disciplines present on the team.
 *
 * @param {Array} team
 * @returns {string[]}
 */
export function getTeamDisciplines(team) {
  const seen = new Set()
  team.forEach(m => { if (m.discipline) seen.add(m.discipline) })
  return [...seen].sort()
}

/**
 * Calculate available capacity per sprint for a given discipline,
 * after applying the buffer percentage. Optionally scales by team group allocation.
 *
 * @param {string} discipline
 * @param {Array} team
 * @param {number} sprintCount
 * @param {number} bufferPercent - 0–100
 * @param {string} teamGroupId - optional, for applying member allocation
 * @param {Array} teamGroups - optional, required if teamGroupId is set
 * @returns {number} hours
 */
export function getDisciplineCapacityPerSprint(discipline, team, sprintCount, bufferPercent = 0, teamGroupId = null, teamGroups = []) {
  const raw = team
    .filter(m => m.discipline === discipline)
    .reduce((sum, m) => {
      const allocation = getMemberAllocationForGroup(m.id, teamGroupId, teamGroups)
      return sum + (memberAvailableHours(m, sprintCount) / sprintCount) * allocation
    }, 0)
  return raw * (1 - bufferPercent / 100)
}

/**
 * Sum the estimated hours of all tasks assigned to a given sprint + discipline.
 * Respects scenario sprint overrides when a scenarioId is active.
 *
 * @param {string} sprintId
 * @param {string} discipline
 * @param {Array} tasks - active task list (already resolved for the current scenario)
 * @returns {number}
 */
export function getSprintDisciplineUsed(sprintId, discipline, tasks) {
  let total = 0
  tasks.forEach(t => {
    if (t.discipline !== discipline) return
    if (t.sprintId === sprintId) total += +(t.estimate || 0)
  })
  return total
}

/**
 * Return a full capacity summary for every discipline for a given sprint.
 * Convenient for rendering the capacity tooltip.
 *
 * @param {string} sprintId
 * @param {Array} team
 * @param {Array} tasks - active tasks (scenario-resolved)
 * @param {number} sprintCount
 * @param {number} bufferPercent
 * @returns {Array<{ discipline, capacity, used, pct, over, overAmt }>}
 */
export function getCapacityInfo(sprintId, team, tasks, sprintCount, bufferPercent = 0) {
  const disciplines = getTeamDisciplines(team)
  return disciplines.map(disc => {
    const capacity = getDisciplineCapacityPerSprint(disc, team, sprintCount, bufferPercent)
    const used = getSprintDisciplineUsed(sprintId, disc, tasks)
    const pct = capacity > 0 ? Math.min(used / capacity, 1) : 0
    const over = used > capacity && capacity > 0
    const overAmt = Math.round(used - capacity)
    return { discipline: disc, capacity, used, pct, over, overAmt }
  })
}
