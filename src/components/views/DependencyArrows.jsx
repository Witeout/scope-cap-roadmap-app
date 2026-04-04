/**
 * SVG overlay rendering all dependency arrows on the Gantt chart.
 *
 * Props:
 *  deps           — active dependency array
 *  rows           — flat row array [{ item, type, indent }]
 *  ranges         — Map<itemId, { startIndex, endIndex }|null>
 *  violatedDepIds — Set<depId>
 *  selectedDepId  — string|null
 *  onSelectDep    — (depId) => void
 *  locked         — bool
 *  SPRINT_W       — number (px per sprint column)
 *  LABEL_W        — number (px for label column)
 *  ROW_H          — number (px per row)
 */
export default function DependencyArrows({
  deps,
  rows,
  ranges,
  violatedDepIds,
  selectedDepId,
  onSelectDep,
  locked,
  SPRINT_W,
  LABEL_W,
  ROW_H,
  sprintCount,
  rowYOffsets,
  rowHeightsArr,
}) {
  if (!deps || deps.length === 0) return null

  const totalW = LABEL_W + sprintCount * SPRINT_W
  // Use variable-height total if available
  const dataH = rowYOffsets && rowHeightsArr && rowHeightsArr.length > 0
    ? rowYOffsets[rowYOffsets.length - 1] + rowHeightsArr[rowHeightsArr.length - 1]
    : rows.length * ROW_H
  const totalH = ROW_H + dataH

  // Build row index map
  const rowIndexMap = {}
  rows.forEach((r, i) => { rowIndexMap[r.item.id] = i })

  const arrows = []

  deps.forEach(dep => {
    const bRowIdx = rowIndexMap[dep.toId]
    const dRowIdx = rowIndexMap[dep.fromId]
    if (bRowIdx === undefined || dRowIdx === undefined) return

    const bRange = ranges.get(dep.toId)
    const dRange = ranges.get(dep.fromId)
    if (!bRange || !dRange) return

    // Arrow goes from the end of the predecessor (toId) to the start of the dependent (fromId)
    const bEndX   = LABEL_W + (bRange.endIndex   + 1) * SPRINT_W - 10
    const dStartX = LABEL_W +  dRange.startIndex      * SPRINT_W + 10

    // Y centre of each row — use per-row offsets when available
    const bRowH = rowHeightsArr ? (rowHeightsArr[bRowIdx] ?? ROW_H) : ROW_H
    const dRowH = rowHeightsArr ? (rowHeightsArr[dRowIdx] ?? ROW_H) : ROW_H
    const bYOff = rowYOffsets   ? (rowYOffsets[bRowIdx]   ?? bRowIdx * ROW_H) : bRowIdx * ROW_H
    const dYOff = rowYOffsets   ? (rowYOffsets[dRowIdx]   ?? dRowIdx * ROW_H) : dRowIdx * ROW_H
    const bY    = ROW_H + bYOff + bRowH / 2
    const dY    = ROW_H + dYOff + dRowH / 2

    let d
    if (dStartX > bEndX + 10) {
      // Forward: straight-ish cubic
      const cx = Math.max(40, (dStartX - bEndX) * 0.45)
      d = `M${bEndX},${bY} C${bEndX + cx},${bY} ${dStartX - cx},${dY} ${dStartX},${dY}`
    } else {
      // Backward / same-column: route around rows
      const exitX   = bEndX + 36
      const bypassY = Math.max(bY, dY) + Math.max(bRowH, dRowH) * 0.7
      const entryX  = dStartX - 20
      d = `M${bEndX},${bY}` +
          ` C${exitX},${bY} ${exitX},${bypassY} ${(exitX + entryX) / 2},${bypassY}` +
          ` C${entryX},${bypassY} ${entryX},${dY} ${dStartX},${dY}`
    }

    const isSel   = selectedDepId === dep.id
    const isViol  = violatedDepIds.has(dep.id)
    const interactive = !locked

    // Visible path stroke style
    let stroke, strokeWidth, dashArray, markerEnd
    if (isSel) {
      stroke      = isViol ? '#9f3330' : '#9f403d'
      strokeWidth = '2.5'
      dashArray   = '6 3'
      markerEnd   = `url(#${isViol ? 'dep-arrow-viol-hover' : 'dep-arrow-sel'})`
    } else if (isViol) {
      stroke      = '#b53832'
      strokeWidth = '2'
      dashArray   = '5 3'
      markerEnd   = 'url(#dep-arrow-viol)'
    } else {
      stroke      = 'rgba(91,95,99,0.55)'
      strokeWidth = '1.5'
      dashArray   = undefined
      markerEnd   = 'url(#dep-arrow)'
    }

    arrows.push(
      <g key={dep.id}>
        {/* Visible path */}
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={dashArray}
          markerEnd={markerEnd}
          pointerEvents="none"
        />
        {/* Wide invisible hit path */}
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth="12"
          pointerEvents={interactive ? 'stroke' : 'none'}
          style={{ cursor: interactive ? 'pointer' : 'default' }}
          onClick={interactive ? e => { e.stopPropagation(); onSelectDep(dep.id) } : undefined}
          // Hover effects handled via CSS in index.css (.gantt-dep-hit-path:hover)
        />
      </g>
    )
  })

  return (
    <svg
      className="gantt-dep-svg"
      width={totalW}
      height={totalH}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 5,
        overflow: 'visible',
      }}
    >
      <defs dangerouslySetInnerHTML={{ __html: `
        <marker id="dep-arrow" markerWidth="10" markerHeight="10"
                refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,1 L10,5 L0,9 Z" fill="rgba(91,95,99,0.8)"/>
        </marker>
        <marker id="dep-arrow-hover" markerWidth="10" markerHeight="10"
                refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,1 L10,5 L0,9 Z" fill="#5b5f63"/>
        </marker>
        <marker id="dep-arrow-sel" markerWidth="10" markerHeight="10"
                refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,1 L10,5 L0,9 Z" fill="#9f403d"/>
        </marker>
        <marker id="dep-arrow-viol" markerWidth="10" markerHeight="10"
                refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,1 L10,5 L0,9 Z" fill="#b53832"/>
        </marker>
        <marker id="dep-arrow-viol-hover" markerWidth="10" markerHeight="10"
                refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,1 L10,5 L0,9 Z" fill="#9f3330"/>
        </marker>
      ` }} />
      {arrows}
    </svg>
  )
}
