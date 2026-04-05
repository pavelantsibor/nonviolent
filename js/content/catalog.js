import intro from "./modules/intro.js";
import work from "./modules/work.js";
import home from "./modules/home.js";
import family from "./modules/family.js";
import friends from "./modules/friends.js";
import transit from "./modules/transit.js";
import restaurant from "./modules/restaurant.js";

export const MODULE_ORDER = [
  "intro",
  "work",
  "home",
  "family",
  "friends",
  "transit",
  "restaurant",
];

const MODULES = {
  intro,
  work,
  home,
  family,
  friends,
  transit,
  restaurant,
};

export function getModule(id) {
  return MODULES[id] || null;
}

export function getAllModules() {
  return MODULE_ORDER.map((id) => MODULES[id]);
}

/** Всего интерактивных шагов (уроков) во всех модулях */
export function getTotalCourseSteps() {
  return MODULE_ORDER.reduce((acc, id) => {
    const m = MODULES[id];
    return acc + (m?.steps?.length ?? 0);
  }, 0);
}

/**
 * Оценка пройденных шагов: завершённые модули целиком + текущий индекс шага в незавершённых.
 * stepProgress[moduleId] — индекс текущего шага (0-based); завершённые до него шаги = stepProgress.
 */
export function getCompletedCourseSteps(state) {
  let n = 0;
  for (const id of MODULE_ORDER) {
    const m = MODULES[id];
    const steps = m?.steps?.length ?? 0;
    if (!steps) continue;
    if (state.completedModules?.includes(id)) {
      n += steps;
    } else {
      const cur = state.stepProgress?.[id] ?? 0;
      n += Math.min(Math.max(0, cur), steps);
    }
  }
  return n;
}

/** Число смысловых разделов в модуле (по sectionsOutline или уникальным step.section) */
export function getModuleSectionCount(module) {
  if (!module) return 0;
  if (Array.isArray(module.sectionsOutline) && module.sectionsOutline.length > 0) {
    return module.sectionsOutline.length;
  }
  const ids = new Set();
  for (const s of module.steps || []) {
    if (s.section) ids.add(s.section);
  }
  return ids.size;
}

/**
 * Разделы модуля для «карты пути»: границы шагов [startStep, endStep] по индексам.
 */
export function getModuleSectionSlices(module) {
  const steps = module?.steps;
  if (!steps?.length) return [];

  const outline = module.sectionsOutline;
  if (Array.isArray(outline) && outline.length > 0) {
    const slices = [];
    for (const o of outline) {
      const idxs = [];
      steps.forEach((st, i) => {
        if (st.section === o.id) idxs.push(i);
      });
      if (idxs.length === 0) continue;
      slices.push({
        id: o.id,
        title: o.title,
        startStep: Math.min(...idxs),
        endStep: Math.max(...idxs),
        stepCount: idxs.length,
      });
    }
    if (slices.length > 0) return slices;
  }

  const order = [];
  const seen = new Set();
  for (const st of steps) {
    const id = st.section || "__whole";
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  return order.map((id) => {
    const idxs = [];
    steps.forEach((st, i) => {
      const sid = st.section || "__whole";
      if (sid === id) idxs.push(i);
    });
    const titleFromStep = steps[idxs[0]]?.sectionTitle;
    return {
      id,
      title: titleFromStep || "Урок",
      startStep: Math.min(...idxs),
      endStep: Math.max(...idxs),
      stepCount: idxs.length,
    };
  });
}

/** Последний шаг внутри своего раздела (section): после него начинается другой раздел или конец модуля */
export function isLastStepInSection(module, stepIndex) {
  const steps = module?.steps;
  if (!steps?.length || stepIndex < 0 || stepIndex >= steps.length) return true;
  const sid = steps[stepIndex]?.section || "__whole";
  for (let j = stepIndex + 1; j < steps.length; j++) {
    const s = steps[j]?.section || "__whole";
    if (s === sid) return false;
  }
  return true;
}

/** Состояние узла дорожки: done | current | locked */
export function getSectionPathStatus(slice, currentStep, moduleCompleted) {
  if (moduleCompleted) return "done";
  if (currentStep > slice.endStep) return "done";
  if (currentStep >= slice.startStep && currentStep <= slice.endStep) return "current";
  if (currentStep < slice.startStep) return "locked";
  return "current";
}
