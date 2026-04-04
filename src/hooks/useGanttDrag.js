import { useCallback } from 'react'
import { useDataStore } from '../store/dataStore'
import { useUIStore } from '../store/uiStore'
import { computeSprintDelta } from '../lib/gantt'

const DRAG_THRESHOLD = 4   // px movement before we commit to a drag

/**
 * Returns an `attachBarDrag(bar, item, type, range, sprints, LABEL_W, ROW_H)` callback.
 *
 * Call it inside a ref callback or useEffect after bars are mounted:
 *
 *   const { attachBarDrag } = useGanttDrag()
 *   <div ref={el => el && attachBarDrag(el, item, type, range, sprints, LABEL_W, ROW_H)} />
 *
 * On mouseup (drag committed): applies sprint delta to the store.
 * On mouseup without movement: does nothing (caller handles click→openPanel).
 */
export function useGanttDrag() {
  const { data, updateItem, updateScenarioSprintOverride } = useDataStore()
  const { scenarioId, openPanel } = useUIStore()

  const applyDelta = useCallback((item, type, delta, sprints) => {
    const scenario = scenarioId
      ? data.scenarios.find(s => s.id === scenarioId) ?? null
      : null

    const updates = computeSprintDelta(item.id, type, delta, sprints, data, scenario)

    for (const { taskId, newSprintId, isScenarioPrivate } of updates) {
      if (isScenarioPrivate) {
        // Scenario-private task: update task.sprintId directly in scenario.tasks
        // The store's updateItem handles this via scenarioId param
        updateItem('task', taskId, { sprintId: newSprintId }, scenarioId)
      } else if (scenarioId) {
        updateScenarioSprintOverride(scenarioId, taskId, newSprintId)
      } else {
        updateItem('task', taskId, { sprintId: newSprintId })
      }
    }
  }, [data, scenarioId, updateItem, updateScenarioSprintOverride])

  /**
   * Attach mousedown → drag logic to a Gantt bar element.
   *
   * @param {HTMLElement} bar - the gantt bar div
   * @param {object} item
   * @param {string} type
   * @param {{ startIndex: number, endIndex: number }} range
   * @param {Array} sprints
   * @param {number} LABEL_W
   * @param {number} ROW_H
   */
  const attachBarDrag = useCallback((bar, item, type, range, sprints, LABEL_W, ROW_H, SPRINT_W = 100) => {
    if (!bar) return

    const onMouseDown = e => {
      // Only primary button; ignore if clicking a dep handle
      if (e.button !== 0) return
      if (e.target.classList.contains('gantt-dep-handle')) return

      e.preventDefault()
      const startMX    = e.clientX
      const startMY    = e.clientY
      let   dragging   = false
      let   ghost      = null
      let   startX     = 0
      let   currentDelta = 0

      const onPreMove = mv => {
        if (
          Math.abs(mv.clientX - startMX) > DRAG_THRESHOLD ||
          Math.abs(mv.clientY - startMY) > DRAG_THRESHOLD
        ) {
          document.removeEventListener('mousemove', onPreMove)
          document.removeEventListener('mouseup',   onPreUp)
          startDrag(mv)
        }
      }

      const onPreUp = () => {
        document.removeEventListener('mousemove', onPreMove)
        document.removeEventListener('mouseup',   onPreUp)
        // No movement — treat as click
        openPanel(type, item.id)
      }

      const startDrag = mv => {
        dragging = true
        bar.style.opacity = '0.5'
        bar.style.cursor  = 'grabbing'
        document.body.style.userSelect = 'none'
        document.body.style.cursor     = 'grabbing'

        // Create ghost overlay showing projected position
        ghost = document.createElement('div')
        ghost.className = `gantt-bar gantt-bar--${type}`
        ghost.style.cssText = `
          position: fixed;
          pointer-events: none;
          z-index: 200;
          opacity: 0.85;
          transition: none;
        `
        const barRect = bar.getBoundingClientRect()
        ghost.style.width  = bar.style.width
        ghost.style.height = barRect.height + 'px'
        ghost.style.top    = barRect.top  + 'px'
        ghost.style.left   = barRect.left + 'px'
        ghost.textContent  = item.summary
        document.body.appendChild(ghost)

        startX = mv.clientX
        onDragMove(mv)

        document.addEventListener('mousemove', onDragMove)
        document.addEventListener('mouseup',   onDragUp)
      }

      const onDragMove = mv => {
        if (!ghost) return
        const dx    = mv.clientX - startMX
        const delta = Math.round(dx / SPRINT_W)
        currentDelta = delta

        const newStartIdx = Math.max(0, Math.min(sprints.length - 1, range.startIndex + delta))
        const span        = range.endIndex - range.startIndex
        const newEndIdx   = Math.min(sprints.length - 1, newStartIdx + span)
        const newLeft     = LABEL_W + newStartIdx * SPRINT_W + 10

        // Update ghost horizontal position only (stay on same row)
        const barRect = bar.getBoundingClientRect()
        ghost.style.width = ((newEndIdx - newStartIdx + 1) * SPRINT_W - 20) + 'px'
        ghost.style.left  = (newLeft + (mv.clientX - startMX - delta * SPRINT_W)) + 'px'
        // Simpler: snap ghost to column
        ghost.style.left  = (newLeft) + 'px'
        ghost.style.top   = barRect.top + 'px'

        // Highlight the target column header
        document.querySelectorAll('.gantt-sprint-header').forEach((th, i) => {
          th.style.background = (i === newStartIdx) ? 'rgba(91,95,99,0.12)' : ''
        })
      }

      const onDragUp = () => {
        document.removeEventListener('mousemove', onDragMove)
        document.removeEventListener('mouseup',   onDragUp)
        document.body.style.userSelect = ''
        document.body.style.cursor     = ''

        if (ghost) { ghost.remove(); ghost = null }
        bar.style.opacity = ''
        bar.style.cursor  = ''
        document.querySelectorAll('.gantt-sprint-header').forEach(th => {
          th.style.background = ''
        })

        if (dragging && currentDelta !== 0) {
          applyDelta(item, type, currentDelta, sprints)
        }
        dragging = false
      }

      document.addEventListener('mousemove', onPreMove)
      document.addEventListener('mouseup',   onPreUp)
    }

    bar.addEventListener('mousedown', onMouseDown)
    // Return cleanup so callers can remove the listener if needed
    return () => bar.removeEventListener('mousedown', onMouseDown)
  }, [applyDelta, openPanel])

  return { attachBarDrag }
}
