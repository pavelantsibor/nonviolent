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
