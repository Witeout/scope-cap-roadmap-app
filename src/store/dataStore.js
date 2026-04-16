import { create } from 'zustand'
import { getSampleData } from '../data/sample'
import { computeSprints } from '../lib/sprints'
import { buildScenario, applyScenarioCommit } from '../lib/scenarios'

// ─── Storage keys ──────────────────────────────────────────────────────────────
const META_KEY       = 'scopeCapMeta_v1'
const LEGACY_KEY     = 'scopeCapData_v3'
const projectDataKey = id => `scopeCapProject_v1_${id}`

// ─── Blank project factory ─────────────────────────────────────────────────────
function createBlankData(name, startDate) {
  const sd = startDate || new Date().toISOString().slice(0, 10)
  return {
    tasks: [], epics: [], initiatives: [], team: [],
    scenarios: [], dependencies: [], comments: {}, summaryNotes: {}, teamGroups: [],
    counters: {
      initiative: 0, epic: 0, task: 0, member: 0,
      scenario: 0, teamGroup: 0, release: 1, milestone: 1,
    },
    project: {
      name,
      startDate: sd,
      endDate: null,
      ongoing: true,
      releases: [{
        id: 'REL-1',
        name: 'Major Milestones',
        startDate: sd,
        endDate: null,
        color: '#4a6fa5',
        order: 0,
        milestones: [{ id: 'MS-1', name: '', date: null, fixed: false, order: 0 }],
      }],
      bufferPercent: 0,
      regions: [],
      customHolidays: [],
      sprintCapacities: {},
    },
  }
}

// ─── Migration helper ──────────────────────────────────────────────────────────
function migrate(data) {
  if (!data.comments) data.comments = {}
  if (!data.dependencies) data.dependencies = []
  if (!data.team) data.team = []
  if (!data.counters.member) data.counters.member = 0
  if (!data.scenarios) data.scenarios = []
  if (!data.counters.scenario) data.counters.scenario = 0
  if (!data.summaryNotes) data.summaryNotes = {}
  if (!data.teamGroups) data.teamGroups = []
  if (!data.counters.teamGroup) data.counters.teamGroup = 0

  // Normalize tasks
  data.tasks.forEach(t => {
    if (t.sprintId === undefined) t.sprintId = null
    if (t.teamId === undefined) t.teamId = null
    if (t.releaseId === undefined) t.releaseId = null
  })

  // Normalize epics
  data.epics.forEach(e => {
    if (e.teamId === undefined) e.teamId = null
    if (e.releaseId === undefined) e.releaseId = null
  })

  // Normalize initiatives
  data.initiatives.forEach(i => {
    if (i.teamId === undefined) i.teamId = null
    if (i.releaseId === undefined) i.releaseId = null
  })

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
      name: 'My Project',
      startDate: '2026-01-01',
      endDate: null,
      ongoing: true,
      releases: [],
      bufferPercent: 0,
    }
  }

  // Migrate project name
  if (!data.project.name) data.project.name = 'My Project'

  // ── Migrate flat milestones → first release ──────────────────────────────
  if (!data.project.releases) {
    const legacyMilestones = data.project.milestones ?? []
    data.project.releases = legacyMilestones.length > 0
      ? [{
          id: 'REL-1',
          name: 'Major Milestones',
          startDate: data.project.startDate ?? '2026-01-01',
          endDate: data.project.endDate ?? null,
          color: '#4a6fa5',
          order: 0,
          milestones: legacyMilestones,
        }]
      : []
    delete data.project.milestones
    if (!data.counters.release) {
      data.counters.release = data.project.releases.length
    }
  }

  if (!data.counters.release) data.counters.release = data.project.releases.length

  // Ensure each release has a milestones array
  data.project.releases.forEach(r => { if (!r.milestones) r.milestones = [] })

  if (!data.counters.milestone) data.counters.milestone = 0
  if (!data.project.sprintCapacities) data.project.sprintCapacities = {}
  if (!data.project.regions) data.project.regions = []
  if (!data.project.customHolidays) {
    data.project.customHolidays = data.project.holidays ?? []
    delete data.project.holidays
  }

  return data
}

// ─── Persistence helpers ───────────────────────────────────────────────────────
function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function saveMeta(meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)) } catch {}
}

function persistProjectData(projectId, data) {
  try { localStorage.setItem(projectDataKey(projectId), JSON.stringify(data)) } catch {}
}

function loadProjectData(projectId) {
  try {
    const raw = localStorage.getItem(projectDataKey(projectId))
    if (raw) {
      const parsed = JSON.parse(raw)
      return migrate(parsed)
    }
  } catch {}
  return null
}

// ─── Storage initialization ────────────────────────────────────────────────────
// Handles first-run migration from legacy single-project storage.
function initStorage() {
  let meta = loadMeta()

  if (!meta) {
    // First run — migrate legacy data or start fresh from sample
    const firstId = 'proj-1'
    let firstData

    const legacyRaw = localStorage.getItem(LEGACY_KEY)
    if (legacyRaw) {
      try {
        const parsed = JSON.parse(legacyRaw)
        firstData = migrate(parsed)
      } catch {
        firstData = createBlankData('My Project', '2026-01-01')
      }
    } else {
      firstData = getSampleData()
      migrate(firstData)
      if (!firstData.project.name) firstData.project.name = 'My Project'
    }

    persistProjectData(firstId, firstData)
    meta = {
      activeProjectId: firstId,
      nextProjectId: 2,
      projects: [{ id: firstId, name: firstData.project?.name || 'My Project', createdAt: Date.now() }],
    }
    saveMeta(meta)
    return { meta, data: firstData }
  }

  // Load active project data
  let data = loadProjectData(meta.activeProjectId)
  if (!data) {
    // Active project missing — fall back to first available
    const fallback = meta.projects[0]
    if (fallback && fallback.id !== meta.activeProjectId) {
      data = loadProjectData(fallback.id) ?? createBlankData(fallback.name, '2026-01-01')
      meta = { ...meta, activeProjectId: fallback.id }
      saveMeta(meta)
    } else {
      data = createBlankData('My Project', '2026-01-01')
    }
  }

  return { meta, data }
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useDataStore = create((set, get) => {
  const { meta: initialMeta, data: initialData } = initStorage()

  return {
    // ── State ──────────────────────────────────────────────────────────────
    meta: initialMeta,
    data: initialData,
    sprints: computeSprints(initialData.project),

    // ── Internal helpers ───────────────────────────────────────────────────
    _save(data) {
      const { meta } = get()
      persistProjectData(meta.activeProjectId, data)
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
      const { meta } = get()
      const data = loadProjectData(meta.activeProjectId)
      if (data) set({ data, sprints: computeSprints(data.project) })
    },

    reloadFromSample() {
      const data = getSampleData()
      migrate(data)
      get()._save(data)
    },

    // ── Multi-project ──────────────────────────────────────────────────────
    createProject(name, startDate) {
      const meta = get().meta
      const id = `proj-${meta.nextProjectId}`
      const data = createBlankData(name, startDate)
      persistProjectData(id, data)

      const newMeta = {
        ...meta,
        activeProjectId: id,
        nextProjectId: meta.nextProjectId + 1,
        projects: [...meta.projects, { id, name, createdAt: Date.now() }],
      }
      saveMeta(newMeta)
      set({ meta: newMeta, data, sprints: computeSprints(data.project) })
      return id
    },

    switchProject(id) {
      if (id === get().meta.activeProjectId) return
      const data = loadProjectData(id)
      if (!data) return

      const newMeta = { ...get().meta, activeProjectId: id }
      saveMeta(newMeta)
      set({ meta: newMeta, data, sprints: computeSprints(data.project) })
    },

    // ── Project ────────────────────────────────────────────────────────────
    updateProject(updates) {
      const data = { ...get().data, project: { ...get().data.project, ...updates } }
      // Keep meta project name in sync when name changes
      if (updates.name !== undefined) {
        const meta = get().meta
        const newMeta = {
          ...meta,
          projects: meta.projects.map(p =>
            p.id === meta.activeProjectId ? { ...p, name: updates.name } : p
          ),
        }
        saveMeta(newMeta)
        set({ meta: newMeta })
      }
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

      let item = { id, order: maxOrder, ...fields }
      if (type === 'task' || type === 'epic' || type === 'initiative') {
        item.teamId = fields.teamId ?? null
      }

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

      if (type === 'epic') {
        data.tasks.forEach(t => { if (t.epicId === id) t.epicId = null })
        if (scenarioId) {
          const scn = data.scenarios.find(s => s.id === scenarioId)
          ;(scn?.tasks || []).forEach(t => { if (t.epicId === id) t.epicId = null })
        }
      }

      if (type === 'initiative') {
        data.epics.forEach(e => { if (e.initiativeId === id) e.initiativeId = null })
      }

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

    updateComment(taskId, commentId, text) {
      const data = structuredClone(get().data)
      if (data.comments[taskId]) {
        const c = data.comments[taskId].find(c => c.id === commentId)
        if (c) { c.text = text; c.editedAt = Date.now() }
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
      const data = structuredClone(get().data)
      const keyMap = { initiative: 'initiatives', epic: 'epics', task: 'tasks' }
      const coll = data[keyMap[type]]
      if (!coll) return

      const drag   = coll.find(i => i.id === dragId)
      const target = coll.find(i => i.id === targetId)
      if (!drag || !target) return

      if (position === 'inside') {
        if (type === 'task')  drag.epicId        = targetId
        if (type === 'epic')  drag.initiativeId  = targetId
        const parentField = type === 'task' ? 'epicId' : 'initiativeId'
        const siblings = coll
          .filter(i => i[parentField] === drag[parentField])
          .sort((a, b) => a.order - b.order)
        siblings.forEach((item, i) => { item.order = i })
      } else {
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

    // ── Team Groups ────────────────────────────────────────────────────────
    createTeamGroup(name, color) {
      const data = structuredClone(get().data)
      data.counters.teamGroup++
      const id = `TG-${data.counters.teamGroup}`
      const group = { id, name, color, members: [] }
      data.teamGroups.push(group)
      get()._save(data)
      return group
    },

    updateTeamGroup(id, updates) {
      const data = structuredClone(get().data)
      const group = data.teamGroups.find(g => g.id === id)
      if (group) Object.assign(group, updates)
      get()._save(data)
    },

    removeTeamGroup(id) {
      const data = structuredClone(get().data)
      data.teamGroups = data.teamGroups.filter(g => g.id !== id)
      data.tasks.forEach(t => { if (t.teamId === id) t.teamId = null })
      data.epics.forEach(e => { if (e.teamId === id) e.teamId = null })
      data.initiatives.forEach(i => { if (i.teamId === id) i.teamId = null })
      get()._save(data)
    },

    addTeamGroupMember(groupId, memberId, allocation) {
      const data = structuredClone(get().data)
      const group = data.teamGroups.find(g => g.id === groupId)
      if (group && !group.members.some(m => m.memberId === memberId)) {
        group.members.push({ memberId, allocation })
      }
      get()._save(data)
    },

    updateTeamGroupMember(groupId, memberId, allocation) {
      const data = structuredClone(get().data)
      const group = data.teamGroups.find(g => g.id === groupId)
      if (group) {
        const member = group.members.find(m => m.memberId === memberId)
        if (member) member.allocation = allocation
      }
      get()._save(data)
    },

    removeTeamGroupMember(groupId, memberId) {
      const data = structuredClone(get().data)
      const group = data.teamGroups.find(g => g.id === groupId)
      if (group) {
        group.members = group.members.filter(m => m.memberId !== memberId)
      }
      get()._save(data)
    },

    // ── Team ───────────────────────────────────────────────────────────────
    updateTeamMember(id, updates) {
      get().updateItem('member', id, updates)
    },

    removeTeamMember(id) {
      get().removeItem('member', id)
    },

    // ── Releases ───────────────────────────────────────────────────────────
    addRelease(fields) {
      const data = structuredClone(get().data)
      data.counters.release = (data.counters.release || 0) + 1
      const release = {
        id: `REL-${data.counters.release}`,
        name: 'New Release',
        startDate: null,
        endDate: null,
        color: '#4a6fa5',
        order: data.project.releases.length,
        milestones: [],
        ...fields,
      }
      data.project.releases.push(release)
      get()._save(data)
      return release
    },

    updateRelease(id, updates) {
      const data = structuredClone(get().data)
      const release = data.project.releases.find(r => r.id === id)
      if (release) Object.assign(release, updates)
      get()._save(data)
    },

    removeRelease(id) {
      const data = structuredClone(get().data)
      data.project.releases = data.project.releases.filter(r => r.id !== id)
      data.initiatives.forEach(i => { if (i.releaseId === id) i.releaseId = null })
      data.epics.forEach(e => { if (e.releaseId === id) e.releaseId = null })
      data.tasks.forEach(t => { if (t.releaseId === id) t.releaseId = null })
      get()._save(data)
    },

    // ── Holidays & Regions ─────────────────────────────────────────────────
    updateRegions(regions) {
      get().updateProject({ regions })
    },

    addHoliday(fields) {
      const data = structuredClone(get().data)
      const holiday = { id: `hol-${Date.now()}`, name: '', startDate: null, endDate: null, region: 'Global', source: 'custom', ...fields }
      data.project.customHolidays = [...(data.project.customHolidays || []), holiday]
      get()._save(data)
      return holiday
    },

    removeHoliday(id) {
      const data = structuredClone(get().data)
      data.project.customHolidays = (data.project.customHolidays || []).filter(h => h.id !== id)
      get()._save(data)
    },

    // ── Milestones (scoped to a release) ──────────────────────────────────
    _findMilestone(data, id) {
      for (const r of data.project.releases) {
        const ms = r.milestones?.find(m => m.id === id)
        if (ms) return { release: r, milestone: ms }
      }
      return null
    },

    updateMilestone(id, updates) {
      const data = structuredClone(get().data)
      const found = get()._findMilestone(data, id)
      if (found) Object.assign(found.milestone, updates)
      get()._save(data)
    },

    addMilestone(releaseId, fields) {
      const data = structuredClone(get().data)
      const release = data.project.releases.find(r => r.id === releaseId)
      if (!release) return null
      data.counters.milestone = (data.counters.milestone || 0) + 1
      const milestone = {
        id: `MS-${data.counters.milestone}`,
        order: release.milestones.length,
        name: '',
        date: null,
        fixed: false,
        ...fields,
      }
      release.milestones.push(milestone)
      get()._save(data)
      return milestone
    },

    removeMilestone(id) {
      const data = structuredClone(get().data)
      for (const r of data.project.releases) {
        const before = r.milestones.length
        r.milestones = r.milestones.filter(m => m.id !== id)
        if (r.milestones.length !== before) break
      }
      get()._save(data)
    },
  }
})
