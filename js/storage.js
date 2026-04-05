/**
 * Состояние приложения в localStorage
 */
const KEY = "nvc-trainer-v1";
const SCHEMA = 7;

function defaultState() {
  return {
    schema: SCHEMA,
    completedModules: [],
    lastModuleId: null,
    stepProgress: {},
    /** Баллы текущей сессии модуля (между этапами, пока модуль не завершён) */
    moduleSessionPoints: {},
    /** Накопленные баллы OFNR по компонентам между этапами */
    moduleOfnrPartial: {},
    collection: [],
    stats: { sessions: 0 },
    giraffePoints: 0,
    feelingsDiary: [],
    /** Записи дневника: чувства → потребности → ситуация, с датой */
    diaryEntries: [],
    /** Завершён ли пошаговый тур при первом запуске */
    onboardingDone: false,
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
  const fromSchema = old.schema ?? 1;
  if (Array.isArray(old.completedModules)) n.completedModules = old.completedModules;
  if (typeof old.giraffePoints === "number") n.giraffePoints = old.giraffePoints;
  if (Array.isArray(old.collection)) n.collection = old.collection;
  if (Array.isArray(old.feelingsDiary)) n.feelingsDiary = old.feelingsDiary;
  if (Array.isArray(old.diaryEntries)) n.diaryEntries = old.diaryEntries;
  if (old.moduleSessionPoints && typeof old.moduleSessionPoints === "object") {
    n.moduleSessionPoints = { ...old.moduleSessionPoints };
  }
  if (old.moduleOfnrPartial && typeof old.moduleOfnrPartial === "object") {
    n.moduleOfnrPartial = { ...old.moduleOfnrPartial };
  }
  if (old.stepProgress && typeof old.stepProgress === "object") {
    n.stepProgress = { ...old.stepProgress };
    /* Схема 3: перестроены модули (новые шаги в начале) — старые индексы невалидны */
    if (fromSchema < 3) {
      n.stepProgress = {};
    }
    /* Схема 4: снова изменена длина шагов (theory_reveal вместо пары theory) */
    if (fromSchema < 4) {
      n.stepProgress = {};
    }
  }
  /* Схема 5: тур при первом запуске — у кого уже был прогресс, не показываем */
  if (fromSchema < 5) {
    n.onboardingDone = true;
  }
  /*
   * Схема 6: сильно выросло число шагов во всех тематических модулях (и в intro).
   * stepProgress хранит индекс шага — после вставок в середину старые индексы указывают на другие уроки.
   * Сбрасываем прогресс по шагам и частичные баллы сессии; завершённые модули и коллекция сохраняются.
   */
  if (fromSchema < 6) {
    n.stepProgress = {};
    n.moduleSessionPoints = {};
    n.moduleOfnrPartial = {};
  }
  /* Схема 7: дневник — полные записи; старый «чипы» переносим в одну запись */
  if (fromSchema < 7) {
    const legacy = Array.isArray(n.feelingsDiary) ? n.feelingsDiary.filter(Boolean) : [];
    if (!Array.isArray(n.diaryEntries)) n.diaryEntries = [];
    if (legacy.length > 0 && n.diaryEntries.length === 0) {
      n.diaryEntries.push({
        id: `migrated-${Date.now()}`,
        createdAt: new Date().toISOString(),
        feelingIds: legacy.slice(0, 48),
        needIds: [],
        situation: "",
      });
    }
    n.feelingsDiary = [];
  }
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

export function getModuleSessionPoints(moduleId) {
  const s = loadState();
  const v = s.moduleSessionPoints?.[moduleId];
  return typeof v === "number" ? v : 0;
}

export function setModuleSessionPoints(moduleId, points) {
  const s = loadState();
  if (!s.moduleSessionPoints) s.moduleSessionPoints = {};
  s.moduleSessionPoints[moduleId] = Math.max(0, Math.round(Number(points)) || 0);
  saveState(s);
}

export function clearModuleSessionPoints(moduleId) {
  const s = loadState();
  if (s.moduleSessionPoints && moduleId in s.moduleSessionPoints) {
    delete s.moduleSessionPoints[moduleId];
    saveState(s);
  }
}

const EMPTY_OFNR = { observation: 0, feeling: 0, need: 0, request: 0 };

export function getModuleOfnrPartial(moduleId) {
  const s = loadState();
  const o = s.moduleOfnrPartial?.[moduleId];
  if (!o || typeof o !== "object") return { ...EMPTY_OFNR };
  return { ...EMPTY_OFNR, ...o };
}

export function setModuleOfnrPartial(moduleId, ofnrPoints) {
  const s = loadState();
  if (!s.moduleOfnrPartial) s.moduleOfnrPartial = {};
  s.moduleOfnrPartial[moduleId] = { ...EMPTY_OFNR, ...(ofnrPoints || {}) };
  saveState(s);
}

export function clearModuleOfnrPartial(moduleId) {
  const s = loadState();
  if (s.moduleOfnrPartial && moduleId in s.moduleOfnrPartial) {
    delete s.moduleOfnrPartial[moduleId];
    saveState(s);
  }
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
  const keepOnboarding = loadState().onboardingDone === true;
  const n = defaultState();
  if (keepOnboarding) n.onboardingDone = true;
  saveState(n);
}

export function isOnboardingDone() {
  return loadState().onboardingDone === true;
}

export function markOnboardingDone() {
  const s = loadState();
  s.onboardingDone = true;
  saveState(s);
}

/** Сбросить тур (для повторного просмотра или теста) */
export function resetOnboarding() {
  const s = loadState();
  s.onboardingDone = false;
  saveState(s);
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

/** Дневник самоэмпатии (legacy): устарело — используйте addDiaryEntry */
export function saveFeelingsDiary(feelingIds) {
  const s = loadState();
  s.feelingsDiary = Array.isArray(feelingIds) ? feelingIds.slice(0, 24) : [];
  saveState(s);
}

export function getFeelingsDiary() {
  return loadState().feelingsDiary || [];
}

export function getDiaryEntries() {
  const s = loadState();
  return Array.isArray(s.diaryEntries) ? s.diaryEntries : [];
}

export function addDiaryEntry({ feelingIds, needIds, situation }) {
  const s = loadState();
  if (!Array.isArray(s.diaryEntries)) s.diaryEntries = [];
  const entry = {
    id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    feelingIds: Array.isArray(feelingIds) ? [...new Set(feelingIds)].slice(0, 48) : [],
    needIds: Array.isArray(needIds) ? [...new Set(needIds)].slice(0, 48) : [],
    situation: typeof situation === "string" ? situation.slice(0, 8000) : "",
  };
  s.diaryEntries.unshift(entry);
  saveState(s);
  return entry;
}

export function deleteDiaryEntry(id) {
  const s = loadState();
  s.diaryEntries = (s.diaryEntries || []).filter((e) => e && e.id !== id);
  saveState(s);
}
