/**
 * Broken dependency detection.
 *
 * A dependency { id, fromId, toId } means:
 *   toId  = predecessor (the task that must finish first — "Blocks")
 *   fromId = dependent  (the task waiting on the predecessor — "Blocked By")
 *
 * A dependency is "broken" when either:
 *  1. SCHEDULE — the dependent starts at or before the predecessor ends
 *     (their sprints overlap, or the order is reversed)
 *  2. STATUS   — the predecessor has an explicit status set to something
 *     other than 'Done' (incomplete predecessor)
 */

import { resolveItemAnyType, getItemSprintRange } from './gantt'

/**
 * Analyse all active dependencies and return violation data.
 *
 * @param {Array}        deps     - active dependency array
 * @param {Array}        sprints  - sprint array from computeSprints
 * @param {object}       data     - full data store object
 * @param {object|null}  scenario - active scenario object (or null for main roadmap)
 *
 * @returns {{
 *   brokenDeps:    Array<BrokenDep>,
 *   violatedIds:   Set<string>,    // all item IDs involved in at least one violation
 *   violatedDepIds: Set<string>,   // dep IDs that are violated
 *   tooltipMap:    Map<string, string> // itemId → human-readable tooltip for the warning icon
 * }}
 */
export function getBrokenDependencies(deps, sprints, data, scenario = null) {
  const violatedIds    = new Set()
  const violatedDepIds = new Set()
  const brokenDeps     = []
  const tooltipMap     = new Map()

  for (const dep of deps) {
    const predRes = resolveItemAnyType(dep.toId,   data)  // predecessor
    const depRes  = resolveItemAnyType(dep.fromId, data)  // dependent
    if (!predRes || !depRes) continue

    const predRange = getItemSprintRange(dep.toId,   predRes.type, sprints, data, scenario)
    const depRange  = getItemSprintRange(dep.fromId, depRes.type,  sprints, data, scenario)

    const reasons = []

    // ── Check 1: Schedule overlap ─────────────────────────────────────────
    // Violation: dependent starts at or before the predecessor ends.
    // (dRange.startIndex <= predRange.endIndex)
    if (predRange && depRange && depRange.startIndex <= predRange.endIndex) {
      reasons.push('schedule')
    }

    // ── Check 2: Predecessor status ───────────────────────────────────────
    // Only fires when a status field has been explicitly set to something
    // other than 'Done'. Tasks with no status field set are ignored here
    // (avoids false positives on projects that haven't used status tracking).
    if (predRes.item.status && predRes.item.status !== 'Done') {
      reasons.push('status')
    }

    if (reasons.length === 0) continue

    // Mark both sides as involved
    violatedIds.add(dep.toId)
    violatedIds.add(dep.fromId)
    violatedDepIds.add(dep.id)

    brokenDeps.push({
      dep,
      predecessorId:   dep.toId,
      predecessorItem: predRes.item,
      predecessorType: predRes.type,
      dependentId:     dep.fromId,
      dependentItem:   depRes.item,
      dependentType:   depRes.type,
      reasons,
    })

    // ── Build tooltip strings ─────────────────────────────────────────────
    // Dependent: explain what's wrong with this specific task
    const depMsgs = []
    if (reasons.includes('schedule')) {
      depMsgs.push(`Scheduled before "${predRes.item.summary}" finishes`)
    }
    if (reasons.includes('status')) {
      depMsgs.push(`"${predRes.item.summary}" is not yet done`)
    }
    const depTooltip = `Dependency issue: ${depMsgs.join(' · ')}`
    const existingDep = tooltipMap.get(dep.fromId)
    tooltipMap.set(dep.fromId, existingDep ? `${existingDep}\n${depTooltip}` : depTooltip)

    // Predecessor: generic note that a downstream task is blocked
    const predTooltip = `"${depRes.item.summary}" depends on this task (${reasons.join(', ')} issue)`
    const existingPred = tooltipMap.get(dep.toId)
    tooltipMap.set(dep.toId, existingPred ? `${existingPred}\n${predTooltip}` : predTooltip)
  }

  return { brokenDeps, violatedIds, violatedDepIds, tooltipMap }
}
