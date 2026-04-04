import { create } from 'zustand'
import { getSampleData } from '../data/sample'
import { computeSprints } from '../lib/sprints'
import { buildScenario, applyScenarioCommit } from '../lib/scenarios'

const STORAGE_KEY = 'scopeCapData_v3'

// ─── Migration helper ────────────────────────────────────────────────────────
function migrate(data) {
  if (!data.comments) data.comments = {}
  if (!data.dependencies) data.dependencies = []
  if (!data.team) data.team = []
  if (!data.counters.member) data.counters.member = 0
  if (!data.scenarios) data.scenarios = []
  if (!data.counters.scenario) data.counters.scenario = 0
  if (!data.summaryNotes) data.summaryNotes = {}

  // Normalize tasks
  data.tasks.forEach(t => { if (t.sprintId === undefined) t.sprintId = null })

  // Normalize team members
  data.team.forEach(m => {
    m.hoursPerSprint = 54
    m.statHolidays = 20
    m.ptoDays = 10
    m.sickDays = 10
    if (m.discipline === undefined) m.discipline = null
  })

  // Add any new members missing from stored data
  const existingNames = new Set(data.team.map(m => m.name))
  const newMembers = [
    { name: 'Lisa Park',    discipline: 'Code' },
    { name: 'Kevin Zhao',   discipline: 'Code' },
    { name: 'Priya Singh',  discipline: 'UI'   },
    { name: 'Ravi Nair',    discipline: 'Code' },
    { name: 'Jordan Lee',   discipline: 'UX'   },
    { name: 'Sam Okafor',   discipline: 'VFX'  },
    { name: 'Casey Morgan', discipline: 'VO'   },
    { name: 'Riley Walsh',  discipline: 'UI'   },
  ]
  newMembers.forEach(m => {
    if (!existingNames.has(m.name)) {
      data.counters.member = (data.counters.member || 0) + 1
      data.team.push({
        id: `TM-${data.counters.member}`,
        hoursPerSprint: 54,
        statHolidays: 20,
        ptoDays: 10,
        sickDays: 10,
        ...m,
      })
    }
  })

  // Ensure scenario tasks array
  data.scenarios.forEach(s => { if (!s.tasks) s.tasks = [] })

  // Ensure project settings
  if (!data.project) {
    data.project = {
      startDate: '2026-01-01',
      endDate: null,
      ongoing: true,
      milestones: [
        { id: 'MS-1', name: 'Project Kick-off',  date: null, order: 0, fixed: true },
        { id: 'MS-2', name: 'Pre-Production',     date: null, order: 1, fixed: true },
        { id: 'MS-3', name: 'Production',         date: null, order: 2, fixed: true },
        { id: 'MS-4', name: 'Alpha',              date: null, order: 3, fixed: true },
        { id: 'MS-5', name: 'Beta',               date: null, order: 4, fixed: true },
        { id: 'MS-6', name: 'Final',              date: null, order: 5, fixed: true },
      ],
      bufferPercent: 0,
    }
  }
  if (!data.counters.milestone) data.counters.milestone = 6
  if (!data.project.sprintCapacities) data.project.sprintCapacities = {}

  return data
}

// ─── Persistence ─────────────────────────────────────────────────────────────
function persist(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch (_) {}
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const migrated = migrate(parsed)
      persist(migrated)
      return migrated
    }
  } catch (_) {}
  const sample = getSampleData()
  persist(sample)
  return sample
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useDataStore = create((set, get) => {
  const initialData = loadFromStorage()

  return {
    // ── State ──────────────────────────────────────────────────────────────
    data: initialData,
    sprints: computeSprints(initialData.project),

    // ── Internal helpers ───────────────────────────────────────────────────
    _save(data) {
      persist(data)
      set({ data, sprints: computeSprints(data.project) })
    },

    // ── Collection helpers ─────────────────────────────────────────────────
    getCollection(type) {
      const { data } = get()
      if (type === 'initiative') return data.initiatives
      if (type === 'epic')       return data.epics
      if (type === 'task')       return data.tasks
      if (type === 'member')     return data.team
      return []
    },

    // ── Load / reload ──────────────────────────────────────────────────────
    loadData() {
      const data = loadFromStorage()
      set({ data, sprints: computeSprints(data.project) })
    },

    reloadFromSample() {
      const data = getSampleData()
      get()._save(data)
    },

    // ── Project ────────────────────────────────────────────────────────────
    updateProject(updates) {
      const data = { ...get().data, project: { ...get().data.project, ...updates } }
      get()._save(data)
    },

    setSprintCapacity(sprintId, hours) {
      const data = structuredClone(get().data)
      data.project.sprintCapacities[sprintId] = hours
      get()._save(data)
    },

    // ── Generic CRUD ───────────────────────────────────────────────────────
    createItem(type, fields, scenarioId = null) {
      const data = structuredClone(get().data)
      const keyMap = { initiative: 'initiatives', epic: 'epics', task: 'tasks', member: 'team' }
      const counterMap = { initiative: 'initiative', epic: 'epic', task: 'task', member: 'member' }
      const prefixMap = { initiative: 'INI', epic: 'EP', task: 'TASK', member: 'TM' }

      data.counters[counterMap[type]]++
      const id = `${prefixMap[type]}-${data.counters[counterMap[type]]}`
      const coll = scenarioId
        ? data.scenarios.find(s => s.id === scenarioId)?.tasks
        : data[keyMap[type]]

      if (!coll) return null
      const maxOrder = coll.length ? Math.max(...coll.map(i => i.order ?? 0)) + 1 : 0
      const item = { id, order: maxOrder, ...fields }
      coll.push(item)
      get()._save(data)
      return item
    },

    updateItem(type, id, updates, scenarioId = null) {
      const data = structuredClone(get().data)
      const keyMap = { initiative: 'initiatives', epic: 'epics', task: 'tasks', member: 'team' }
      const coll = data[keyMap[type]]

      const idx = coll.findIndex(i => i.id === id)
      if (idx >= 0) {
        Object.assign(coll[idx], updates)
      } else if (type === 'task' && scenarioId) {
        const scn = data.scenarios.find(s => s.id === scenarioId)
        if (scn) {
          const si = (scn.tasks || []).findIndex(t => t.id === id)
          if (si >= 0) Object.assign(scn.tasks[si], updates)
        }
      }
      get()._save(data)
    },

    removeItem(type, id, scenarioId = null) {
      const data = structuredClone(get().data)
      const keyMap = { initiative: 'initiatives', epic: 'epics', task: 'tasks', member: 'team' }
      const key = keyMap[type]
      const prev = data[key].length
      data[key] = data[key].filter(i => i.id !== id)

      if (data[key].length === prev && type === 'task' && scenarioId) {
        const scn = data.scenarios.find(s => s.id === scenarioId)
        if (scn) scn.tasks = (scn.tasks || []).filter(t => t.id !== id)
      }

      // Cascade: epic deleted → null out task epicIds
      if (type === 'epic') {
        data.tasks.forEach(t => { if (t.epicId === id) t.epicId = null })
        if (scenarioId) {
          const scn = data.scenarios.find(s => s.id === scenarioId)
          ;(scn?.tasks || []).forEach(t => { if (t.epicId === id) t.epicId = null })
        }
      }

      // Cascade: initiative deleted → null out epic initiativeIds
      if (type === 'initiative') {
        data.epics.forEach(e => { if (e.initiativeId === id) e.initiativeId = null })
      }

      // Cascade: remove any base deps involving this item
      data.dependencies = data.dependencies.filter(d => d.fromId !== id && d.toId !== id)
      if (scenarioId) {
        const scn = data.scenarios.find(s => s.id === scenarioId)
        if (scn) {
          scn.dependencies = (scn.dependencies || []).filter(d => d.fromId !== id && d.toId !== id)
        }
      }

      get()._save(data)
    },

    // ── Comments ───────────────────────────────────────────────────────────
    addComment(taskId, text, author) {
      const data = structuredClone(get().data)
      if (!data.comments[taskId]) data.comments[taskId] = []
      data.comments[taskId].push({ id: `c-${Date.now()}`, text, author, createdAt: Date.now() })
      get()._save(data)
    },

    removeComment(taskId, commentId) {
      const data = structuredClone(get().data)
      if (data.comments[taskId]) {
        data.comments[taskId] = data.comments[taskId].filter(c => c.id !== commentId)
      }
      get()._save(data)
    },

    // ── Summary notes ──────────────────────────────────────────────────────
    updateSummaryNote(key, value) {
      const data = structuredClone(get().data)
      data.summaryNotes[key] = value
      get()._save(data)
    },

    // ── Dependencies ───────────────────────────────────────────────────────
    addDependency(fromId, toId, scenarioId = null) {
      if (fromId === toId) return
      const data = structuredClone(get().data)
      const deps = scenarioId
        ? (data.scenarios.find(s => s.id === scenarioId)?.dependencies ?? data.dependencies)
        : data.dependencies

      if (deps.some(d => d.fromId === fromId && d.toId === toId)) return
      deps.push({ id: `dep-${Date.now()}`, fromId, toId })
      get()._save(data)
    },

    removeDependency(depId, scenarioId = null) {
      const data = structuredClone(get().data)
      if (scenarioId) {
        const scn = data.scenarios.find(s => s.id === scenarioId)
        if (scn) scn.dependencies = scn.dependencies.filter(d => d.id !== depId)
      } else {
        data.dependencies = data.dependencies.filter(d => d.id !== depId)
      }
      get()._save(data)
    },

    // ── Scenarios ──────────────────────────────────────────────────────────
    createScenario(name) {
      const data = structuredClone(get().data)
      data.counters.scenario++
      const { scenario, id } = buildScenario(name, data.counters.scenario, data.tasks, data.dependencies)
      data.scenarios.push(scenario)
      get()._save(data)
      return id
    },

    deleteScenario(id) {
      const data = structuredClone(get().data)
      data.scenarios = data.scenarios.filter(s => s.id !== id)
      get()._save(data)
    },

    commitScenario(id) {
      const data = structuredClone(get().data)
      const scn = data.scenarios.find(s => s.id === id)
      if (!scn) return
      const { tasks, dependencies } = applyScenarioCommit(scn, data.tasks)
      data.tasks = tasks
      data.dependencies = dependencies
      data.scenarios = data.scenarios.filter(s => s.id !== id)
      get()._save(data)
    },

    // ── Reorder (drag-and-drop within same type) ───────────────────────────
    reorderItems(type, dragId, targetId, position) {
      // position: 'before' | 'after' | 'inside'
      // 'inside' = reparent (task→epic or epic→initiative)
      const data = structuredClone(get().data)
      const keyMap = { initiative: 'initiatives', epic: 'epics', task: 'tasks' }
      const coll = data[keyMap[type]]
      if (!coll) return

      const drag   = coll.find(i => i.id === dragId)
      const target = coll.find(i => i.id === targetId)
      if (!drag || !target) return

      if (position === 'inside') {
        // Reparent: task → epic, epic → initiative
        if (type === 'task')  drag.epicId        = targetId
        if (type === 'epic')  drag.initiativeId  = targetId
        // Re-order at end of new parent's children
        const parentField = type === 'task' ? 'epicId' : 'initiativeId'
        const siblings = coll
          .filter(i => i[parentField] === drag[parentField])
          .sort((a, b) => a.order - b.order)
        siblings.forEach((item, i) => { item.order = i })
      } else {
        // Same-type reorder — adopt the target's parent
        if (type === 'task')  drag.epicId        = target.epicId
        if (type === 'epic')  drag.initiativeId  = target.initiativeId

        const parentField = type === 'task' ? 'epicId' : type === 'epic' ? 'initiativeId' : null
        let siblings
        if (parentField) {
          siblings = coll
            .filter(i => i[parentField] === drag[parentField])
            .sort((a, b) => a.order - b.order)
        } else {
          siblings = [...coll].sort((a, b) => a.order - b.order)
        }

        const fi = siblings.findIndex(i => i.id === dragId)
        if (fi >= 0) siblings.splice(fi, 1)
        let ti = siblings.findIndex(i => i.id === targetId)
        if (ti < 0) ti = siblings.length
        if (position === 'after') ti++
        siblings.splice(ti, 0, drag)
        siblings.forEach((item, i) => { item.order = i })
      }

      get()._save(data)
    },

    updateScenarioSprintOverride(scenarioId, taskId, sprintId) {
      const data = structuredClone(get().data)
      const scn = data.scenarios.find(s => s.id === scenarioId)
      if (scn) {
        scn.sprintOverrides[taskId] = sprintId
        get()._save(data)
      }
    },

    // ── Team ───────────────────────────────────────────────────────────────
    updateTeamMember(id, updates) {
      get().updateItem('member', id, updates)
    },

    removeTeamMember(id) {
      get().removeItem('member', id)
    },

    // ── Milestones ─────────────────────────────────────────────────────────
    updateMilestone(id, updates) {
      const data = structuredClone(get().data)
      const ms = data.project.milestones?.find(m => m.id === id)
      if (ms) Object.assign(ms, updates)
      get()._save(data)
    },

    addMilestone(fields) {
      const data = structuredClone(get().data)
      data.counters.milestone = (data.counters.milestone || 0) + 1
      const milestone = { id: `MS-${data.counters.milestone}`, order: data.project.milestones.length, ...fields }
      data.project.milestones.push(milestone)
      get()._save(data)
      return milestone
    },

    removeMilestone(id) {
      const data = structuredClone(get().data)
      data.project.milestones = data.project.milestones.filter(m => m.id !== id)
      get()._save(data)
    },
  }
})
