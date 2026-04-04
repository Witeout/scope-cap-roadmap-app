/**
 * Return the merged task list for a scenario:
 * base tasks + any scenario-specific new tasks.
 *
 * @param {Array} baseTasks - data.tasks
 * @param {object|null} scenario
 * @returns {Array}
 */
export function getScenarioTasks(baseTasks, scenario) {
  return [...baseTasks, ...(scenario?.tasks || [])]
}

/**
 * Resolve the effective sprint ID for a task within a scenario.
 * Falls back to the task's own sprintId if no override exists.
 *
 * @param {object} task
 * @param {object|null} scenario
 * @returns {string|null}
 */
export function getActiveSprintId(task, scenario) {
  if (!scenario) return task.sprintId
  return scenario.sprintOverrides[task.id] ?? task.sprintId
}

/**
 * Return the active dependency list, respecting the current scenario.
 *
 * @param {Array} baseDeps - data.dependencies
 * @param {object|null} scenario
 * @returns {Array}
 */
export function getActiveDeps(baseDeps, scenario) {
  return scenario ? scenario.dependencies : baseDeps
}

/**
 * Return the deps that involve a specific item (as source or target).
 *
 * @param {string} itemId
 * @param {Array} deps - result of getActiveDeps()
 * @returns {{ dependsOn: Array, blocks: Array }}
 */
export function getDepsForItem(itemId, deps) {
  return {
    dependsOn: deps.filter(d => d.fromId === itemId),
    blocks: deps.filter(d => d.toId === itemId),
  }
}

/**
 * Build a new scenario object from current data state.
 * Does NOT mutate any state — returns the new scenario to be pushed by the store.
 *
 * @param {string} name
 * @param {number} nextCounter - new scenario counter value
 * @param {Array} baseTasks - data.tasks
 * @param {Array} baseDeps - data.dependencies
 * @returns {{ scenario: object, id: string }}
 */
export function buildScenario(name, nextCounter, baseTasks, baseDeps) {
  const id = `SCN-${nextCounter}`
  const sprintOverrides = {}
  baseTasks.forEach(t => { sprintOverrides[t.id] = t.sprintId })
  const dependencies = JSON.parse(JSON.stringify(baseDeps))
  const scenario = { id, name, createdAt: Date.now(), sprintOverrides, dependencies, tasks: [] }
  return { scenario, id }
}

/**
 * Compute the updated base tasks + deps after committing a scenario.
 * Returns new arrays — does NOT mutate.
 *
 * @param {object} scenario
 * @param {Array} baseTasks
 * @returns {{ tasks: Array, dependencies: Array }}
 */
export function applyScenarioCommit(scenario, baseTasks) {
  const tasks = baseTasks.map(t => {
    const overrideSprintId = scenario.sprintOverrides[t.id]
    return overrideSprintId !== undefined ? { ...t, sprintId: overrideSprintId } : t
  })
  // Add any scenario-specific new tasks not already in base
  const baseIds = new Set(tasks.map(t => t.id))
  ;(scenario.tasks || []).forEach(t => { if (!baseIds.has(t.id)) tasks.push(t) })
  return { tasks, dependencies: scenario.dependencies }
}
