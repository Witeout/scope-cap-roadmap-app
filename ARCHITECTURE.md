# Architecture

React + Vite SPA migrated from a single-file (~3,400 line) HTML/vanilla JS app.
Zustand for state, Tailwind CSS v4 for styling, localStorage for persistence.

---

## Directory structure

```
src/
  store/          # Zustand stores (dataStore, uiStore)
  lib/            # Pure functions — no React, no side effects
  hooks/          # Reusable React hooks (drag, dep-draw)
  components/
    views/        # Full-page view components (one per nav item)
    ui/           # Shared UI primitives (Panel, modals, etc.)
    layout/       # App shell pieces (Sidebar, TopBar)
  data/           # Sample data generator
scripts/
  stress-test.js  # Browser console script — injects 3,000-task dataset
```

---

## State

### dataStore (`src/store/dataStore.js`)
Persists to localStorage under key `scopeCapData_v3`.
All mutations use `structuredClone(data)` for immutability, then call `_save()` which serialises and calls `computeSprints` to keep `sprints` in sync.

**Key actions:** `createItem`, `updateItem`, `removeItem` (with cascade), `reorderItems`, `addDependency`, `removeDependency`, `createScenario`, `commitScenario`, `updateScenarioSprintOverride`.

**Scale note:** `structuredClone` is O(n) in total item count. Comfortable up to ~5k tasks. If the dataset grows past ~20k, switch to [Immer](https://immerjs.github.io/immer/) for structural sharing.

### uiStore (`src/store/uiStore.js`)
Session-only (no persistence). Holds view, filters, panel open state, scenario/compare mode, collapse map, multi-select, context menu, and Gantt layout width.

---

## Key patterns

### Hybrid React + imperative for the Gantt (RoadmapView)
React owns data flow and layout. Mouse interactions (bar drag, dependency draw) are attached imperatively via `useRef` callbacks to avoid 60fps `setState` during drag.

- **`barRegistryRef`** — bars register themselves into a ref during render (`ref={el => barRegistryRef.current.push(...)}`). The dep-draw hook reads this ref during `mousemove` to hit-test live bounding boxes without triggering re-renders.
- **`useGanttDrag`** — attaches `mousedown/mousemove/mouseup` to each bar element. Drag state lives in a plain object ref; only the final drop dispatches to the store.
- **`useDepDraw`** — on drag from a dep handle, mounts a full-screen SVG overlay onto `document.body` for the rubber-band line. On `mouseup`, resolves the target from `barRegistryRef` and calls `addDependency`.

### HTML5 native DnD for StructureView tree
`@dnd-kit/sortable` is designed for flat lists. The hierarchical reparent case (task → epic, epic → initiative) requires custom collision detection that would be more complex than plain HTML5 events. StructureView uses `onDragStart/onDragOver/onDragLeave/onDrop` directly; drag state lives in a `useRef` to avoid re-renders on every `dragover`.

### Save-on-blur / save-on-change pattern
Fields keep **local state** while the user types; the store is only written on `blur` (text inputs) or `change` (selects). This avoids a store round-trip + re-render on every keystroke. Exception: the notes textarea in SummaryView uses a 400ms debounce since it's long-form text.

### Hooks before early returns
React requires all hooks to be called unconditionally. In components with an early empty-state return (SummaryView), all `useMemo`/`useRef`/`useCallback` calls must appear before the return statement. Derived values used as hook deps (e.g. `baseId`, `targetId`) are computed before the hooks, not after.

### Sprint scenario awareness
The sprint field in the Panel (and bar drag in RoadmapView) checks `scenarioId` before writing:
1. If no active scenario → write directly to `task.sprintId`.
2. If task is private to the scenario → write to `scenario.tasks[].sprintId`.
3. If task exists in main roadmap → write to `scenario.sprintOverrides[taskId]`.

---

## Performance

| Operation | Complexity | Notes |
|---|---|---|
| Store mutation | O(n) clone | structuredClone on full data object |
| localStorage write | O(n) | Serialises full data on every save |
| buildGanttRows | O(n) | Memoised on `[data, activeScenario]` |
| Sprint range map | O(n) | Memoised on `[rows, sprints, data]` |
| StructureView flat list | O(n) | Memoised; no virtualisation |
| Dep violation check | O(d) | d = number of dependencies |

**Virtualisation is not implemented.** StructureView and RoadmapView render all rows to the DOM. At 3,000 tasks this is fine (~35ms render). If the dataset grows to 10k+, add [react-virtual](https://tanstack.com/virtual) to the two scrolling lists.

To stress-test at scale, run `scripts/stress-test.js` in the browser console. It injects 30 initiatives, 300 epics, and 3,000 tasks then reloads the page.

---

## Remaining backlog

- **Replace sample data with real Jira data** (Card 1 in Notion Kanban)
- **Move localStorage to Supabase** for multi-user / cross-device access (Card 3 in Notion Kanban)
