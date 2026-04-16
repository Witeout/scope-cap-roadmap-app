import { create } from 'zustand'

const SNAPSHOT_KEY = 'scopeCapSnapshots_v1'

function loadSnapshots() {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) {
    return []
  }
}

function persistSnapshots(snapshots) {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots))
  } catch (_) {}
}

export const useSnapshotStore = create((set, get) => ({
  snapshots: loadSnapshots(),

  saveSnapshot(snapshotData) {
    // Prepend so list is most-recent-first
    const snapshots = [snapshotData, ...get().snapshots]
    persistSnapshots(snapshots)
    set({ snapshots })
  },

  deleteSnapshot(id) {
    const snapshots = get().snapshots.filter(s => s.snapshotId !== id)
    persistSnapshots(snapshots)
    set({ snapshots })
  },
}))
