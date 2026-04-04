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
 * When releases are present, rows are grouped under releaseHeader sentinel rows.
 * Each data row carries a releaseId property for downstream filtering.
 *
 * Row shapes:
 *   { type: 'releaseHeader', item: release, indent: 0, releaseId: release.id }
 *   { item, type: 'initiative'|'epic'|'task', indent, releaseId }
 *
 * @param {object} data
 * @param {object|null} scenario
 * @returns {Array}
 */
export function buildGanttRows(data, scenario) {
  const activeTasks = scenario
    ? [...data.tasks, ...(scenario.tasks || [])]
    : data.tasks

  const sort = arr => [...arr].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const releases = sort(data.project?.releases ?? [])
  const rows = []

  // Track rendered items so we can collect unassigned leftovers
  const renderedIniIds  = new Set()
  const renderedEpicIds = new Set()
  const renderedTaskIds = new Set()

  // Helper: render an initiative and all its children
  function renderIni(ini, releaseId) {
    rows.push({ item: ini, type: 'initiative', indent: 0, releaseId })
    renderedIniIds.add(ini.id)
    for (const epic of sort(data.epics.filter(e => e.initiativeId === ini.id))) {
      rows.push({ item: epic, type: 'epic', indent: 1, releaseId })
      renderedEpicIds.add(epic.id)
      for (const task of sort(activeTasks.filter(t => t.epicId === epic.id))) {
        rows.push({ item: task, type: 'task', indent: 2, releaseId })
        renderedTaskIds.add(task.id)
      }
    }
  }

  // Helper: render a standalone epic and its tasks
  function renderEpic(epic, indent, releaseId) {
    rows.push({ item: epic, type: 'epic', indent, releaseId })
    renderedEpicIds.add(epic.id)
    for (const task of sort(activeTasks.filter(t => t.epicId === epic.id))) {
      rows.push({ item: task, type: 'task', indent: indent + 1, releaseId })
      renderedTaskIds.add(task.id)
    }
  }

  if (releases.length > 0) {
    // ── Render each release group ───────────────────────────────────────────
    for (const release of releases) {
      rows.push({ type: 'releaseHeader', item: release, indent: 0, releaseId: release.id })

      // Initiatives belonging to this release
      for (const ini of sort(data.initiatives.filter(i => i.releaseId === release.id))) {
        renderIni(ini, release.id)
      }

      // Orphan epics explicitly tagged to this release (no parent ini, or parent not in this release)
      for (const epic of sort(data.epics.filter(e =>
        e.releaseId === release.id &&
        !renderedEpicIds.has(e.id) &&
        !(e.initiativeId && data.initiatives.find(i => i.id === e.initiativeId && i.releaseId === release.id))
      ))) {
        renderEpic(epic, 0, release.id)
      }
    }

    // ── Unassigned group ───────────────────────────────────────────────────
    const unassignedInits = sort(data.initiatives.filter(i => !renderedIniIds.has(i.id)))
    const unassignedEpics = sort(data.epics.filter(e =>
      !renderedEpicIds.has(e.id) &&
      !(e.initiativeId && data.initiatives.find(i => i.id === e.initiativeId))
    ))
    const unassignedTasks = sort(activeTasks.filter(t =>
      !renderedTaskIds.has(t.id) &&
      !(t.epicId && data.epics.find(e => e.id === t.epicId))
    ))

    if (unassignedInits.length > 0 || unassignedEpics.length > 0 || unassignedTasks.length > 0) {
      const UNASSIGNED = { id: null, name: 'Unassigned', color: '#9e9f95', startDate: null, endDate: null }
      rows.push({ type: 'releaseHeader', item: UNASSIGNED, indent: 0, releaseId: null })
      for (const ini  of unassignedInits) renderIni(ini, null)
      for (const epic of unassignedEpics) renderEpic(epic, 0, null)
      for (const task of unassignedTasks) {
        rows.push({ item: task, type: 'task', indent: 0, releaseId: null })
        renderedTaskIds.add(task.id)
      }
    }

  } else {
    // ── No releases — original flat layout ─────────────────────────────────
    for (const ini of sort(data.initiatives)) {
      renderIni(ini, null)
    }

    // Orphan epics
    for (const epic of sort(data.epics.filter(e => !renderedEpicIds.has(e.id)))) {
      renderEpic(epic, 0, null)
    }

    // Orphan tasks
    for (const task of sort(activeTasks.filter(t => !renderedTaskIds.has(t.id)))) {
      rows.push({ item: task, type: 'task', indent: 0, releaseId: null })
    }
  }

  return rows
}
