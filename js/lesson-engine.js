/**
 * Движок урока: рендер шагов, эмоциональная обратная связь, мягкие баллы
 */

import { flashTone, vibrateTone } from "./lesson-feedback.js";
import { fetchReferenceCompact, renderFeelingsNeedsHtml } from "./reference-data.js";
import {
  buildSectionMaxMap,
  getModuleSectionSlices,
  isLastStepInSection,
  starsFromScore,
} from "./content/catalog.js";
import { withViewTransition } from "./view-transition.js";

function escapeHtml(str) {
  if (str == null) return "";
  const d = document.createElement("div");
  d.textContent = String(str);
  return d.innerHTML;
}

/** Перемешивание id фишек банка — иначе верные ответы часто идут сверху вниз по слотам OFNR */
function shuffleBuildBankIds(ids) {
  const a = ids.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTheoryBody(text) {
  if (!text) return "";
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .split(/\n\n/g)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function inferOfnrFocus(step) {
  if (!step) return "mixed";
  if (step.ofnrFocus) return step.ofnrFocus;
  switch (step.type) {
    case "camera":
    case "sort":
      return "observation";
    case "select":
    case "theory_reveal":
    case "body_swap":
      return "feeling";
    case "reflection":
      return "need";
    case "build":
    case "dialog":
      return "request";
    default:
      return "mixed";
  }
}

/** Единая строка мягкой шкалы 2 / 1 / 0 */
function formatPointsLine(pts, kind = "default") {
  if (kind === "sort") {
    if (pts === 2) return "Баллы за шаг: 2";
    if (pts === 1) return "Баллы за шаг: 1 — почти всё верно";
    return "Баллы за шаг: 0 — можно повторить позже";
  }
  if (kind === "camera") {
    if (pts === 2) return "Баллы за шаг: 2";
    return "Баллы за шаг: 0 — камера не оценивает, она фиксирует.";
  }
  if (pts === 2) return "Баллы за шаг: 2 — чистый Жираф 🦒";
  if (pts === 1) return "Баллы за шаг: 1 — старающийся Жираф";
  return "Баллы за шаг: 0 — сработал Волк; это не провал, а сигнал.";
}

function renderThermometer(temp, opts = {}) {
  const t = Math.max(0, Math.min(100, temp));
  const label =
    t >= 70 ? "Тепло, контакт возможен" : t >= 40 ? "Нейтрально" : "Собеседник может закрыться";
  const pulseClass = opts.pulse ? " thermo--pulse-once" : "";
  return `
    <div class="thermo${pulseClass}" role="img" aria-label="Температура контакта: ${t} из 100">
      <div class="thermo__label">Контакт</div>
      <div class="thermo__track">
        <div class="thermo__fill" style="width:${t}%"></div>
      </div>
      <div class="thermo__meta">${escapeHtml(label)} · ${t}%</div>
    </div>
  `;
}

export class LessonEngine {
  constructor(moduleData, container, hooks = {}) {
    this.module = moduleData;
    this.container = container;
    this.hooks = hooks;
    this.stepIndex = 0;
    this.dialogNodeId = null;
    this.dialogTemp = 50;
    this._buildState = null;
    this._theoryRevealChoice = null;
    this._lastSelectId = null;
    this._bodySwapExpanded = false;
    this._lastBodySwapRenderedIdx = -1;
    this.bodySwapContact = 50;
    this.sessionPoints = 0;
    this._ofnrPoints = { observation: 0, feeling: 0, need: 0, request: 0 };
    this._sectionMaxMap = buildSectionMaxMap(moduleData);
    this._sectionEarned = {};
    this._buildSnapKey = null;
    /** История «мессенджера» для шагов type: dialog */
    this._dialogHistory = [];
    this._dialogHistoryStepIndex = -1;
    this._dialogAppendedNodeIds = new Set();
    this._dialogPrevHistoryLen = 0;
  }

  _sectionKey(step) {
    return step?.section || "__whole";
  }

  get steps() {
    return this.module.steps || [];
  }

  get totalSteps() {
    return this.steps.length;
  }

  /** Снимок для сохранения при выходе или смене экрана */
  getProgressSnapshot() {
    return {
      stepIndex: this.stepIndex,
      sessionPoints: this.sessionPoints,
      ofnrPoints: { ...this._ofnrPoints },
      sectionEarned: { ...this._sectionEarned },
    };
  }

  _addPoints(n, step) {
    const v = Math.max(0, Number(n) || 0);
    this.sessionPoints += v;
    const s = step ?? this.steps[this.stepIndex];
    if (s) {
      const f = inferOfnrFocus(s);
      if (f !== "mixed" && this._ofnrPoints[f] !== undefined) {
        this._ofnrPoints[f] += v;
      }
      const sk = this._sectionKey(s);
      this._sectionEarned[sk] = (this._sectionEarned[sk] || 0) + v;
    }
  }

  _setStepBodyTone(tone) {
    const el = this.container.querySelector(".step-body");
    if (!el) return;
    el.classList.remove("step-body--tone-giraffe", "step-body--tone-wolf", "step-body--tone-neutral");
    if (tone === "giraffe") el.classList.add("step-body--tone-giraffe");
    else if (tone === "wolf") el.classList.add("step-body--tone-wolf");
    else if (tone === "neutral") el.classList.add("step-body--tone-neutral");
  }

  _buildStarsSummary() {
    const slices = getModuleSectionSlices(this.module);
    const sections = slices.map((sl) => {
      const earned = this._sectionEarned[sl.id] || 0;
      const max = this._sectionMaxMap[sl.id] || 0;
      return {
        id: sl.id,
        title: sl.title,
        stars: starsFromScore(earned, max),
        earned,
        max,
      };
    });
    let totalE = 0;
    let totalM = 0;
    for (const s of sections) {
      if (s.max > 0) {
        totalE += s.earned;
        totalM += s.max;
      }
    }
    return {
      moduleStars: starsFromScore(totalE, totalM),
      sections,
    };
  }

  _renderStepHint() {
    /* Подсказки по типу шага перенесены в тур при первом запуске (app.js), чтобы не дублировать текст на экране. */
    return "";
  }

  start(fromStep = 0) {
    this.stepIndex = fromStep;
    this.sessionPoints = this.hooks.initialSessionPoints ?? 0;
    const io = this.hooks.initialOfnrPoints;
    this._ofnrPoints = {
      observation: 0,
      feeling: 0,
      need: 0,
      request: 0,
      ...(io && typeof io === "object" ? io : {}),
    };
    const ise = this.hooks.initialSectionEarned;
    this._sectionEarned =
      ise && typeof ise === "object" ? { ...ise } : {};
    this._theoryRevealChoice = null;
    this._lastSelectId = null;
    this._bodySwapExpanded = false;
    this._lastBodySwapRenderedIdx = -1;
    this._renderCurrent();
    if (this.hooks.onStepChange) this.hooks.onStepChange(this.stepIndex);
  }

  _advance() {
    if (this.stepIndex >= this.totalSteps - 1) {
      if (this.hooks.onComplete) {
        this.hooks.onComplete(this.module, {
          points: this.sessionPoints,
          stars: this._buildStarsSummary(),
        });
      }
      return;
    }

    const i = this.stepIndex;
    if (isLastStepInSection(this.module, i) && typeof this.hooks.onSectionComplete === "function") {
      const nextStep = i + 1;
      const steps = this.module.steps || [];
      const cur = steps[i];
      const sid = cur ? this._sectionKey(cur) : "__whole";
      const sectionEarned = this._sectionEarned[sid] || 0;
      const sectionMax = this._sectionMaxMap[sid] || 0;
      const sectionStars = starsFromScore(sectionEarned, sectionMax);
      this.hooks.onSectionComplete(this.module, {
        nextStepIndex: nextStep,
        sessionPoints: this.sessionPoints,
        ofnrPoints: { ...this._ofnrPoints },
        sectionId: sid,
        sectionStars,
        sectionEarned,
        sectionMax,
        sectionEarnedMap: { ...this._sectionEarned },
      });
      return;
    }

    this.stepIndex += 1;
    this.dialogNodeId = null;
    this.dialogTemp = 50;
    this._buildState = null;
    this._theoryRevealChoice = null;
    this._lastSelectId = null;
    this._bodySwapExpanded = false;
    this._lastBodySwapRenderedIdx = -1;
    if (this.hooks.onStepChange) this.hooks.onStepChange(this.stepIndex);
    this._renderCurrent();
  }

  _renderSectionLabel(step) {
    const prev = this.stepIndex > 0 ? this.steps[this.stepIndex - 1] : null;
    if (!step.section || (prev && prev.section === step.section)) return "";
    if (!step.sectionTitle) return "";
    return `<p class="lesson-section" role="status">${escapeHtml(step.sectionTitle)}</p>`;
  }

  _renderCurrent() {
    const step = this.steps[this.stepIndex];
    if (!step) {
      this.container.className = "lesson-root";
      this.container.innerHTML = "<p>Нет шагов.</p>";
      return;
    }
    withViewTransition(() => this._paintStep(step));
  }

  _paintStep(step) {
    const sectionLabel = this._renderSectionLabel(step);
    const progPct = this.totalSteps ? Math.round(((this.stepIndex + 1) / this.totalSteps) * 100) : 100;
    const header = `
      <div class="lesson-header">
        <div class="lesson-header__inner">
          <div class="lesson-header__titles">
            <span class="tag">Шаг ${this.stepIndex + 1} из ${this.totalSteps}</span>
            ${sectionLabel}
            <h2>${escapeHtml(step.title || "")}</h2>
          </div>
          <button type="button" class="lesson-header__close" aria-label="Закрыть урок" data-action="exit">×</button>
        </div>
        <div class="lesson-header__track" role="progressbar" aria-valuenow="${this.stepIndex + 1}" aria-valuemin="1" aria-valuemax="${this.totalSteps}" aria-label="Прогресс по шагам модуля">
          <div class="lesson-header__fill" style="width:${progPct}%"></div>
        </div>
      </div>
    `;

    const hint = this._renderStepHint();

    let body = "";
    switch (step.type) {
      case "theory":
        body = this._renderTheory(step);
        break;
      case "theory_reveal":
        body = this._renderTheoryReveal(step);
        break;
      case "select":
        body = this._renderSelect(step);
        break;
      case "sort":
        body = this._renderSort(step);
        break;
      case "camera":
        body = this._renderCamera(step);
        break;
      case "dialog":
        body = this._renderDialog(step);
        break;
      case "build":
        body = this._renderBuild(step);
        break;
      case "body_swap":
        body = this._renderBodySwap(step);
        break;
      case "reflection":
        body = this._renderReflection(step);
        break;
      default:
        body = `<p class="muted">Неизвестный тип шага: ${escapeHtml(step.type)}</p>`;
    }

    this.container.className = "lesson-root";
    this.container.innerHTML =
      header + hint + `<div class="step-body lesson-step-enter" data-step-type="${escapeHtml(step.type)}">${body}</div>`;
    this._bindGlobalActions();
    this._bindStepHandlers(step);
    const stepBody = this.container.querySelector(".step-body");
    if (stepBody) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        stepBody.classList.remove("lesson-step-enter");
      } else {
        const clearEnter = () => stepBody.classList.remove("lesson-step-enter");
        stepBody.addEventListener("animationend", clearEnter, { once: true });
      }
    }
    if (step.type === "build" && this._buildSnapKey) {
      const snapKey = this._buildSnapKey;
      this._buildSnapKey = null;
      requestAnimationFrame(() => {
        const el = this.container.querySelector(`.build-slot[data-slot-key="${snapKey}"]`);
        if (el) {
          el.classList.add("build-slot--snap");
          setTimeout(() => el.classList.remove("build-slot--snap"), 450);
        }
      });
    }
  }

  _bindGlobalActions() {
    const exitBtn = this.container.querySelector('[data-action="exit"]');
    if (exitBtn) {
      exitBtn.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("nvc-lesson-exit"));
      });
    }
  }

  _renderTheory(step) {
    return `
      <div class="mascot-row mascot-row--small" aria-hidden="true">
        <span class="mascot giraffe-mini" title="Жираф">🦒</span>
        <span class="mascot wolf-mini" title="Волк">🐺</span>
      </div>
      <div class="card">${formatTheoryBody(step.body || "")}</div>
      <button type="button" class="btn btn--primary" data-action="next">Далее</button>
    `;
  }

  _renderTheoryReveal(step) {
    if (!this._theoryRevealChoice) {
      const opts = (step.options || [])
        .map(
          (o, i) => `
        <button type="button" class="choice choice--appear" style="--choice-delay:${i * 0.055}s" data-reveal-id="${escapeHtml(o.id)}">${escapeHtml(o.text)}</button>
      `
        )
        .join("");
      return `
        <div class="card theory-situation">
          <strong>Ситуация</strong>
          <p style="margin:8px 0 0">${escapeHtml(step.situation || "")}</p>
        </div>
        <p class="muted">Что ближе к тому, как вы хотите начать?</p>
        <div class="choice-list">${opts}</div>
      `;
    }

    const opt = (step.options || []).find((o) => o.id === this._theoryRevealChoice);
    const fbCls =
      opt?.quality === "best" ? "feedback--ok" : opt?.quality === "poor" ? "feedback--hint" : "feedback--partial";
    return `
      <div class="card theory-situation">
        <strong>Ваш выбор</strong>
        <p style="margin:8px 0 0">${opt ? escapeHtml(opt.text) : ""}</p>
      </div>
      <div class="feedback ${fbCls}">${escapeHtml(opt?.feedback || "")}</div>
      ${step.afterReveal ? `<p class="muted">${escapeHtml(step.afterReveal)}</p>` : ""}
      <div class="card theory-reveal-panel">${formatTheoryBody(step.body || "")}</div>
      <button type="button" class="btn btn--primary" data-action="next">Далее</button>
    `;
  }

  _renderSelect(step) {
    const thermo = renderThermometer(this.dialogTemp);
    const opts = (step.options || [])
      .map(
        (o, i) => `
      <button type="button" class="choice choice--appear" style="--choice-delay:${i * 0.055}s" data-select-id="${escapeHtml(o.id)}" data-quality="${escapeHtml(o.quality || "")}">
        ${escapeHtml(o.text)}
      </button>
    `
      )
      .join("");

    return `
      ${thermo}
      <p class="muted">${escapeHtml(step.prompt || "")}</p>
      <div class="choice-list" role="group" aria-label="Варианты ответа">${opts}</div>
      <div class="feedback" id="select-feedback" hidden></div>
      <p class="muted soft-score-hint" id="select-score" hidden></p>
      <button type="button" class="btn btn--primary" id="select-next" disabled data-action="next">Далее</button>
    `;
  }

  _renderSort(step) {
    const items = (step.items || [])
      .map(
        (it) => `
      <div class="sort-item" data-sort-id="${escapeHtml(it.id)}">
        <div class="sort-item__text" draggable="true" data-drag-sort-id="${escapeHtml(it.id)}">${escapeHtml(it.text)}</div>
        <div class="sort-btns">
          <button type="button" class="btn btn--wolf sort-drop-target" data-ans="wolf">Волк</button>
          <button type="button" class="btn btn--giraffe sort-drop-target" data-ans="giraffe">Жираф</button>
        </div>
      </div>
    `
      )
      .join("");

    return `
      <p class="muted">${escapeHtml(step.instructions || "")}</p>
      ${items}
      <div class="feedback" id="sort-feedback" hidden></div>
      <p class="muted soft-score-hint" id="sort-score" hidden></p>
      <button type="button" class="btn btn--primary" id="sort-check" disabled>Проверить</button>
    `;
  }

  _renderCamera(step) {
    const opts = (step.options || [])
      .map(
        (o, i) => `
      <button type="button" class="choice choice--appear" style="--choice-delay:${i * 0.055}s" data-camera-id="${escapeHtml(o.id)}" data-correct="${o.correct ? "1" : "0"}">${escapeHtml(o.text)}</button>
    `
      )
      .join("");
    return `
      <p class="muted">${escapeHtml(step.prompt || "")}</p>
      <div class="choice-list">${opts}</div>
      <div class="feedback" id="cam-feedback" hidden></div>
      <p class="muted soft-score-hint" id="cam-score" hidden></p>
      <button type="button" class="btn btn--primary" id="cam-next" disabled>Далее</button>
    `;
  }

  /** Тексты собеседника для узла: `messages: []` или одно поле `text` */
  _dialogThemMessages(node) {
    if (!node) return [];
    if (Array.isArray(node.messages) && node.messages.length) {
      return node.messages.map((s) => String(s).trim()).filter(Boolean);
    }
    if (node.text && String(node.text).trim()) {
      return [String(node.text).trim()];
    }
    return [];
  }

  /** Добавить в историю реплики собеседника для текущего узла (один раз на узел) */
  _appendDialogThemForCurrentNode(step) {
    const id = this.dialogNodeId;
    if (!id || id === "end" || this._dialogAppendedNodeIds.has(id)) return;
    const node = (step.nodes || {})[id];
    if (!node || node.speaker !== "them") return;
    const msgs = this._dialogThemMessages(node);
    if (msgs.length === 0) {
      this._dialogAppendedNodeIds.add(id);
      return;
    }
    for (const t of msgs) {
      this._dialogHistory.push({ speaker: "them", text: t });
    }
    this._dialogAppendedNodeIds.add(id);
  }

  _renderDialog(step) {
    const start = step.start || "n1";
    if (!this.dialogNodeId) {
      this.dialogNodeId = start;
      this.dialogTemp = 50;
    }

    if (this._dialogHistoryStepIndex !== this.stepIndex) {
      this._dialogHistory = [];
      this._dialogAppendedNodeIds = new Set();
      this._dialogHistoryStepIndex = this.stepIndex;
      this._dialogPrevHistoryLen = 0;
    }

    this._appendDialogThemForCurrentNode(step);

    const node = (step.nodes || {})[this.dialogNodeId];
    if (!node) {
      return `<p>Ошибка диалога.</p><button type="button" class="btn btn--primary" data-action="dialog-finish">Далее</button>`;
    }

    const historyLen = this._dialogHistory.length;
    const newFrom = this._dialogPrevHistoryLen;
    this._dialogPrevHistoryLen = historyLen;

    const bubblesHtml = this._dialogHistory
      .map((m, i) => {
        const side = m.speaker === "you" ? "you" : "them";
        const enter = i >= newFrom ? " dialog-bubble--enter" : "";
        const delay = i >= newFrom ? ` style="--dialog-bubble-delay:${(i - newFrom) * 0.07}s"` : "";
        return `
        <div class="dialog-row dialog-row--${side}">
          <div class="dialog-bubble dialog-bubble--${side}${enter}"${delay}>${escapeHtml(m.text)}</div>
        </div>`;
      })
      .join("");

    const choices = (node.choices || [])
      .map(
        (c, i) => `
      <button type="button" class="choice choice--appear dialog-choice" style="--choice-delay:${i * 0.05}s" data-dialog-choice-idx="${i}" data-dialog-next="${escapeHtml(c.next)}" data-tone="${escapeHtml(c.tone || "neutral")}">
        ${escapeHtml(c.text)}
      </button>
    `
      )
      .join("");

    const continueBtn =
      !node.choices || node.choices.length === 0
        ? `<button type="button" class="btn btn--primary" data-action="dialog-finish">Далее</button>`
        : "";

    const thermo = renderThermometer(this.dialogTemp, { pulse: true });

    return `
      ${thermo}
      <div class="dialog-messenger" aria-label="Диалог в формате переписки">
        <div class="dialog-scroll" id="dialog-scroll">
          <div class="dialog-stack">${bubblesHtml}</div>
        </div>
      </div>
      ${choices ? `<div class="choice-list dialog-choices">${choices}</div>` : ""}
      ${continueBtn}
    `;
  }

  _buildPreviewText(step, st) {
    const slots = step.slots || [];
    const parts = [];
    slots.forEach((s) => {
      const id = st.assignments[s.key];
      if (id) {
        const t = this._findBankText(step, id);
        parts.push(t);
      }
    });
    if (parts.length === 0) return "… соберите фразу по слотам …";
    return parts.join(" ");
  }

  _renderBuild(step) {
    const slots = step.slots || [];
    if (!this._buildState) {
      this._buildState = {
        assignments: {},
        picked: null,
        bankOrder: null,
      };
    }
    const st = this._buildState;
    const bankRaw = step.bank || [];
    if (!st.bankOrder || st.bankOrder.length !== bankRaw.length) {
      st.bankOrder = shuffleBuildBankIds(bankRaw.map((b) => b.id));
    }
    const bankById = new Map(bankRaw.map((b) => [b.id, b]));
    const bankOrdered = st.bankOrder.map((id) => bankById.get(id)).filter(Boolean);

    const slotHtml = slots
      .map((s) => {
        const val = st.assignments[s.key];
        const label = val ? escapeHtml(this._findBankText(step, val)) : "— выберите фразу —";
        return `
        <div class="build-slot build-slot--droppable ${val ? "is-filled" : ""}" data-slot-key="${escapeHtml(s.key)}" role="button" tabindex="0">
          <div class="build-slot-label">${escapeHtml(s.label)}</div>
          <div>${val ? label : '<span class="muted">пусто</span>'}</div>
        </div>`;
      })
      .join("");

    const bank = bankOrdered
      .map((b) => {
        const used = Object.values(st.assignments).includes(b.id);
        const drag = !used;
        return `
        <button type="button" class="chip ${used ? "is-used" : ""} ${st.picked === b.id ? "is-picked" : ""}" data-chip-id="${escapeHtml(b.id)}" draggable="${drag ? "true" : "false"}" ${used ? "disabled" : ""}>
          ${escapeHtml(b.text)}
        </button>`;
      })
      .join("");

    const preview = this._buildPreviewText(step, st);

    return `
      <div class="build-lab">
        <div class="build-lab__mascot" aria-hidden="true">🦒</div>
        <div class="build-lab__bubble">${escapeHtml(preview)}</div>
      </div>
      <p class="muted">${escapeHtml(step.instructions || "")}</p>
      <div class="build-slots">${slotHtml}</div>
      <div class="chip-bank">${bank}</div>
      <div class="feedback" id="build-feedback" hidden></div>
      <div class="btn-row">
        <button type="button" class="btn btn--secondary" id="build-reset">Сбросить</button>
        <button type="button" class="btn btn--primary" id="build-check">Проверить</button>
      </div>
      <button type="button" class="btn btn--ghost" id="build-open-ref" style="margin-top:10px">Справочник чувств и потребностей</button>
      <div class="build-ref-modal" id="build-ref-modal" hidden>
        <div class="build-ref-modal__backdrop" data-build-ref-close tabindex="-1"></div>
        <div class="build-ref-modal__panel card" role="dialog" aria-modal="true" aria-labelledby="build-ref-title">
          <div class="build-ref-modal__head">
            <h3 id="build-ref-title" style="margin:0;font-size:1rem">Шпаргалка</h3>
            <button type="button" class="lesson-header__close" data-build-ref-close aria-label="Закрыть">×</button>
          </div>
          <div class="build-ref-modal__body" id="build-ref-body"></div>
        </div>
      </div>
      <button type="button" class="btn btn--primary" id="build-next" style="margin-top:10px;display:none">Далее</button>
    `;
  }

  _findBankText(step, id) {
    const b = (step.bank || []).find((x) => x.id === id);
    return b ? b.text : id;
  }

  _checkBuildCoherence(step, st) {
    const pairs = step.coherencePairs || [];
    for (const p of pairs) {
      if (st.assignments[p.feeling] === p.feelingId && st.assignments[p.need] === p.needId) {
        return p.hint;
      }
    }
    return null;
  }

  _renderBodySwap(step) {
    if (this._lastBodySwapRenderedIdx !== this.stepIndex) {
      this._lastBodySwapRenderedIdx = this.stepIndex;
      this.bodySwapContact = typeof step.contactStart === "number" ? step.contactStart : 50;
    }
    const name = step.characterName || "собеседника";
    const phrases = (step.yourPhrases || []).map((p) => `<li>${escapeHtml(p)}</li>`).join("");
    const showMeter = step.showContactMeter !== false;
    const thermoDeep = showMeter ? renderThermometer(this.bodySwapContact) : "";
    const highlights = (step.highlights || [])
      .map((h) => {
        const thought = h.innerThought
          ? `<div class="body-swap-thought" role="text">${escapeHtml(h.innerThought)}</div>`
          : "";
        const delta =
          typeof h.contactDelta === "number"
            ? ` data-contact-delta="${h.contactDelta}"`
            : "";
        const interactive = typeof h.contactDelta === "number" ? " body-swap-mark--interactive" : "";
        return `
      <div class="body-swap-mark${interactive}"${delta}>
        <span class="body-swap-fragment">«${escapeHtml(h.fragment)}»</span>
        <span class="body-swap-note">${escapeHtml(h.note)}</span>
        ${thought}
      </div>
    `;
      })
      .join("");

    const annotated = `
      <div class="body-swap body-swap--annotated" id="body-swap-deep" ${this._bodySwapExpanded ? "" : "hidden"}>
        <h3 style="margin-top:0">Глазами ${escapeHtml(name)}</h3>
        ${thermoDeep ? `<p class="muted" style="margin:0 0 6px;font-size:0.85rem">Термометр контакта: коснитесь строки с фрагментом — как слова бьют по «температуре».</p>${thermoDeep}` : ""}
        ${highlights || `<p class="muted">Замечания к формулировкам.</p>`}
        <p><strong>${escapeHtml(name)}:</strong> ${escapeHtml(step.theirPerspective || "")}</p>
      </div>
    `;

    return `
      <div class="mascot-row mascot-row--small" aria-hidden="true">
        <span class="mascot giraffe-mini">🦒</span>
        <span class="mascot wolf-mini">🐺</span>
      </div>
      <div class="body-swap" id="body-swap-intro">
        <h3>Смена тела</h3>
        <p class="muted">Ваши формулировки и то, как их может услышать другой:</p>
        <ul>${phrases}</ul>
      </div>
      <button type="button" class="btn btn--secondary" id="body-swap-toggle">
        Посмотреть глазами ${escapeHtml(name)}
      </button>
      ${annotated}
      <button type="button" class="btn btn--primary" data-action="next" style="margin-top:14px">Далее</button>
    `;
  }

  _renderReflection(step) {
    return `
      <p>${escapeHtml(step.prompt || "")}</p>
      <label class="sr-only" for="refl-area">${escapeHtml(step.title || "Рефлексия")}</label>
      <textarea id="refl-area" rows="3" class="refl-textarea" placeholder="${escapeHtml(step.placeholder || "")}"></textarea>
      <button type="button" class="btn btn--primary" style="margin-top:12px" data-action="next">Далее</button>
    `;
  }

  _applyTone(tone) {
    const st = this.steps[this.stepIndex];
    if (tone === "wolf") {
      this.dialogTemp = Math.max(0, this.dialogTemp - 20);
      flashTone("wolf");
      vibrateTone("wolf");
      this._addPoints(0, st);
    } else if (tone === "giraffe") {
      this.dialogTemp = Math.min(100, this.dialogTemp + 18);
      flashTone("giraffe");
      vibrateTone("giraffe");
      this._addPoints(2, st);
    } else {
      this.dialogTemp = Math.min(100, this.dialogTemp + 5);
      this._addPoints(1, st);
    }
  }

  _qualityPoints(q) {
    if (q === "best") return 2;
    if (q === "ok") return 1;
    return 0;
  }

  _bindStepHandlers(step) {
    if (step.type === "theory") {
      const btn = this.container.querySelector('[data-action="next"]');
      if (btn) btn.addEventListener("click", () => this._advance());
    }

    if (step.type === "theory_reveal") {
      if (!this._theoryRevealChoice) {
        this.container.querySelectorAll("[data-reveal-id]").forEach((btn) => {
          btn.addEventListener("click", () => {
            this._theoryRevealChoice = btn.getAttribute("data-reveal-id");
            const opt = (step.options || []).find((o) => o.id === this._theoryRevealChoice);
            if (opt) {
              this._addPoints(this._qualityPoints(opt.quality), step);
            }
            this._renderCurrent();
            requestAnimationFrame(() => {
              const tone =
                opt?.quality === "best" ? "giraffe" : opt?.quality === "poor" ? "wolf" : "neutral";
              this._setStepBodyTone(tone);
            });
          });
        });
      } else {
        const btn = this.container.querySelector('[data-action="next"]');
        if (btn) btn.addEventListener("click", () => this._advance());
      }
    }

    if (step.type === "select") {
      const fb = this.container.querySelector("#select-feedback");
      const nextBtn = this.container.querySelector("#select-next");
      const scoreEl = this.container.querySelector("#select-score");
      this.container.querySelectorAll(".choice[data-select-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.container.querySelectorAll(".choice[data-select-id]").forEach((b) => b.classList.remove("is-selected"));
          btn.classList.add("is-selected");
          const id = btn.getAttribute("data-select-id");
          this._lastSelectId = id;
          const opt = (step.options || []).find((o) => o.id === id);
          const q = opt?.quality || "";
          if (q === "best") {
            this.dialogTemp = Math.min(100, this.dialogTemp + 15);
            flashTone("giraffe");
            vibrateTone("giraffe");
          } else if (q === "poor") {
            this.dialogTemp = Math.max(0, this.dialogTemp - 12);
            flashTone("wolf");
            vibrateTone("wolf");
          }
          if (fb && opt) {
            fb.hidden = false;
            let cls = "feedback--partial";
            if (opt.quality === "best") cls = "feedback--ok";
            if (opt.quality === "poor") cls = "feedback--hint";
            fb.className = `feedback ${cls}`;
            fb.textContent = opt.feedback || "";
          }
          if (scoreEl) {
            const pts = this._qualityPoints(q);
            scoreEl.hidden = false;
            scoreEl.textContent = formatPointsLine(pts);
          }
          const tone = q === "best" ? "giraffe" : q === "poor" ? "wolf" : "neutral";
          this._setStepBodyTone(tone);
          if (nextBtn) nextBtn.disabled = false;
        });
      });
      if (nextBtn) {
        nextBtn.addEventListener("click", () => {
          const chosen = (step.options || []).find((o) => o.id === this._lastSelectId);
          if (chosen) this._addPoints(this._qualityPoints(chosen.quality), step);
          this._advance();
        });
      }
    }

    if (step.type === "sort") {
      const answers = {};
      const feedback = this.container.querySelector("#sort-feedback");
      const scoreEl = this.container.querySelector("#sort-score");
      const checkBtn = this.container.querySelector("#sort-check");
      const sortDataType = "text/plain";
      this.container.querySelectorAll(".sort-item").forEach((row) => {
        const id = row.getAttribute("data-sort-id");
        const applyRow = (ans) => {
          row.querySelectorAll("[data-ans]").forEach((x) => x.classList.remove("is-on"));
          const btn = row.querySelector(`[data-ans="${ans}"]`);
          if (btn) btn.classList.add("is-on");
          answers[id] = ans;
          const total = (step.items || []).length;
          if (checkBtn) checkBtn.disabled = Object.keys(answers).length < total;
        };
        row.querySelectorAll("[data-ans]").forEach((b) => {
          b.addEventListener("click", () => applyRow(b.getAttribute("data-ans")));
        });
        const dragEl = row.querySelector(".sort-item__text[draggable]");
        if (dragEl) {
          dragEl.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData(sortDataType, id);
            e.dataTransfer.effectAllowed = "move";
            row.classList.add("sort-item--dragging");
          });
          dragEl.addEventListener("dragend", () => row.classList.remove("sort-item--dragging"));
        }
        row.querySelectorAll(".sort-drop-target[data-ans]").forEach((b) => {
          b.addEventListener("dragenter", (e) => {
            e.preventDefault();
            b.classList.add("sort-drop-target--over");
          });
          b.addEventListener("dragleave", () => b.classList.remove("sort-drop-target--over"));
          b.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          });
          b.addEventListener("drop", (e) => {
            e.preventDefault();
            b.classList.remove("sort-drop-target--over");
            const droppedId = e.dataTransfer.getData(sortDataType);
            if (droppedId !== id) return;
            applyRow(b.getAttribute("data-ans"));
          });
        });
      });
      if (checkBtn) {
        checkBtn.addEventListener("click", () => {
          let ok = 0;
          (step.items || []).forEach((it) => {
            if (answers[it.id] === it.answer) ok += 1;
          });
          const all = (step.items || []).length;
          const pts = ok === all ? 2 : ok > 0 ? 1 : 0;
          this._addPoints(pts, step);
          if (scoreEl) {
            scoreEl.hidden = false;
            scoreEl.textContent = formatPointsLine(pts, "sort");
          }
          const tone = pts === 2 ? "giraffe" : pts === 1 ? "neutral" : "wolf";
          this._setStepBodyTone(tone);
          if (feedback) {
            feedback.hidden = false;
            if (ok === all) {
              feedback.className = "feedback feedback--ok";
              feedback.textContent = "Отлично: вы различаете тон Волка и Жирафа.";
            } else {
              feedback.className = "feedback feedback--partial";
              feedback.textContent = `Верно ${ok} из ${all}. Перечитайте «опасные» слова и просьбы.`;
            }
          }
          checkBtn.style.display = "none";
          const next = document.createElement("button");
          next.type = "button";
          next.className = "btn btn--primary";
          next.textContent = "Далее";
          next.style.marginTop = "12px";
          next.addEventListener("click", () => this._advance());
          checkBtn.parentElement.appendChild(next);
        });
      }
    }

    if (step.type === "camera") {
      const fb = this.container.querySelector("#cam-feedback");
      const nextBtn = this.container.querySelector("#cam-next");
      const scoreEl = this.container.querySelector("#cam-score");
      this.container.querySelectorAll(".choice[data-camera-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.container.querySelectorAll(".choice[data-camera-id]").forEach((b) => {
            b.classList.add("is-disabled");
          });
          const id = btn.getAttribute("data-camera-id");
          const opt = (step.options || []).find((o) => o.id === id);
          const correct = btn.getAttribute("data-correct") === "1";
          if (correct) {
            this._addPoints(2, step);
            flashTone("giraffe");
            vibrateTone("giraffe");
          } else {
            this._addPoints(0, step);
            flashTone("wolf");
            vibrateTone("wolf");
          }
          this._setStepBodyTone(correct ? "giraffe" : "wolf");
          if (fb && opt) {
            fb.hidden = false;
            fb.className = opt.correct ? "feedback feedback--ok" : "feedback feedback--partial";
            fb.textContent = opt.explain || "";
          }
          if (scoreEl) {
            scoreEl.hidden = false;
            scoreEl.textContent = formatPointsLine(correct ? 2 : 0, "camera");
          }
          if (nextBtn) nextBtn.disabled = false;
        });
      });
      if (nextBtn) nextBtn.addEventListener("click", () => this._advance());
    }

    if (step.type === "dialog") {
      this.container.querySelectorAll("[data-dialog-next]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const tone = btn.getAttribute("data-tone") || "neutral";
          const idx = parseInt(btn.getAttribute("data-dialog-choice-idx") || "-1", 10);
          const curId = this.dialogNodeId;
          const curNode = curId ? (step.nodes || {})[curId] : null;
          const choices = curNode?.choices || [];
          const picked = idx >= 0 && choices[idx] ? choices[idx] : null;
          if (picked?.text) {
            this._dialogHistory.push({ speaker: "you", text: picked.text });
          }
          this._applyTone(tone);
          const nextId = btn.getAttribute("data-dialog-next");
          this.dialogNodeId = nextId;
          this._renderCurrent();
        });
      });
      const finish = this.container.querySelector('[data-action="dialog-finish"]');
      if (finish) finish.addEventListener("click", () => this._advance());
      const scrollDialog = () => {
        const sc = this.container.querySelector("#dialog-scroll");
        if (sc) sc.scrollTop = sc.scrollHeight;
      };
      requestAnimationFrame(scrollDialog);
      setTimeout(scrollDialog, 120);
    }

    if (step.type === "build") {
      const stepRef = step;
      const st = this._buildState;
      const chipDataType = "text/plain";
      const pickChip = (id) => {
        st.picked = st.picked === id ? null : id;
        this._renderCurrent();
      };
      const assignSlotFromPick = (key) => {
        if (!st.picked) return;
        const bankItem = (stepRef.bank || []).find((b) => b.id === st.picked);
        if (!bankItem || bankItem.slot !== key) {
          const fb = this.container.querySelector("#build-feedback");
          if (fb) {
            fb.hidden = false;
            fb.className = "feedback feedback--hint";
            fb.textContent = "Эта фраза относится к другому слоту.";
          }
          return;
        }
        Object.keys(st.assignments).forEach((k) => {
          if (st.assignments[k] === st.picked) delete st.assignments[k];
        });
        st.assignments[key] = st.picked;
        st.picked = null;
        this._buildSnapKey = key;
        this._renderCurrent();
      };
      this.container.querySelectorAll(".chip[data-chip-id]").forEach((chip) => {
        chip.addEventListener("click", () => {
          if (chip.disabled) return;
          pickChip(chip.getAttribute("data-chip-id"));
        });
        chip.addEventListener("dragstart", (e) => {
          if (chip.disabled) return;
          e.dataTransfer.setData(chipDataType, chip.getAttribute("data-chip-id"));
          e.dataTransfer.effectAllowed = "move";
          chip.classList.add("chip--dragging");
        });
        chip.addEventListener("dragend", () => chip.classList.remove("chip--dragging"));
      });
      this.container.querySelectorAll(".build-slot[data-slot-key]").forEach((slotEl) => {
        const key = slotEl.getAttribute("data-slot-key");
        slotEl.addEventListener("click", () => assignSlotFromPick(key));
        slotEl.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          slotEl.classList.add("build-slot--drag-over");
        });
        slotEl.addEventListener("dragleave", () => slotEl.classList.remove("build-slot--drag-over"));
        slotEl.addEventListener("drop", (e) => {
          e.preventDefault();
          slotEl.classList.remove("build-slot--drag-over");
          const chipId = e.dataTransfer.getData(chipDataType);
          if (!chipId) return;
          st.picked = chipId;
          assignSlotFromPick(key);
        });
      });
      const reset = this.container.querySelector("#build-reset");
      if (reset) {
        reset.addEventListener("click", () => {
          const ord = this._buildState?.bankOrder;
          this._buildState = { assignments: {}, picked: null, bankOrder: ord };
          this._buildSnapKey = null;
          this._renderCurrent();
        });
      }
      const check = this.container.querySelector("#build-check");
      const nextB = this.container.querySelector("#build-next");
      const refBtn = this.container.querySelector("#build-open-ref");
      const modal = this.container.querySelector("#build-ref-modal");
      const closeRefModal = () => {
        if (modal) modal.hidden = true;
      };
      refBtn?.addEventListener("click", async () => {
        const body = this.container.querySelector("#build-ref-body");
        if (body && !body.dataset.loaded) {
          const data = await fetchReferenceCompact();
          body.innerHTML = renderFeelingsNeedsHtml(data);
          body.dataset.loaded = "1";
        }
        if (modal) modal.hidden = false;
      });
      this.container.querySelectorAll("[data-build-ref-close]").forEach((el) => {
        el.addEventListener("click", closeRefModal);
      });
      if (check) {
        check.addEventListener("click", () => {
          const corr = step.correct || {};
          let good = true;
          Object.keys(corr).forEach((k) => {
            if (st.assignments[k] !== corr[k]) good = false;
          });
          const slots = step.slots || [];
          if (Object.keys(st.assignments).length < slots.length) good = false;
          const coherenceHint = this._checkBuildCoherence(step, st);
          const fb = this.container.querySelector("#build-feedback");
          if (fb) {
            fb.hidden = false;
            if (good) {
              fb.className = "feedback feedback--ok";
              fb.textContent = "Собрано верно: факт, чувство, потребность и просьба согласованы.";
              this._addPoints(2, step);
              this._setStepBodyTone("giraffe");
            } else {
              fb.className = "feedback feedback--partial";
              fb.textContent =
                coherenceHint ||
                "Почти. Проверьте: наблюдение без ярлыков, чувство — ваше, потребность — ценность, просьба — с выбором.";
              const pts = coherenceHint ? 1 : 0;
              this._addPoints(pts, step);
              this._setStepBodyTone(pts ? "neutral" : "wolf");
            }
          }
          check.style.display = "none";
          if (nextB) {
            nextB.style.display = "block";
            nextB.onclick = () => this._advance();
          }
        });
      }
    }

    if (step.type === "body_swap") {
      const toggle = this.container.querySelector("#body-swap-toggle");
      const deep = this.container.querySelector("#body-swap-deep");
      const updateThermo = () => {
        const fill = this.container.querySelector("#body-swap-deep .thermo__fill");
        const meta = this.container.querySelector("#body-swap-deep .thermo__meta");
        if (fill) fill.style.width = `${Math.max(0, Math.min(100, this.bodySwapContact))}%`;
        if (meta) {
          const t = Math.max(0, Math.min(100, this.bodySwapContact));
          const label =
            t >= 70 ? "Тепло, контакт возможен" : t >= 40 ? "Нейтрально" : "Собеседник может закрыться";
          meta.textContent = `${label} · ${t}%`;
        }
      };
      if (toggle && deep) {
        toggle.addEventListener("click", () => {
          this._bodySwapExpanded = true;
          deep.hidden = false;
          toggle.style.display = "none";
          updateThermo();
        });
      }
      this.container.querySelectorAll(".body-swap-mark--interactive[data-contact-delta]").forEach((row) => {
        row.addEventListener("click", () => {
          const d = parseInt(row.getAttribute("data-contact-delta"), 10);
          if (!Number.isNaN(d)) {
            this.bodySwapContact = Math.max(0, Math.min(100, this.bodySwapContact + d));
            updateThermo();
            row.classList.add("is-touched");
          }
        });
      });
      const btn = this.container.querySelector('[data-action="next"]');
      if (btn) btn.addEventListener("click", () => this._advance());
    }

    if (step.type === "reflection") {
      const btn = this.container.querySelector('[data-action="next"]');
      if (btn) btn.addEventListener("click", () => this._advance());
    }
  }
}
