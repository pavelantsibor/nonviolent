/**
 * Состояние приложения в localStorage
 */
const KEY = "nvc-trainer-v1";
const SCHEMA = 1;

function defaultState() {
  return {
    schema: SCHEMA,
    completedModules: [],
    lastModuleId: null,
    stepProgress: {},
    collection: [],
    stats: { sessions: 0 },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (parsed.schema !== SCHEMA) {
      return migrate(parsed);
    }
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

function migrate(old) {
  const n = defaultState();
  if (Array.isArray(old.completedModules)) n.completedModules = old.completedModules;
  return n;
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function getState() {
  return loadState();
}

export function markModuleCompleted(moduleId) {
  const s = loadState();
  if (!s.completedModules.includes(moduleId)) {
    s.completedModules.push(moduleId);
  }
  s.lastModuleId = moduleId;
  saveState(s);
  return s;
}

export function setStepIndex(moduleId, index) {
  const s = loadState();
  s.stepProgress[moduleId] = index;
  saveState(s);
}

export function getStepIndex(moduleId) {
  const s = loadState();
  return s.stepProgress[moduleId] ?? 0;
}

export function addCollectionItem(itemId) {
  const s = loadState();
  if (!s.collection.includes(itemId)) s.collection.push(itemId);
  saveState(s);
}

export function isModuleUnlocked(moduleId, moduleOrder) {
  const s = loadState();
  const idx = moduleOrder.indexOf(moduleId);
  if (idx <= 0) return true;
  const prev = moduleOrder[idx - 1];
  return s.completedModules.includes(prev);
}

export function resetProgress() {
  saveState(defaultState());
}
