import { useCallback } from 'react'
import { useDataStore } from '../store/dataStore'
import { useUIStore } from '../store/uiStore'

/**
 * Hook for interactive dependency drawing on the Gantt chart.
 *
 * Returns `startDepDraw(fromId, handleEl, side, getActiveDeps)` — call on
 * mousedown of a dep handle (left or right side of a bar).
 *
 * Side effects:
 *  - Attaches a full-screen SVG to document.body for the rubber-band line
 *  - Highlights hovered bar targets
 *  - On mouseup over a valid target: calls dataStore.addDependency
 *  - Cleans up all DOM side effects on mouseup
 *
 * The caller must pass `barRegistryRef` — a React ref holding an array of
 * { id, el } objects for all currently rendered gantt bars. RoadmapView
 * populates this ref via a callback during render.
 */
export function useDepDraw(barRegistryRef) {
  const { scenarioId }   = useUIStore()
  const { addDependency, data } = useDataStore()

  const startDepDraw = useCallback((fromId, handleEl, side = 'right') => {
    const hr = handleEl.getBoundingClientRect()
    const ax = hr.left + hr.width  / 2
    const ay = hr.top  + hr.height / 2

    // ── Build overlay SVG ───────────────────────────────────────────────────
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'dep-draw-svg')
    svg.style.cssText = `
      position: fixed; top: 0; left: 0;
      width: 100vw; height: 100vh;
      pointer-events: none; z-index: 9998; overflow: visible;
    `

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    defs.innerHTML = `
      <marker id="dep-draw-arrow" markerWidth="10" markerHeight="10"
              refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0,1 L10,5 L0,9 Z" fill="#5b5f63"/>
      </marker>
    `
    svg.appendChild(defs)

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('fill',           'none')
    path.setAttribute('stroke',         '#5b5f63')
    path.setAttribute('stroke-width',   '2')
    path.setAttribute('stroke-dasharray', '6 3')
    path.setAttribute('marker-end',     'url(#dep-draw-arrow)')
    path.setAttribute('d',              `M${ax},${ay} L${ax},${ay}`)
    svg.appendChild(path)
    document.body.appendChild(svg)
    document.body.style.userSelect = 'none'

    const wrapper = document.getElementById('roadmap-scroll-wrapper')
    if (wrapper) wrapper.classList.add('dep-drawing')

    let hoveredId  = null
    let hoveredEl  = null

    // ── Resolve active deps for duplicate check ─────────────────────────────
    const getActiveDeps = () => {
      if (!scenarioId) return data.dependencies
      const scn = data.scenarios.find(s => s.id === scenarioId)
      return scn ? scn.dependencies : data.dependencies
    }

    // ── Mouse move: update rubber-band line + highlight target ──────────────
    const onMove = mv => {
      const tx = mv.clientX
      const ty = mv.clientY
      const cx = Math.max(40, Math.abs(tx - ax) * 0.45)
      path.setAttribute('d', `M${ax},${ay} C${ax + cx},${ay} ${tx - cx},${ty} ${tx},${ty}`)

      // Hit-test registered bars
      let found = null
      const registry = barRegistryRef.current ?? []
      for (const entry of registry) {
        if (entry.id === fromId) continue
        const r   = entry.el.getBoundingClientRect()
        const pad = 8
        if (tx >= r.left - pad && tx <= r.right + pad && ty >= r.top && ty <= r.bottom) {
          found = entry
          break
        }
      }

      // Remove highlight from previous hover
      if (hoveredEl && (!found || hoveredEl !== found.el)) {
        hoveredEl.classList.remove('gantt-bar--dep-target', 'gantt-bar--dep-invalid')
      }

      if (found) {
        const deps  = getActiveDeps()
        const isDupe = deps.some(
          d => (d.fromId === found.id && d.toId === fromId) ||
               (d.fromId === fromId  && d.toId === found.id)
        )
        found.el.classList.add(isDupe ? 'gantt-bar--dep-invalid' : 'gantt-bar--dep-target')
        hoveredId = found.id
        hoveredEl = found.el
      } else {
        hoveredId = null
        hoveredEl = null
      }
    }

    // ── Mouse up: commit or discard ─────────────────────────────────────────
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
      document.body.style.userSelect = ''
      svg.remove()
      if (wrapper) wrapper.classList.remove('dep-drawing')
      if (hoveredEl) hoveredEl.classList.remove('gantt-bar--dep-target', 'gantt-bar--dep-invalid')

      if (hoveredId) {
        const deps   = getActiveDeps()
        const isDupe = deps.some(
          d => (d.fromId === hoveredId && d.toId === fromId) ||
               (d.fromId === fromId   && d.toId === hoveredId)
        )
        if (!isDupe) {
          // right handle: fromId is predecessor, hoveredId depends on it
          // left  handle: fromId is dependent, hoveredId is predecessor
          if (side === 'left') addDependency(fromId,   hoveredId, scenarioId || null)
          else                 addDependency(hoveredId, fromId,    scenarioId || null)
        }
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
  }, [data, scenarioId, addDependency, barRegistryRef])

  return { startDepDraw }
}
