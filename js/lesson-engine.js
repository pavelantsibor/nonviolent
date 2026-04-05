/**
 * Движок урока: рендер шагов, эмоциональная обратная связь, мягкие баллы
 */

import { flashTone, vibrateTone } from "./lesson-feedback.js";

function escapeHtml(str) {
  if (str == null) return "";
  const d = document.createElement("div");
  d.textContent = String(str);
  return d.innerHTML;
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

const TYPE_HINTS = {
  theory: "📖 Короткий текст — можно вернуться к нему в любой момент.",
  theory_reveal: "🎯 Сначала интуиция, потом — теория.",
  select: "🦒 Выберите вариант, который ближе к «языку Жирафа»: факты, чувства, просьбы.",
  sort: "🐺🦒 Разделите фразы: где давление и ярлыки, а где забота и ясность.",
  camera: "📷 Вы — объективная камера: только наблюдаемое, без оценок.",
  dialog: "🌡️ Следите за «температурой» контакта: Волк охлаждает, Жираф согревает.",
  build: "🧪 Лаборатория смыслов: соберите цельную фразу из четырёх частей.",
  body_swap: "🪞 Нажмите кнопку — посмотрите на слова глазами другого.",
  reflection: "✍️ Пара слов для себя — без оценки «хорошо/плохо».",
};

function renderThermometer(temp) {
  const t = Math.max(0, Math.min(100, temp));
  const label =
    t >= 70 ? "Тепло, контакт возможен" : t >= 40 ? "Нейтрально" : "Собеседник может закрыться";
  return `
    <div class="thermo" role="img" aria-label="Температура контакта: ${t} из 100">
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
    this.sessionPoints = 0;
  }

  get steps() {
    return this.module.steps || [];
  }

  get totalSteps() {
    return this.steps.length;
  }

  _addPoints(n) {
    const v = Math.max(0, Number(n) || 0);
    this.sessionPoints += v;
  }

  _renderStepHint(step) {
    if (step.skipHint) return "";
    const text = step.hint || TYPE_HINTS[step.type] || "";
    if (!text) return "";
    return `<div class="step-hint" role="note">${escapeHtml(text)}</div>`;
  }

  start(fromStep = 0) {
    this.stepIndex = fromStep;
    this.sessionPoints = 0;
    this._theoryRevealChoice = null;
    this._lastSelectId = null;
    this._bodySwapExpanded = false;
    this._renderCurrent();
    if (this.hooks.onStepChange) this.hooks.onStepChange(this.stepIndex);
  }

  _advance() {
    if (this.stepIndex >= this.totalSteps - 1) {
      if (this.hooks.onComplete) {
        this.hooks.onComplete(this.module, { points: this.sessionPoints });
      }
      return;
    }
    this.stepIndex += 1;
    this.dialogNodeId = null;
    this.dialogTemp = 50;
    this._buildState = null;
    this._theoryRevealChoice = null;
    this._lastSelectId = null;
    this._bodySwapExpanded = false;
    if (this.hooks.onStepChange) this.hooks.onStepChange(this.stepIndex);
    this._renderCurrent();
  }

  _renderCurrent() {
    const step = this.steps[this.stepIndex];
    if (!step) {
      this.container.innerHTML = "<p>Нет шагов.</p>";
      return;
    }
    const header = `
      <div class="lesson-header">
        <div>
          <span class="tag">Шаг ${this.stepIndex + 1} из ${this.totalSteps}</span>
          <h2>${escapeHtml(step.title || "")}</h2>
        </div>
        <button type="button" class="lesson-header__close" aria-label="Закрыть урок" data-action="exit">×</button>
      </div>
    `;

    const hint = this._renderStepHint(step);

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

    this.container.innerHTML =
      header + hint + `<div class="step-body" data-step-type="${escapeHtml(step.type)}">${body}</div>`;
    this._bindGlobalActions();
    this._bindStepHandlers(step);
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
          (o) => `
        <button type="button" class="choice" data-reveal-id="${escapeHtml(o.id)}">${escapeHtml(o.text)}</button>
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
      <div class="card">${formatTheoryBody(step.body || "")}</div>
      <button type="button" class="btn btn--primary" data-action="next">Далее</button>
    `;
  }

  _renderSelect(step) {
    const thermo = renderThermometer(this.dialogTemp);
    const opts = (step.options || [])
      .map(
        (o) => `
      <button type="button" class="choice" data-select-id="${escapeHtml(o.id)}" data-quality="${escapeHtml(o.quality || "")}">
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
        <div class="sort-item__text">${escapeHtml(it.text)}</div>
        <div class="sort-btns">
          <button type="button" class="btn btn--wolf" data-ans="wolf">Волк</button>
          <button type="button" class="btn btn--giraffe" data-ans="giraffe">Жираф</button>
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
        (o) => `
      <button type="button" class="choice" data-camera-id="${escapeHtml(o.id)}" data-correct="${o.correct ? "1" : "0"}">${escapeHtml(o.text)}</button>
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

  _renderDialog(step) {
    const start = step.start || "n1";
    if (!this.dialogNodeId) {
      this.dialogNodeId = start;
      this.dialogTemp = 50;
    }
    const node = (step.nodes || {})[this.dialogNodeId];
    if (!node) {
      return `<p>Ошибка диалога.</p><button type="button" class="btn btn--primary" data-action="dialog-finish">Далее</button>`;
    }
    const bubbleClass = node.speaker === "you" ? "dialog-bubble--you" : "dialog-bubble--them";
    const choices = (node.choices || [])
      .map(
        (c) => `
      <button type="button" class="choice" data-dialog-next="${escapeHtml(c.next)}" data-tone="${escapeHtml(c.tone || "neutral")}">
        ${escapeHtml(c.text)}
      </button>
    `
      )
      .join("");

    const text =
      node.text && node.text.trim()
        ? escapeHtml(node.text)
        : "<em class=\"muted\">Диалог завершён.</em>";

    const continueBtn =
      !node.choices || node.choices.length === 0
        ? `<button type="button" class="btn btn--primary" data-action="dialog-finish">Далее</button>`
        : "";

    const thermo = renderThermometer(this.dialogTemp);

    return `
      ${thermo}
      <div class="dialog-stack">
        <div class="dialog-bubble ${bubbleClass}">${text}</div>
      </div>
      ${choices ? `<div class="choice-list">${choices}</div>` : ""}
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
      };
    }
    const st = this._buildState;
    const slotHtml = slots
      .map((s) => {
        const val = st.assignments[s.key];
        const label = val ? escapeHtml(this._findBankText(step, val)) : "— тап по фразе, затем по слоту —";
        return `
        <div class="build-slot ${val ? "is-filled" : ""}" data-slot-key="${escapeHtml(s.key)}" role="button" tabindex="0">
          <div class="build-slot-label">${escapeHtml(s.label)}</div>
          <div>${val ? label : '<span class="muted">пусто</span>'}</div>
        </div>`;
      })
      .join("");

    const bank = (step.bank || [])
      .map((b) => {
        const used = Object.values(st.assignments).includes(b.id);
        return `
        <button type="button" class="chip ${used ? "is-used" : ""} ${st.picked === b.id ? "is-picked" : ""}" data-chip-id="${escapeHtml(b.id)}" ${used ? "disabled" : ""}>
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
      <p class="muted" style="font-size:0.85rem">Совет: сначала нажмите фразу, затем подходящий слот.</p>
      <div class="chip-bank">${bank}</div>
      <div class="feedback" id="build-feedback" hidden></div>
      <div class="btn-row">
        <button type="button" class="btn btn--secondary" id="build-reset">Сбросить</button>
        <button type="button" class="btn btn--primary" id="build-check">Проверить</button>
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
    const name = step.characterName || "собеседника";
    const phrases = (step.yourPhrases || []).map((p) => `<li>${escapeHtml(p)}</li>`).join("");
    const highlights = (step.highlights || [])
      .map(
        (h) => `
      <div class="body-swap-mark">
        <span class="body-swap-fragment">«${escapeHtml(h.fragment)}»</span>
        <span class="body-swap-note">${escapeHtml(h.note)}</span>
      </div>
    `
      )
      .join("");

    const annotated = `
      <div class="body-swap body-swap--annotated" id="body-swap-deep" ${this._bodySwapExpanded ? "" : "hidden"}>
        <h3 style="margin-top:0">Глазами ${escapeHtml(name)}</h3>
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
    if (tone === "wolf") {
      this.dialogTemp = Math.max(0, this.dialogTemp - 20);
      flashTone("wolf");
      vibrateTone("wolf");
      this._addPoints(0);
    } else if (tone === "giraffe") {
      this.dialogTemp = Math.min(100, this.dialogTemp + 18);
      flashTone("giraffe");
      vibrateTone("giraffe");
      this._addPoints(2);
    } else {
      this.dialogTemp = Math.min(100, this.dialogTemp + 5);
      this._addPoints(1);
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
              this._addPoints(this._qualityPoints(opt.quality));
            }
            this._renderCurrent();
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
            scoreEl.textContent =
              pts === 2
                ? "Баллы за шаг: 2 — чистый Жираф 🦒"
                : pts === 1
                  ? "Баллы за шаг: 1 — старающийся Жираф"
                  : "Баллы за шаг: 0 — сработал Волк; это не провал, а сигнал.";
          }
          if (nextBtn) nextBtn.disabled = false;
        });
      });
      if (nextBtn) {
        nextBtn.addEventListener("click", () => {
          const chosen = (step.options || []).find((o) => o.id === this._lastSelectId);
          if (chosen) this._addPoints(this._qualityPoints(chosen.quality));
          this._advance();
        });
      }
    }

    if (step.type === "sort") {
      const answers = {};
      const feedback = this.container.querySelector("#sort-feedback");
      const scoreEl = this.container.querySelector("#sort-score");
      const checkBtn = this.container.querySelector("#sort-check");
      this.container.querySelectorAll(".sort-item").forEach((row) => {
        const id = row.getAttribute("data-sort-id");
        row.querySelectorAll("[data-ans]").forEach((b) => {
          b.addEventListener("click", () => {
            row.querySelectorAll("[data-ans]").forEach((x) => x.classList.remove("is-on"));
            b.classList.add("is-on");
            answers[id] = b.getAttribute("data-ans");
            const total = (step.items || []).length;
            if (checkBtn) checkBtn.disabled = Object.keys(answers).length < total;
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
          this._addPoints(pts);
          if (scoreEl) {
            scoreEl.hidden = false;
            scoreEl.textContent =
              pts === 2 ? "Баллы за шаг: 2" : pts === 1 ? "Баллы за шаг: 1 — почти всё верно" : "Баллы за шаг: 0 — можно повторить позже";
          }
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
            this._addPoints(2);
            flashTone("giraffe");
            vibrateTone("giraffe");
          } else {
            this._addPoints(0);
            flashTone("wolf");
            vibrateTone("wolf");
          }
          if (fb && opt) {
            fb.hidden = false;
            fb.className = opt.correct ? "feedback feedback--ok" : "feedback feedback--partial";
            fb.textContent = opt.explain || "";
          }
          if (scoreEl) {
            scoreEl.hidden = false;
            scoreEl.textContent = correct ? "Баллы за шаг: 2" : "Баллы за шаг: 0 — камера не оценивает, она фиксирует.";
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
          this._applyTone(tone);
          const nextId = btn.getAttribute("data-dialog-next");
          this.dialogNodeId = nextId;
          this._renderCurrent();
        });
      });
      const finish = this.container.querySelector('[data-action="dialog-finish"]');
      if (finish) finish.addEventListener("click", () => this._advance());
    }

    if (step.type === "build") {
      const stepRef = step;
      const st = this._buildState;
      const pickChip = (id) => {
        st.picked = st.picked === id ? null : id;
        this._renderCurrent();
      };
      this.container.querySelectorAll(".chip[data-chip-id]").forEach((chip) => {
        chip.addEventListener("click", () => {
          if (chip.disabled) return;
          pickChip(chip.getAttribute("data-chip-id"));
        });
      });
      this.container.querySelectorAll(".build-slot[data-slot-key]").forEach((slotEl) => {
        slotEl.addEventListener("click", () => {
          const key = slotEl.getAttribute("data-slot-key");
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
          this._renderCurrent();
        });
      });
      const reset = this.container.querySelector("#build-reset");
      if (reset) {
        reset.addEventListener("click", () => {
          this._buildState = { assignments: {}, picked: null };
          this._renderCurrent();
        });
      }
      const check = this.container.querySelector("#build-check");
      const nextB = this.container.querySelector("#build-next");
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
              this._addPoints(2);
            } else {
              fb.className = "feedback feedback--partial";
              fb.textContent =
                coherenceHint ||
                "Почти. Проверьте: наблюдение без ярлыков, чувство — ваше, потребность — ценность, просьба — с выбором.";
              this._addPoints(coherenceHint ? 1 : 0);
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
      if (toggle && deep) {
        toggle.addEventListener("click", () => {
          this._bodySwapExpanded = true;
          deep.hidden = false;
          toggle.style.display = "none";
        });
      }
      const btn = this.container.querySelector('[data-action="next"]');
      if (btn) btn.addEventListener("click", () => this._advance());
    }

    if (step.type === "reflection") {
      const btn = this.container.querySelector('[data-action="next"]');
      if (btn) btn.addEventListener("click", () => this._advance());
    }
  }
}
