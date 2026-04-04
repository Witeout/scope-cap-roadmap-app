/**
 * Pure Gantt utility functions — no globals, no side effects.
 * All functions accept state as parameters and return computed values.
 */

// ─── Item resolution ───────────────────────────────────────────────────────────

/**
 * Find an item by ID across all collections.
 * Returns { item, type } or null.
 *
 * @param {string} id
 * @param {object} data - full data object from dataStore
 * @returns {{ item: object, type: string }|null}
 */
export function resolveItemAnyType(id, data) {
  const task = data.tasks.find(t => t.id === id)
  if (task) return { item: task, type: 'task' }

  const epic = data.epics.find(e => e.id === id)
  if (epic) return { item: epic, type: 'epic' }

  const ini = data.initiatives.find(i => i.id === id)
  if (ini) return { item: ini, type: 'initiative' }

  return null
}

// ─── Sprint range computation ─────────────────────────────────────────────────

/**
 * Get the active sprint ID for a task, respecting scenario overrides.
 *
 * @param {object} task
 * @param {object|null} scenario - current scenario object (or null for main)
 * @returns {string|null}
 */
function activeSprintId(task, scenario) {
  if (!scenario) return task.sprintId
  return scenario.sprintOverrides?.[task.id] ?? task.sprintId
}

/**
 * Return { startIndex, endIndex } for an item within the sprint array,
 * respecting the active scenario.
 *
 * Tasks: single-sprint range.
 * Epics: min/max sprint across child tasks.
 * Initiatives: min/max sprint across child epics (recursively).
 *
 * Returns null if no sprint can be determined.
 *
 * @param {string} id
 * @param {'initiative'|'epic'|'task'} type
 * @param {Array} sprints - computeSprints() result
 * @param {object} data
 * @param {object|null} scenario - active scenario object (or null)
 * @returns {{ startIndex: number, endIndex: number }|null}
 */
export function getItemSprintRange(id, type, sprints, data, scenario = null) {
  const si = spId => sprints.findIndex(s => s.id === spId)

  const activeTasks = scenario
    ? [...data.tasks, ...(scenario.tasks || [])]
    : data.tasks

  if (type === 'task') {
    const task = activeTasks.find(t => t.id === id)
    if (!task) return null
    const spId = activeSprintId(task, scenario)
    if (!spId) return null
    const idx = si(spId)
    if (idx < 0) return null
    return { startIndex: idx, endIndex: idx }
  }

  if (type === 'epic') {
    const kids = activeTasks.filter(t => t.epicId === id)
    if (!kids.length) return null
    const idxs = kids.map(t => si(activeSprintId(t, scenario))).filter(i => i >= 0)
    if (!idxs.length) return null
    return { startIndex: Math.min(...idxs), endIndex: Math.max(...idxs) }
  }

  if (type === 'initiative') {
    const epics = data.epics.filter(e => e.initiativeId === id)
    const all = []
    for (const e of epics) {
      const r = getItemSprintRange(e.id, 'epic', sprints, data, scenario)
      if (r) { all.push(r.startIndex, r.endIndex) }
    }
    if (!all.length) return null
    return { startIndex: Math.min(...all), endIndex: Math.max(...all) }
  }

  return null
}

/**
 * Same as getItemSprintRange but explicitly targets a named scenario ID
 * (used in compare mode where we need both base and target ranges simultaneously).
 *
 * @param {string} id
 * @param {'initiative'|'epic'|'task'} type
 * @param {string|null} scenarioId - null means "main roadmap"
 * @param {Array} sprints
 * @param {object} data
 * @returns {{ startIndex: number, endIndex: number }|null}
 */
export function getItemSprintRangeForScenario(id, type, scenarioId, sprints, data) {
  const scenario = scenarioId
    ? data.scenarios.find(s => s.id === scenarioId) ?? null
    : null
  return getItemSprintRange(id, type, sprints, data, scenario)
}

// ─── Violation detection ──────────────────────────────────────────────────────

/**
 * Compute which items and deps have scheduling violations.
 * A violation is when a dependent item (fromId) starts at or before
 * its predecessor (toId) ends.
 *
 * @param {Array} deps - active dependency array
 * @param {object} rowIndexMap - { [itemId]: rowIndex }
 * @param {Array} sprints
 * @param {object} data
 * @param {object|null} scenario
 * @returns {{ violatedIds: Set<string>, violatedDepIds: Set<string> }}
 */
export function computeViolations(deps, rowIndexMap, sprints, data, scenario = null) {
  const violatedIds    = new Set()
  const violatedDepIds = new Set()

  for (const dep of deps) {
    const bRes = resolveItemAnyType(dep.toId,   data)
    const dRes = resolveItemAnyType(dep.fromId, data)
    if (!bRes || !dRes) continue

    const bRange = getItemSprintRange(dep.toId,   bRes.type, sprints, data, scenario)
    const dRange = getItemSprintRange(dep.fromId, dRes.type, sprints, data, scenario)
    if (!bRange || !dRange) continue

    // Dependent (fromId) starts at or before predecessor (toId) ends
    if (bRange.startIndex <= dRange.endIndex) {
      violatedIds.add(dep.toId)
      violatedDepIds.add(dep.id)
    }
  }

  return { violatedIds, violatedDepIds }
}

// ─── Sprint shift ─────────────────────────────────────────────────────────────

/**
 * Compute which tasks need their sprintId updated when an item is shifted by `delta` sprints.
 * Returns an array of { taskId, newSprintId } pairs.
 * Does NOT mutate — callers must apply updates via the store.
 *
 * @param {string} itemId
 * @param {'initiative'|'epic'|'task'} type
 * @param {number} delta - sprint index delta (positive = forward)
 * @param {Array} sprints
 * @param {object} data
 * @param {object|null} scenario
 * @returns {Array<{ taskId: string, newSprintId: string, isScenarioPrivate: boolean }>}
 */
export function computeSprintDelta(itemId, type, delta, sprints, data, scenario) {
  const activeTasks = scenario
    ? [...data.tasks, ...(scenario.tasks || [])]
    : data.tasks

  const getNewSprint = task => {
    const curSpId = activeSprintId(task, scenario)
    if (!curSpId) return null
    const idx = sprints.findIndex(s => s.id === curSpId)
    const newIdx = Math.max(0, Math.min(sprints.length - 1, idx + delta))
    return sprints[newIdx].id
  }

  const isScenarioPrivate = task =>
    !!scenario && !data.tasks.find(t => t.id === task.id)

  let targets = []
  if (type === 'task') {
    const task = activeTasks.find(t => t.id === itemId)
    if (task) targets = [task]
  } else if (type === 'epic') {
    targets = activeTasks.filter(t => t.epicId === itemId)
  } else if (type === 'initiative') {
    const epicIds = new Set(data.epics.filter(e => e.initiativeId === itemId).map(e => e.id))
    targets = activeTasks.filter(t => epicIds.has(t.epicId))
  }

  return targets
    .map(task => {
      const newSprintId = getNewSprint(task)
      if (!newSprintId) return null
      return { taskId: task.id, newSprintId, isScenarioPrivate: isScenarioPrivate(task) }
    })
    .filter(Boolean)
}

// ─── Row builder ──────────────────────────────────────────────────────────────

/**
 * Build the flat ordered row array for the Gantt grid.
 * Same hierarchy logic as StructureView but without filters.
 *
 * @param {object} data
 * @param {object|null} scenario
 * @returns {Array<{ item: object, type: string, indent: number }>}
 */
export function buildGanttRows(data, scenario) {
  const activeTasks = scenario
    ? [...data.tasks, ...(scenario.tasks || [])]
    : data.tasks

  const sorted = arr => [...arr].sort((a, b) => a.order - b.order)
  const rows = []

  for (const ini of sorted(data.initiatives)) {
    rows.push({ item: ini, type: 'initiative', indent: 0 })
    for (const epic of sorted(data.epics.filter(e => e.initiativeId === ini.id))) {
      rows.push({ item: epic, type: 'epic', indent: 1 })
      for (const task of sorted(activeTasks.filter(t => t.epicId === epic.id))) {
        rows.push({ item: task, type: 'task', indent: 2 })
      }
    }
  }

  // Orphan epics
  const linkedEpicIds = new Set(
    data.epics.filter(e => e.initiativeId && data.initiatives.find(i => i.id === e.initiativeId)).map(e => e.id)
  )
  for (const epic of sorted(data.epics.filter(e => !linkedEpicIds.has(e.id)))) {
    rows.push({ item: epic, type: 'epic', indent: 0 })
    for (const task of sorted(activeTasks.filter(t => t.epicId === epic.id))) {
      rows.push({ item: task, type: 'task', indent: 1 })
    }
  }

  // Orphan tasks
  const linkedTaskIds = new Set(
    activeTasks.filter(t => t.epicId && data.epics.find(e => e.id === t.epicId)).map(t => t.id)
  )
  for (const task of sorted(activeTasks.filter(t => !linkedTaskIds.has(t.id)))) {
    rows.push({ item: task, type: 'task', indent: 0 })
  }

  return rows
}
