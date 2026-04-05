/**
 * Состояние приложения в localStorage
 */
const KEY = "nvc-trainer-v1";
const SCHEMA = 2;

function defaultState() {
  return {
    schema: SCHEMA,
    completedModules: [],
    lastModuleId: null,
    stepProgress: {},
    collection: [],
    stats: { sessions: 0 },
    giraffePoints: 0,
    feelingsDiary: [],
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
  if (typeof old.giraffePoints === "number") n.giraffePoints = old.giraffePoints;
  if (Array.isArray(old.collection)) n.collection = old.collection;
  if (Array.isArray(old.feelingsDiary)) n.feelingsDiary = old.feelingsDiary;
  if (old.stepProgress && typeof old.stepProgress === "object") n.stepProgress = old.stepProgress;
  saveState(n);
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

/** Мягкие баллы «жирафьей» вовлечённости (2 / 1 / 0 за шаги) */
export function addGiraffePoints(delta) {
  const s = loadState();
  const n = Math.max(0, Math.round(Number(delta)) || 0);
  s.giraffePoints = (s.giraffePoints || 0) + n;
  saveState(s);
  return s.giraffePoints;
}

export function getGiraffePoints() {
  return loadState().giraffePoints || 0;
}

/** Дневник самоэмпатии: id чувств из справочника */
export function saveFeelingsDiary(feelingIds) {
  const s = loadState();
  s.feelingsDiary = Array.isArray(feelingIds) ? feelingIds.slice(0, 24) : [];
  saveState(s);
}

export function getFeelingsDiary() {
  return loadState().feelingsDiary || [];
}
