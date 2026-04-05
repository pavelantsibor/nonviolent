import {
  getAllModules,
  MODULE_ORDER,
  getModule,
  getTotalCourseSteps,
  getCompletedCourseSteps,
  getModuleSectionCount,
  getModuleSectionSlices,
  getSectionPathStatus,
} from "./content/catalog.js";
import * as storage from "./storage.js";
import { LessonEngine } from "./lesson-engine.js";
import { withViewTransition } from "./view-transition.js";
import { flattenFeelingsWheel, flattenNeeds, formatDiaryDate } from "./feelings-diary.js";

const app = document.getElementById("app");
let currentEngine = null;
let activeModuleId = null;

const ONBOARDING_STEPS = [
  {
    title: "Добро пожаловать",
    body: "Это тренажёр ненасильственного общения (ННО): Жираф — образ тёплого ясного тона. Ниже — как выглядит шапка приложения. Двигайтесь в своём темпе.",
    emoji: "🦒",
  },
  {
    title: "Главная",
    body: "Сводный прогресс курса, сад по контекстам, список модулей и подарки — всё на одном экране. Модули открываются по очереди.",
    emoji: "🌿",
  },
  {
    title: "Карта модуля",
    body: "Внутри модуля — дорожка этапов (разделов). После этапа вы снова здесь и видите галочки и текущий кружок. Так же, как на схеме ниже.",
    emoji: "🛤️",
  },
  {
    title: "Урок",
    body: "Каждый шаг — отдельный экран: заголовок, прогресс, текст и варианты или упражнение. Баллы мягкие, ориентир без оценки «успех/провал».",
    emoji: "📖",
  },
];

/** Статичные мини-макеты интерфейса для тура (не интерактивны) */
function getOnboardingPreviewHtml(stepIndex) {
  const cap = "Упрощённый вид экрана";
  if (stepIndex === 0) {
    return `
      <div class="onboarding-preview onboarding-preview--hero" aria-hidden="true">
        <p class="onboarding-preview__caption muted">${cap}</p>
        <div class="onboarding-preview__hero card">
          <div class="onboarding-preview__hero-mascots"><span>🦒</span></div>
          <p class="onboarding-preview__hero-brand">ННО Тренажёр</p>
          <p class="muted" style="margin:0;font-size:0.78rem">Язык Жирафа</p>
        </div>
      </div>`;
  }
  if (stepIndex === 1) {
    return `
      <div class="onboarding-preview onboarding-preview--home" aria-hidden="true">
        <p class="onboarding-preview__caption muted">${cap}</p>
        <div class="onboarding-preview__stack">
          <div class="onboarding-preview__block card card--feature">
            <div class="onboarding-preview__block-h">Ваш рост</div>
            <div class="onboarding-preview__scene">
              <div class="onboarding-preview__sky"></div>
              <div class="onboarding-preview__wall onboarding-preview__wall--l"></div>
              <div class="onboarding-preview__wall onboarding-preview__wall--r"></div>
              <div class="onboarding-preview__g-mini">🦒</div>
            </div>
            <p class="muted" style="margin:8px 0 0;font-size:0.72rem">Шаги и модули — цифрами</p>
          </div>
          <div class="onboarding-preview__row">
            <div class="onboarding-preview__block card garden-card">
              <div class="onboarding-preview__block-h">Сад Жирафа</div>
              <div class="onboarding-preview__garden">
                <span>🌱</span><span>💼</span><span class="onboarding-preview__dim">🔒</span>
              </div>
            </div>
            <div class="onboarding-preview__block card">
              <div class="onboarding-preview__block-h">Модули</div>
              <div class="onboarding-preview__fake-card">
                <span class="badge badge--giraffe">🦒</span>
                <span class="onboarding-preview__fake-text"></span>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }
  if (stepIndex === 2) {
    return `
      <div class="onboarding-preview onboarding-preview--map" aria-hidden="true">
        <p class="onboarding-preview__caption muted">${cap}</p>
        <div class="onboarding-preview__map card">
          <p class="onboarding-preview__map-kicker muted">Модуль</p>
          <p class="onboarding-preview__map-title">Название модуля</p>
          <div class="onboarding-preview__path-wrap">
            <div class="onboarding-preview__path-line" aria-hidden="true"></div>
            <ul class="onboarding-preview__path-list">
              <li class="onboarding-preview__path-item onboarding-preview__path-item--right">
                <div class="onboarding-preview__node onboarding-preview__node--done">✓</div>
                <span class="onboarding-preview__path-cap muted">Раздел 1</span>
              </li>
              <li class="onboarding-preview__path-item onboarding-preview__path-item--left">
                <div class="onboarding-preview__node onboarding-preview__node--current">🦒</div>
                <span class="onboarding-preview__path-cap muted">Раздел 2</span>
              </li>
              <li class="onboarding-preview__path-item onboarding-preview__path-item--right">
                <div class="onboarding-preview__node onboarding-preview__node--locked">★</div>
                <span class="onboarding-preview__path-cap muted">Раздел 3</span>
              </li>
            </ul>
          </div>
          <div class="btn btn--primary onboarding-preview__fake-btn">Продолжить</div>
        </div>
      </div>`;
  }
  if (stepIndex === 3) {
    return `
      <div class="onboarding-preview onboarding-preview--lesson" aria-hidden="true">
        <p class="onboarding-preview__caption muted">${cap}</p>
        <div class="onboarding-preview__lesson card">
          <div class="onboarding-preview__lesson-head">
            <span class="tag">Шаг 3 из 12</span>
            <button type="button" class="lesson-header__close" tabindex="-1" aria-hidden="true">×</button>
          </div>
          <div class="onboarding-preview__lesson-bar" aria-hidden="true"><span></span></div>
          <h3 class="onboarding-preview__lesson-h">Заголовок шага</h3>
          <p class="muted onboarding-preview__lesson-p">Текст задания или теории — на всю ширину.</p>
          <div class="onboarding-preview__fake-choices">
            <span class="onboarding-preview__fake-choice">Вариант А</span>
            <span class="onboarding-preview__fake-choice">Вариант Б</span>
          </div>
        </div>
      </div>`;
  }
  return "";
}

function showFirstRunOnboarding(onDone) {
  let step = 0;
  const total = ONBOARDING_STEPS.length;
  let onEscape = null;
  const render = () => {
    if (onEscape) {
      document.removeEventListener("keydown", onEscape);
      onEscape = null;
    }
    const s = ONBOARDING_STEPS[step];
    const isLast = step >= total - 1;
    const dots = ONBOARDING_STEPS.map((_, i) => `<span class="onboarding__dot${i === step ? " is-active" : ""}" aria-hidden="true"></span>`).join("");
    const finish = () => {
      if (onEscape) {
        document.removeEventListener("keydown", onEscape);
        onEscape = null;
      }
      storage.markOnboardingDone();
      onDone();
    };
    onEscape = (e) => {
      if (e.key === "Escape") finish();
    };
    document.addEventListener("keydown", onEscape);
    /* Без View Transitions: иначе в ряде браузеров DOM обновляется позже, getElementById даёт null,
       а слой перехода может перехватывать клики до конца анимации. */
    app.innerHTML = `
        <div class="onboarding" id="onboarding-root" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
          <div class="onboarding__panel card onboarding__panel--with-preview">
            <div class="onboarding__emoji" aria-hidden="true">${s.emoji}</div>
            <p class="onboarding__step muted">Шаг ${step + 1} из ${total}</p>
            <h2 id="onboarding-title" class="onboarding__title">${escapeHtml(s.title)}</h2>
            ${getOnboardingPreviewHtml(step)}
            <p class="onboarding__body">${escapeHtml(s.body)}</p>
            <div class="onboarding__dots" aria-hidden="true">${dots}</div>
            <div class="onboarding__actions">
              <button type="button" class="btn btn--ghost" id="onboarding-skip">Пропустить</button>
              <button type="button" class="btn btn--primary" id="onboarding-next">${isLast ? "Начать" : "Далее"}</button>
            </div>
          </div>
        </div>
      `;
    document.getElementById("onboarding-skip")?.addEventListener("click", finish);
    document.getElementById("onboarding-next")?.addEventListener("click", () => {
      if (isLast) finish();
      else {
        step += 1;
        render();
      }
    });
    document.getElementById("onboarding-next")?.focus();
  };
  render();
}

function showHome() {
  if (!storage.isOnboardingDone()) {
    showFirstRunOnboarding(() => showHome());
    return;
  }

  const st = storage.getState();
  const modules = getAllModules();
  const completed = st.completedModules.length;
  const total = modules.length;

  const cards = modules
    .map((m) => {
      const unlocked = storage.isModuleUnlocked(m.id, MODULE_ORDER);
      const done = st.completedModules.includes(m.id);
      const lockClass = unlocked ? "" : "card--locked";
      const secN = getModuleSectionCount(m);
      const secPart = secN > 0 ? `${secN} разделов · ` : "";
      const meta = `${secPart}${m.estimatedMinutes || "—"} мин · ${done ? "пройдено" : "не начато"}`;
      return `
        <article class="card card--clickable ${lockClass}" data-module-id="${m.id}" ${unlocked ? "" : 'aria-disabled="true"'}>
          <div class="badge-row">
            <span class="badge badge--giraffe">${m.badge?.emoji || "🦒"}</span>
            ${done ? '<span class="tag" style="margin:0">Готово</span>' : ""}
          </div>
          <h3 class="card__title">${escapeHtml(m.title)}</h3>
          <p class="card__meta">${escapeHtml(m.goal || "")}</p>
          <p class="card__meta">${escapeHtml(meta)}</p>
        </article>
      `;
    })
    .join("");

  const totalLessonSteps = getTotalCourseSteps();
  const doneLessonSteps = getCompletedCourseSteps(st);
  const courseComplete = totalLessonSteps > 0 && doneLessonSteps >= totalLessonSteps;
  const courseProgress = courseComplete
    ? 1
    : totalLessonSteps > 0
      ? Math.min(1, doneLessonSteps / totalLessonSteps)
      : 0;
  const giraffePoints = storage.getGiraffePoints();

  const collectionItems = MODULE_ORDER.filter((id) => st.completedModules.includes(id))
    .map((id) => {
      const mod = getModule(id);
      if (!mod?.badge) return "";
      const g = mod.badge;
      const giftTitle = g.giftTitle || g.label;
      const giftDesc = g.giftDescription || "";
      return `
        <div class="gift-card" title="${escapeHtml(giftTitle)}">
          <span class="gift-card__emoji" aria-hidden="true">${g.emoji || "🦒"}</span>
          <strong class="gift-card__title">${escapeHtml(giftTitle)}</strong>
          <p class="gift-card__desc muted">${escapeHtml(giftDesc)}</p>
        </div>`;
    })
    .join("");

  const collectionBlock = collectionItems
    ? `<div class="collection-grid">${collectionItems}</div>`
    : '<p class="muted" style="margin:0">Пока пусто.</p>';

  const lockedSlots = MODULE_ORDER.filter((id) => !st.completedModules.includes(id)).length;

  withViewTransition(() => {
  app.innerHTML = `
    <section class="screen is-active" id="screen-home">
      <div class="hero">
        <div class="hero-mascots" aria-hidden="true"><span class="hero-mascots__g">🦒</span></div>
        <h1>ННО Тренажёр</h1>
        <p class="muted">ННО: язык Жирафа и Волка (М. Розенберг).</p>
      </div>

      <div class="card card--feature">
        <h2 style="margin:0 0 8px;font-size:1rem">Ваш рост</h2>
        <div class="giraffe-progress${courseComplete ? " giraffe-progress--complete" : ""}" style="--course-progress:${courseProgress}" role="img" aria-label="Пройдено шагов курса: ${doneLessonSteps} из ${totalLessonSteps}">
          <div class="giraffe-progress__scene">
            <div class="giraffe-progress__sky" aria-hidden="true"></div>
            <div class="giraffe-progress__wall giraffe-progress__wall--left" aria-hidden="true"></div>
            <div class="giraffe-progress__wall giraffe-progress__wall--right" aria-hidden="true"></div>
            <div class="giraffe-progress__giraffe">
              <div class="giraffe-progress__stack">
                <div class="giraffe-progress__neck"></div>
                <div class="giraffe-progress__head" aria-hidden="true">🦒</div>
              </div>
            </div>
          </div>
        </div>
        <p class="muted" style="margin:8px 0 4px;font-size:0.9rem">Шаги курса: <strong>${doneLessonSteps}</strong> / ${totalLessonSteps} · модули: <strong>${completed}</strong> / ${total}</p>
        <p class="muted" style="margin:0;font-size:0.9rem">Баллы Жирафа: <strong>${giraffePoints}</strong></p>
      </div>

      <div class="card garden-card">
        <h2 style="margin:0 0 8px;font-size:1rem">Сад Жирафа</h2>
        <div class="garden-grid" role="list" aria-label="Прогресс по контекстам">
          ${MODULE_ORDER.map((id) => {
            const m = getModule(id);
            const done = st.completedModules.includes(id);
            const emoji = m?.badge?.emoji || "🌿";
            const title = m?.title || id;
            return `<div class="garden-slot${done ? "" : " garden-slot--locked"}" title="${escapeHtml(title)}"><span class="garden-slot__emoji" aria-hidden="true">${emoji}</span><span class="garden-slot__cap">${escapeHtml(title)}</span></div>`;
          }).join("")}
        </div>
      </div>

      <h2 class="muted" style="font-size:0.85rem;margin:20px 0 10px">Модули</h2>
      ${cards}

      <div class="card" style="margin-top:16px">
        <h2 style="margin:0 0 8px;font-size:1rem">Подарки гармонии</h2>
        ${collectionBlock}
        ${lockedSlots ? `<p class="muted" style="font-size:0.8rem;margin-top:8px">Осталось модулей: ${lockedSlots}</p>` : ""}
      </div>

      <p style="margin-top:16px">
        <button type="button" class="btn btn--secondary" id="btn-reference">Чувства и потребности</button>
      </p>
      <p style="margin-top:8px">
        <button type="button" class="btn btn--ghost" id="btn-reset">Сбросить прогресс</button>
      </p>

      <div class="disclaimer">Не замена терапии или юр./мед. помощи в острых ситуациях.</div>
      <p style="margin-top:12px;text-align:center">
        <button type="button" class="btn btn--ghost" id="btn-onboarding-tour" style="font-size:0.85rem;min-height:40px">Показать тур снова</button>
      </p>
    </section>
  `;

  app.querySelectorAll(".card--clickable[data-module-id]").forEach((el) => {
    el.addEventListener("click", () => {
      if (el.classList.contains("card--locked")) return;
      const id = el.getAttribute("data-module-id");
      showModuleMap(id);
    });
  });

  const refBtn = document.getElementById("btn-reference");
  if (refBtn) refBtn.addEventListener("click", () => showReference());

  const resetBtn = document.getElementById("btn-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Сбросить весь прогресс и коллекцию?")) {
        storage.resetProgress();
        showHome();
      }
    });
  }

  document.getElementById("btn-onboarding-tour")?.addEventListener("click", () => {
    storage.resetOnboarding();
    showFirstRunOnboarding(() => showHome());
  });
  });
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : String(str);
  return d.innerHTML;
}

/** Модальное поздравление при первом получении подарка за модуль */
function showGiftCelebrationModal(mod, onContinue) {
  const b = mod.badge;
  if (!b) {
    onContinue();
    return;
  }
  const title = b.giftTitle || b.label || "Награда";
  const desc = b.giftDescription || "";
  let finished = false;
  const go = () => {
    if (finished) return;
    finished = true;
    document.removeEventListener("keydown", onKey);
    onContinue();
  };
  function onKey(e) {
    if (e.key === "Escape") go();
  }
  document.addEventListener("keydown", onKey);
  withViewTransition(() => {
    app.innerHTML = `
      <div class="gift-celebration" id="gift-celebration">
        <div class="gift-celebration__backdrop" data-gift-celebration-dismiss tabindex="-1" aria-hidden="true"></div>
        <div class="gift-celebration__panel card" role="dialog" aria-modal="true" aria-labelledby="gift-celebration-heading">
          <p class="gift-celebration__kicker tag" style="margin:0 0 10px">Новый подарок</p>
          <div class="gift-celebration__emoji" aria-hidden="true">${b.emoji || "🦒"}</div>
          <h2 id="gift-celebration-heading" class="gift-celebration__title">Поздравляем!</h2>
          <p class="gift-celebration__lead">Вы открыли награду в коллекции «Подарки гармонии».</p>
          <p class="gift-celebration__gift-name"><strong>${escapeHtml(title)}</strong></p>
          ${desc ? `<p class="muted gift-celebration__desc">${escapeHtml(desc)}</p>` : ""}
          <button type="button" class="btn btn--primary" id="gift-celebration-continue">Продолжить</button>
        </div>
      </div>
    `;
    document.getElementById("gift-celebration-continue")?.addEventListener("click", go);
    document.querySelectorAll("[data-gift-celebration-dismiss]").forEach((el) => {
      el.addEventListener("click", go);
    });
    document.getElementById("gift-celebration-continue")?.focus();
  });
}

function showModuleMap(moduleId) {
  const mod = getModule(moduleId);
  if (!mod) return;
  activeModuleId = moduleId;
  const st = storage.getState();
  const completed = st.completedModules.includes(moduleId);
  const currentStep = st.stepProgress?.[moduleId] ?? 0;
  const totalSteps = mod.steps?.length ?? 0;
  const slices = getModuleSectionSlices(mod);
  if (slices.length === 0) {
    withViewTransition(() => {
      app.innerHTML = `
      <section class="screen is-active module-map-screen">
        <p class="muted">В модуле нет шагов.</p>
        <button type="button" class="btn btn--primary" id="module-map-fallback-back">Назад</button>
      </section>`;
      document.getElementById("module-map-fallback-back")?.addEventListener("click", showHome);
    });
    return;
  }

  const pathItems = slices.map((slice, i) => {
    const status = getSectionPathStatus(slice, currentStep, completed);
    const side = i % 2 === 0 ? "module-path__segment--right" : "module-path__segment--left";
    const modClass =
      status === "done"
        ? "module-path__node--done"
        : status === "current"
          ? "module-path__node--current"
          : "module-path__node--locked";
    const icon =
      status === "done" ? "✓" : status === "current" ? (mod.badge?.emoji || "🦒") : "★";
    const sub = `${slice.stepCount} шаг${slice.stepCount === 1 ? "" : slice.stepCount < 5 ? "а" : "ов"}`;
    const startBadge =
      status === "current"
        ? `<span class="module-path__start-badge" aria-hidden="true">Старт</span>`
        : "";
    return `
      <li class="module-path__segment ${side}" data-section-id="${escapeHtml(slice.id)}">
        <div class="module-path__node-wrap">
        <button type="button"
          class="module-path__node ${modClass}"
          data-status="${status}"
          data-start-step="${slice.startStep}"
          ${status === "locked" ? "disabled" : ""}
          aria-label="${escapeHtml(slice.title)}: ${status === "done" ? "пройдено" : status === "current" ? "текущий раздел" : "закрыто"}">
          <span class="module-path__node-inner" aria-hidden="true">${icon}</span>
        </button>
        ${startBadge}
        </div>
        <div class="module-path__caption">
          <span class="module-path__title">${escapeHtml(slice.title)}</span>
          <span class="module-path__meta muted">${sub}</span>
        </div>
      </li>`;
  });

  const continueLabel = completed
    ? "Пройти снова с начала"
    : currentStep >= totalSteps - 1 && totalSteps > 0
      ? "Открыть последний шаг"
      : "Продолжить обучение";

  withViewTransition(() => {
  app.innerHTML = `
    <section class="screen is-active module-map-screen">
      <div class="module-map-header">
        <button type="button" class="module-map-back" id="module-map-back" aria-label="Назад к модулям">←</button>
        <div class="module-map-header__text">
          <p class="module-map-kicker muted">Модуль</p>
          <h1 class="module-map-title">${escapeHtml(mod.title)}</h1>
          <p class="module-map-goal muted">${escapeHtml(mod.goal || "")}</p>
        </div>
      </div>
      <div class="module-map-hero" aria-hidden="true">
        <span class="module-map-mascot">${mod.badge?.emoji || "🦒"}</span>
      </div>
      <ol class="module-path" role="list">
        ${pathItems.join("")}
      </ol>
      <button type="button" class="btn btn--primary" id="module-map-continue">${escapeHtml(continueLabel)}</button>
      <button type="button" class="btn btn--ghost" id="module-map-home" style="margin-top:10px">На главную</button>
    </section>
  `;

  document.getElementById("module-map-back")?.addEventListener("click", showHome);
  document.getElementById("module-map-home")?.addEventListener("click", showHome);
  document.getElementById("module-map-continue")?.addEventListener("click", () => {
    if (completed) {
      startLesson(moduleId, 0);
    } else {
      startLesson(moduleId);
    }
  });

  app.querySelectorAll(".module-path__node:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => {
      const status = btn.getAttribute("data-status");
      const rawStart = parseInt(btn.getAttribute("data-start-step"), 10);
      const start = Number.isNaN(rawStart) ? 0 : rawStart;
      if (status === "done") {
        startLesson(moduleId, start);
      } else if (status === "current") {
        startLesson(moduleId);
      }
    });
  });
  });
}

function startLesson(moduleId, fromStepIndex) {
  const mod = getModule(moduleId);
  if (!mod) return;
  activeModuleId = moduleId;
  const container = document.createElement("div");
  app.innerHTML = "";
  app.appendChild(container);

  const st = storage.getState();
  const saved = storage.getStepIndex(moduleId);
  const len = mod.steps?.length || 1;
  let startAt = saved;
  if (typeof fromStepIndex === "number" && !Number.isNaN(fromStepIndex)) {
    startAt = Math.max(0, Math.min(fromStepIndex, len - 1));
    const jumpOrReplay =
      fromStepIndex !== saved ||
      (st.completedModules.includes(moduleId) && fromStepIndex === 0);
    if (jumpOrReplay) {
      storage.clearModuleSessionPoints(moduleId);
      storage.clearModuleOfnrPartial(moduleId);
    }
  }
  startAt = Math.min(Math.max(0, startAt), len - 1);

  const initialSessionPoints = storage.getModuleSessionPoints(moduleId);
  const initialOfnrPoints = storage.getModuleOfnrPartial(moduleId);

  const exitAbort = new AbortController();

  currentEngine = new LessonEngine(mod, container, {
    initialSessionPoints,
    initialOfnrPoints,
    onStepChange: (i) => storage.setStepIndex(moduleId, i),
    onSectionComplete: (m, meta) => {
      exitAbort.abort();
      storage.setStepIndex(m.id, meta.nextStepIndex);
      storage.setModuleSessionPoints(m.id, meta.sessionPoints);
      storage.setModuleOfnrPartial(m.id, meta.ofnrPoints);
      currentEngine = null;
      showModuleMap(m.id);
    },
    onComplete: (m, meta) => {
      exitAbort.abort();
      const st0 = storage.getState();
      const isFirstGift =
        Boolean(m.badge?.id) && !st0.collection.includes(m.badge.id);
      storage.markModuleCompleted(m.id);
      if (m.badge?.id) storage.addCollectionItem(m.badge.id);
      if (meta?.points) storage.addGiraffePoints(meta.points);
      storage.clearModuleSessionPoints(m.id);
      storage.clearModuleOfnrPartial(m.id);
      storage.setStepIndex(m.id, 0);
      currentEngine = null;
      const points = meta?.points ?? 0;
      const ofnr = meta?.ofnr;
      if (isFirstGift && m.badge) {
        showGiftCelebrationModal(m, () => showSummary(m, points, ofnr));
      } else {
        showSummary(m, points, ofnr);
      }
    },
  });

  currentEngine.start(startAt);

  const onLessonExit = () => {
    const eng = currentEngine;
    if (eng) {
      const snap = eng.getProgressSnapshot();
      storage.setStepIndex(moduleId, snap.stepIndex);
      storage.setModuleSessionPoints(moduleId, snap.sessionPoints);
      storage.setModuleOfnrPartial(moduleId, snap.ofnrPoints);
    }
    currentEngine = null;
    showModuleMap(moduleId);
  };
  window.addEventListener("nvc-lesson-exit", onLessonExit, { once: true, signal: exitAbort.signal });
}

async function showReference() {
  let fr = null;
  let nr = null;
  try {
    [fr, nr] = await Promise.all([
      fetch("data/reference/feelings.json").then((r) => r.json()),
      fetch("data/reference/needs.json").then((r) => r.json()),
    ]);
  } catch {
    fr = null;
    nr = null;
  }

  const flatFeelings = fr ? flattenFeelingsWheel(fr) : [];
  const flatNeeds = nr ? flattenNeeds(nr) : [];
  const labelByFeeling = Object.fromEntries(flatFeelings.map((x) => [x.id, x.label]));
  const labelByNeed = Object.fromEntries(flatNeeds.map((x) => [x.id, x.label]));

  let feelingsRefHtml = "";
  let needsRefHtml = "";
  if (fr && nr) {
    if (fr.groups) {
      feelingsRefHtml = fr.groups
        .map(
          (g) => `
        <h3 class="feelings-wheel__group-title">${escapeHtml(g.label)}</h3>
        ${(g.subgroups || [])
          .map(
            (sg) => `
          <p class="feelings-wheel__sub muted">${escapeHtml(sg.label)}</p>
          <ul class="feelings-wheel__list">${(sg.items || []).map((i) => `<li>${escapeHtml(i.label)}</li>`).join("")}</ul>
        `
          )
          .join("")}`
        )
        .join("");
    } else {
      const pos = (fr.positive || []).map((x) => `<li>${escapeHtml(x.label)}</li>`).join("");
      const hvy = (fr.heavy || []).map((x) => `<li>${escapeHtml(x.label)}</li>`).join("");
      feelingsRefHtml = `<h3>Позитивные чувства</h3><ul>${pos}</ul><h3>Тяжёлые чувства</h3><ul>${hvy}</ul>`;
    }
    needsRefHtml = (nr.categories || [])
      .map(
        (c) => `
      <h3>${escapeHtml(c.label)}</h3>
      <ul>${(c.items || []).map((i) => `<li>${escapeHtml(i.label)}</li>`).join("")}</ul>
    `
      )
      .join("");
  } else {
    feelingsRefHtml = "<p class=\"muted\">Откройте приложение через локальный сервер, чтобы загрузить справочники.</p>";
  }

  let wolfHtml = "";
  try {
    const w = await fetch("data/reference/wolf_markers.json").then((r) => r.json());
    wolfHtml = `<ul>${(w.markers || []).map((m) => `<li><strong>${escapeHtml(m.word)}</strong> — ${escapeHtml(m.hint)}</li>`).join("")}</ul>`;
  } catch {
    wolfHtml = "";
  }

  const state = {
    view: "hub",
    draft: { feelingIds: [], needIds: [], situation: "" },
    detailId: null,
  };

  function buildFeelingsWheelChips(selected) {
    if (!fr?.groups) return "<p class=\"muted\">Нет данных колеса эмоций.</p>";
    return fr.groups
      .map(
        (g) => `
      <section class="feelings-wheel__block card feelings-wheel__block--${escapeHtml(g.id)}" aria-labelledby="feelings-g-${escapeHtml(g.id)}">
        <h3 id="feelings-g-${escapeHtml(g.id)}" class="feelings-wheel__group-title">${escapeHtml(g.label)}</h3>
        ${(g.subgroups || [])
          .map(
            (sg) => `
          <div class="feelings-wheel__subblock feelings-wheel__subblock--${escapeHtml(sg.id)}">
            <h4 class="feelings-wheel__sub">${escapeHtml(sg.label)}</h4>
            <div class="diary-chips" role="group" aria-label="${escapeHtml(sg.label)}">
              ${(sg.items || [])
                .map((it) => {
                  const on = selected.includes(it.id) ? " is-on" : "";
                  return `<button type="button" class="diary-chip${on}" data-diary-feeling="${escapeHtml(it.id)}">${escapeHtml(it.label)}</button>`;
                })
                .join("")}
            </div>
          </div>
        `
          )
          .join("")}
      </section>`
      )
      .join("");
  }

  function buildNeedsChips(selected) {
    if (!nr?.categories) return "<p class=\"muted\">Нет списка потребностей.</p>";
    return nr.categories
      .map(
        (c) => `
      <section class="feelings-wheel__block card" aria-labelledby="needs-c-${escapeHtml(c.id)}">
        <h3 id="needs-c-${escapeHtml(c.id)}" class="feelings-wheel__group-title">${escapeHtml(c.label)}</h3>
        <div class="diary-chips" role="group">
          ${(c.items || [])
            .map((it) => {
              const on = selected.includes(it.id) ? " is-on" : "";
              return `<button type="button" class="diary-chip diary-chip--need${on}" data-diary-need="${escapeHtml(it.id)}">${escapeHtml(it.label)}</button>`;
            })
            .join("")}
        </div>
      </section>`
      )
      .join("");
  }

  function renderDiary() {
    const entries = storage.getDiaryEntries();
    let body = "";

    if (state.view === "hub") {
      const hasEntries = entries.length > 0;
      body = `
        <div class="card diary-hub">
          <h3 class="diary-hub__title">Дневник чувств</h3>
          <p class="muted diary-hub__lead">Три шага: чувства по колесу эмоций → потребности → коротко опишите ситуацию. Записи сохраняются в браузере с датой и временем.</p>
          <div class="diary-hub__actions">
            <button type="button" class="btn btn--primary" id="diary-action-new">${hasEntries ? "Новая запись" : "Начать запись"}</button>
            ${hasEntries ? `<button type="button" class="btn btn--secondary" id="diary-action-list">Прошлые записи (${entries.length})</button>` : ""}
          </div>
          <p class="diary-hub__ref"><button type="button" class="btn btn--ghost" id="diary-action-ref" style="font-size:0.88rem;min-height:40px">Справочник: полные списки</button></p>
        </div>`;
    } else if (state.view === "new-1") {
      body = `
        <div class="card">
          <p class="tag diary-step">Шаг 1 из 3</p>
          <h3 class="diary-step-title">Чувства</h3>
          <p class="muted">Отметьте всё, что сейчас откликается. Это самоэмпатия, не оценка.</p>
          ${buildFeelingsWheelChips(state.draft.feelingIds)}
          <div class="diary-nav">
            <button type="button" class="btn btn--ghost" id="diary-cancel">Отмена</button>
            <button type="button" class="btn btn--primary" id="diary-next-1" ${state.draft.feelingIds.length ? "" : " disabled"}>Далее</button>
          </div>
        </div>`;
    } else if (state.view === "new-2") {
      body = `
        <div class="card">
          <p class="tag diary-step">Шаг 2 из 3</p>
          <h3 class="diary-step-title">Потребности</h3>
          <p class="muted">Что для вас сейчас важно за этими чувствами?</p>
          ${buildNeedsChips(state.draft.needIds)}
          <div class="diary-nav">
            <button type="button" class="btn btn--ghost" id="diary-back-2">Назад</button>
            <button type="button" class="btn btn--primary" id="diary-next-2" ${state.draft.needIds.length ? "" : " disabled"}>Далее</button>
          </div>
        </div>`;
    } else if (state.view === "new-3") {
      body = `
        <div class="card">
          <p class="tag diary-step">Шаг 3 из 3</p>
          <h3 class="diary-step-title">Ситуация</h3>
          <p class="muted">Коротко: что происходило? Без обязательства быть «правильным».</p>
          <textarea class="refl-textarea diary-situation" id="diary-situation" rows="5" maxlength="4000" placeholder="Например: разговор с…, я заметил(а)…"></textarea>
          <div class="diary-nav">
            <button type="button" class="btn btn--ghost" id="diary-back-3">Назад</button>
            <button type="button" class="btn btn--primary" id="diary-save">Сохранить запись</button>
          </div>
        </div>`;
    } else if (state.view === "list") {
      body = `
        <div class="card">
          <h3 style="margin-top:0">Прошлые записи</h3>
          ${entries.length === 0 ? "<p class=\"muted\">Пока нет записей.</p>" : `<ul class="diary-entry-list">${entries.map((e) => {
            const preview = (e.situation || "").trim().slice(0, 80);
            const tail = (e.situation || "").trim().length > 80 ? "…" : "";
            return `<li class="diary-entry-list__item">
              <button type="button" class="diary-entry-list__btn" data-diary-entry-id="${escapeHtml(e.id)}">
                <span class="diary-entry-list__date">${escapeHtml(formatDiaryDate(e.createdAt))}</span>
                <span class="diary-entry-list__preview muted">${escapeHtml(preview || "без описания ситуации")}${tail}</span>
              </button>
            </li>`;
          }).join("")}</ul>`}
          <div class="diary-nav diary-nav--stack">
            <button type="button" class="btn btn--secondary" id="diary-list-new">Новая запись</button>
            <button type="button" class="btn btn--ghost" id="diary-list-back">К дневнику</button>
          </div>
        </div>`;
    } else if (state.view === "detail") {
      const e = entries.find((x) => x.id === state.detailId);
      if (!e) {
        state.view = "list";
        renderDiary();
        return;
      }
      const fl = (e.feelingIds || []).map((id) => labelByFeeling[id] || id).join(", ") || "—";
      const nl = (e.needIds || []).map((id) => labelByNeed[id] || id).join(", ") || "—";
      body = `
        <div class="card diary-entry-detail">
          <p class="muted diary-entry-detail__date">${escapeHtml(formatDiaryDate(e.createdAt))}</p>
          <h3 style="margin:0 0 8px">Чувства</h3>
          <p>${escapeHtml(fl)}</p>
          <h3 style="margin:16px 0 8px">Потребности</h3>
          <p>${escapeHtml(nl)}</p>
          <h3 style="margin:16px 0 8px">Ситуация</h3>
          <p class="diary-entry-detail__situation">${escapeHtml(e.situation || "—")}</p>
          <div class="diary-nav diary-nav--stack">
            <button type="button" class="btn btn--ghost" id="diary-detail-back">К списку</button>
            <button type="button" class="btn btn--danger-ghost" id="diary-detail-delete">Удалить запись</button>
          </div>
        </div>`;
    } else if (state.view === "ref") {
      body = `
        <div class="card"><h3 style="margin-top:0">Чувства (полный список)</h3>${feelingsRefHtml}</div>
        <div class="card"><h3 style="margin-top:0">Потребности</h3>${needsRefHtml}</div>
        <div class="card"><h3 style="margin-top:0">Маркеры «Волка»</h3>${wolfHtml || "<p class=\"muted\">Нет данных.</p>"}</div>
        <div class="diary-nav">
          <button type="button" class="btn btn--ghost" id="diary-ref-back">К дневнику</button>
          <button type="button" class="btn btn--primary" id="ref-back">На главную</button>
        </div>`;
    }

    const title =
      state.view === "ref"
        ? "Справочник"
        : state.view === "list"
          ? "Записи"
          : state.view === "detail"
            ? "Запись"
            : state.view.startsWith("new")
              ? "Новая запись"
              : "Чувства и потребности";

    app.innerHTML = `
      <section class="screen is-active diary-reference-screen">
        <div class="lesson-header">
          <div class="lesson-header__inner">
            <div class="lesson-header__titles">
              <span class="tag">${state.view === "ref" ? "Справочник" : "Дневник"}</span>
              <h2>${escapeHtml(title)}</h2>
            </div>
            <button type="button" class="lesson-header__close" id="ref-close" aria-label="Назад">×</button>
          </div>
        </div>
        ${body}
        ${state.view === "hub" ? `<button type="button" class="btn btn--primary diary-footer-home" id="ref-back">На главную</button>` : state.view === "ref" ? "" : `<button type="button" class="btn btn--ghost diary-footer-home" id="ref-back">На главную</button>`}
      </section>
    `;

    document.getElementById("ref-close")?.addEventListener("click", showHome);
    document.getElementById("ref-back")?.addEventListener("click", showHome);

    document.getElementById("diary-action-new")?.addEventListener("click", () => {
      state.view = "new-1";
      state.draft = { feelingIds: [], needIds: [], situation: "" };
      renderDiary();
    });
    document.getElementById("diary-action-list")?.addEventListener("click", () => {
      state.view = "list";
      renderDiary();
    });
    document.getElementById("diary-action-ref")?.addEventListener("click", () => {
      state.view = "ref";
      renderDiary();
    });

    document.getElementById("diary-cancel")?.addEventListener("click", () => {
      state.view = "hub";
      renderDiary();
    });
    document.getElementById("diary-next-1")?.addEventListener("click", () => {
      if (!state.draft.feelingIds.length) return;
      state.view = "new-2";
      renderDiary();
    });
    document.getElementById("diary-back-2")?.addEventListener("click", () => {
      state.view = "new-1";
      renderDiary();
    });
    document.getElementById("diary-next-2")?.addEventListener("click", () => {
      if (!state.draft.needIds.length) return;
      state.view = "new-3";
      renderDiary();
    });
    document.getElementById("diary-back-3")?.addEventListener("click", () => {
      state.view = "new-2";
      const ta = document.getElementById("diary-situation");
      if (ta) state.draft.situation = ta.value;
      renderDiary();
    });

    document.getElementById("diary-save")?.addEventListener("click", () => {
      const ta = document.getElementById("diary-situation");
      const situation = ta ? ta.value : state.draft.situation;
      storage.addDiaryEntry({
        feelingIds: state.draft.feelingIds,
        needIds: state.draft.needIds,
        situation,
      });
      state.view = "hub";
      state.draft = { feelingIds: [], needIds: [], situation: "" };
      renderDiary();
    });

    document.getElementById("diary-list-new")?.addEventListener("click", () => {
      state.view = "new-1";
      state.draft = { feelingIds: [], needIds: [], situation: "" };
      renderDiary();
    });
    document.getElementById("diary-list-back")?.addEventListener("click", () => {
      state.view = "hub";
      renderDiary();
    });

    document.querySelectorAll("[data-diary-entry-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.detailId = btn.getAttribute("data-diary-entry-id");
        state.view = "detail";
        renderDiary();
      });
    });

    document.getElementById("diary-detail-back")?.addEventListener("click", () => {
      state.view = "list";
      renderDiary();
    });
    document.getElementById("diary-detail-delete")?.addEventListener("click", () => {
      if (confirm("Удалить эту запись?")) {
        storage.deleteDiaryEntry(state.detailId);
        state.view = "list";
        state.detailId = null;
        renderDiary();
      }
    });

    document.getElementById("diary-ref-back")?.addEventListener("click", () => {
      state.view = "hub";
      renderDiary();
    });

    app.querySelectorAll("[data-diary-feeling]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-diary-feeling");
        let cur = state.draft.feelingIds;
        if (cur.includes(id)) cur = cur.filter((x) => x !== id);
        else cur = [...cur, id];
        state.draft.feelingIds = cur;
        btn.classList.toggle("is-on", cur.includes(id));
        const next = document.getElementById("diary-next-1");
        if (next) next.disabled = cur.length === 0;
      });
    });

    app.querySelectorAll("[data-diary-need]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-diary-need");
        let cur = state.draft.needIds;
        if (cur.includes(id)) cur = cur.filter((x) => x !== id);
        else cur = [...cur, id];
        state.draft.needIds = cur;
        btn.classList.toggle("is-on", cur.includes(id));
        const next = document.getElementById("diary-next-2");
        if (next) next.disabled = cur.length === 0;
      });
    });

    const sitTa = document.getElementById("diary-situation");
    if (sitTa) {
      sitTa.value = state.draft.situation || "";
      sitTa.addEventListener("input", () => {
        state.draft.situation = sitTa.value;
      });
    }
  }

  withViewTransition(() => {
    renderDiary();
  });
}

function showSummary(mod, sessionPoints, ofnr) {
  const gift = mod.badge?.giftTitle || mod.badge?.label || "подарок";
  const giftDesc = mod.badge?.giftDescription || "";
  const ofnrKeys = ["observation", "feeling", "need", "request"];
  const ofnrRows =
    ofnr?.percent &&
    ofnrKeys
      .filter((k) => (ofnr.max?.[k] || 0) > 0)
      .map((k) => {
        const label = ofnr.labels?.[k] || k;
        const p = ofnr.percent[k] ?? 0;
        return `<li><strong>${escapeHtml(label)}</strong> — ${p}%</li>`;
      })
      .join("");
  const ofnrBlock =
    ofnrRows && ofnrRows.length
      ? `<div class="card">
        <h3 style="margin:0 0 8px;font-size:1rem">Ваш рост по компонентам ННО</h3>
        <ul style="margin:0;padding-left:1.2rem">${ofnrRows}</ul>
      </div>`
      : "";
  withViewTransition(() => {
  app.innerHTML = `
    <section class="screen is-active">
      <div class="hero">
        <div class="hero__emoji">${mod.badge?.emoji || "🦒"}</div>
        <h1>Модуль завершён</h1>
        <p class="muted">${escapeHtml(mod.title)}</p>
      </div>
      <div class="card">
        <p><strong>${escapeHtml(gift)}</strong>${giftDesc ? ` — ${escapeHtml(giftDesc)}` : ""}</p>
        <p class="muted" style="margin:10px 0 0">Баллы за модуль: <strong>${sessionPoints}</strong></p>
      </div>
      ${ofnrBlock}
      <button type="button" class="btn btn--primary" id="sum-continue">К модулям</button>
      <button type="button" class="btn btn--ghost" id="sum-map" style="margin-top:10px">К карте модуля</button>
    </section>
  `;
  document.getElementById("sum-continue")?.addEventListener("click", showHome);
  document.getElementById("sum-map")?.addEventListener("click", () => showModuleMap(mod.id));
  });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

/** Для теста тура из консоли: __nvcResetOnboarding() затем обновите страницу */
if (typeof window !== "undefined") {
  window.__nvcResetOnboarding = () => {
    storage.resetOnboarding();
    location.reload();
  };
}

showHome();
