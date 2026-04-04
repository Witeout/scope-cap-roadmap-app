/**
 * Stress-test data generator for Scope Cap Roadmap.
 *
 * Paste the contents of this file into the browser console (or run as a
 * bookmarklet) while the app is open.  It writes a large dataset to
 * localStorage under the key `scopeCapData_v3`, then reloads the page.
 *
 * Default scale: 30 initiatives · 300 epics · 3,000 tasks · 100 deps
 * Tweak N_INITIATIVES / EPICS_PER_INI / TASKS_PER_EPIC as needed.
 */

;(function stressTest() {
  const STORAGE_KEY = 'scopeCapData_v3'

  const N_INITIATIVES   = 30
  const EPICS_PER_INI   = 10   // → 300 epics total
  const TASKS_PER_EPIC  = 10   // → 3,000 tasks total
  const N_DEPS          = 100

  const DISCIPLINES = ['Art', 'Animation', 'Audio', 'Design', 'Code', 'UX', 'UI', 'VFX', 'VO']
  const PRIORITIES  = ['Critical', 'High', 'Medium', 'Low']
  const ASSIGNEES   = ['Lisa Park', 'Kevin Zhao', 'Priya Singh', 'Ravi Nair', 'Jordan Lee', 'Sam Okafor']

  const SPRINT_LABELS = Array.from({ length: 26 }, (_, i) => `S${i + 1}`)

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
  function rng(lo, hi) { return Math.floor(Math.random() * (hi - lo + 1)) + lo }

  // ── Build sprints ────────────────────────────────────────────────────────
  // We only store project + data; sprints are computed from project by the app.
  // Just need a reasonable startDate.
  const project = {
    startDate: '2026-01-05',
    endDate: null,
    ongoing: true,
    milestones: [
      { id: 'MS-1', name: 'Alpha',  date: null, order: 0, fixed: true },
      { id: 'MS-2', name: 'Beta',   date: null, order: 1, fixed: true },
      { id: 'MS-3', name: 'Final',  date: null, order: 2, fixed: true },
    ],
    bufferPercent: 10,
  }

  // Build a dummy sprints array for sprint assignment
  // (real sprints are computed by computeSprints; we just need IDs)
  const sprintIds = Array.from({ length: 26 }, (_, i) => `SP-${i + 1}`)

  // ── Initiatives ──────────────────────────────────────────────────────────
  const initiatives = []
  for (let i = 0; i < N_INITIATIVES; i++) {
    initiatives.push({
      id: `INI-${i + 1}`,
      order: i,
      summary: `Initiative ${i + 1}: ${pick(['AI Integration', 'Core Gameplay', 'UI Overhaul', 'Backend Infra', 'Content Pipeline', 'Platform Support', 'Audio System', 'Performance', 'Analytics', 'Onboarding'])} v${rng(1, 5)}`,
      description: `Stress-test initiative ${i + 1}`,
      priority: pick(PRIORITIES),
      assignee: pick(ASSIGNEES),
    })
  }

  // ── Epics ────────────────────────────────────────────────────────────────
  const epics = []
  let epicIdx = 0
  for (const ini of initiatives) {
    for (let j = 0; j < EPICS_PER_INI; j++) {
      epicIdx++
      epics.push({
        id: `EP-${epicIdx}`,
        order: epicIdx - 1,
        initiativeId: ini.id,
        summary: `Epic ${epicIdx}: ${pick(['Design', 'Implementation', 'Testing', 'Polish', 'Infrastructure', 'Documentation', 'Review', 'Migration', 'Audit', 'Release'])} ${pick(['Phase', 'Track', 'Module', 'Component', 'System'])} ${rng(1, 3)}`,
        description: '',
        priority: pick(PRIORITIES),
        assignee: pick(ASSIGNEES),
      })
    }
  }

  // ── Tasks ────────────────────────────────────────────────────────────────
  const tasks = []
  let taskIdx = 0
  for (const epic of epics) {
    for (let k = 0; k < TASKS_PER_EPIC; k++) {
      taskIdx++
      tasks.push({
        id: `TASK-${taskIdx}`,
        order: taskIdx - 1,
        epicId: epic.id,
        summary: `Task ${taskIdx}: ${pick(['Build', 'Fix', 'Refactor', 'Test', 'Review', 'Update', 'Add', 'Remove', 'Migrate', 'Optimize'])} ${pick(['shader', 'pipeline', 'auth flow', 'UI component', 'API endpoint', 'animation rig', 'audio cue', 'level geometry', 'VFX particle', 'localization key'])} ${rng(1, 99)}`,
        description: '',
        priority: pick(PRIORITIES),
        assignee: pick(ASSIGNEES),
        estimate: rng(1, 16),
        discipline: pick(DISCIPLINES),
        sprintId: Math.random() > 0.15 ? pick(sprintIds) : null,
        epicId: epic.id,
      })
    }
  }

  // ── Dependencies ─────────────────────────────────────────────────────────
  const dependencies = []
  const depSet = new Set()
  let depIdx = 0
  let attempts = 0
  while (depIdx < N_DEPS && attempts < N_DEPS * 10) {
    attempts++
    const from = pick(tasks)
    const to   = pick(tasks)
    const key  = `${from.id}→${to.id}`
    if (from.id === to.id || depSet.has(key)) continue
    depSet.add(key)
    dependencies.push({ id: `dep-${++depIdx}`, fromId: from.id, toId: to.id })
  }

  // ── Team ─────────────────────────────────────────────────────────────────
  const team = [
    { id: 'TM-1', name: 'Lisa Park',    discipline: 'Code',      hoursPerSprint: 54, statHolidays: 20, ptoDays: 10, sickDays: 10 },
    { id: 'TM-2', name: 'Kevin Zhao',   discipline: 'Code',      hoursPerSprint: 54, statHolidays: 20, ptoDays: 10, sickDays: 10 },
    { id: 'TM-3', name: 'Priya Singh',  discipline: 'UI',        hoursPerSprint: 54, statHolidays: 20, ptoDays: 10, sickDays: 10 },
    { id: 'TM-4', name: 'Ravi Nair',    discipline: 'Code',      hoursPerSprint: 54, statHolidays: 20, ptoDays: 10, sickDays: 10 },
    { id: 'TM-5', name: 'Jordan Lee',   discipline: 'UX',        hoursPerSprint: 54, statHolidays: 20, ptoDays: 10, sickDays: 10 },
    { id: 'TM-6', name: 'Sam Okafor',   discipline: 'VFX',       hoursPerSprint: 54, statHolidays: 20, ptoDays: 10, sickDays: 10 },
  ]

  // ── Counters ─────────────────────────────────────────────────────────────
  const counters = {
    initiative: N_INITIATIVES,
    epic:       epicIdx,
    task:       taskIdx,
    member:     team.length,
    scenario:   0,
    milestone:  3,
  }

  const stressData = {
    counters,
    initiatives,
    epics,
    tasks,
    dependencies,
    team,
    scenarios:    [],
    comments:     {},
    summaryNotes: {},
    project,
  }

  const serialised = JSON.stringify(stressData)
  const kb = (serialised.length / 1024).toFixed(1)

  console.group('🧪 Scope Cap Stress Test')
  console.log(`Initiatives: ${initiatives.length}`)
  console.log(`Epics:       ${epics.length}`)
  console.log(`Tasks:       ${tasks.length}`)
  console.log(`Deps:        ${dependencies.length}`)
  console.log(`Payload:     ${kb} KB`)
  console.groupEnd()

  localStorage.setItem(STORAGE_KEY, serialised)
  console.log('✅ Data written. Reloading…')
  location.reload()
})()
