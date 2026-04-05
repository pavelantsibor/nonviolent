/**
 * Движок урока: рендер шагов и переходы
 */

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

export class LessonEngine {
  /**
   * @param {object} moduleData
   * @param {HTMLElement} container
   * @param {{ onStepChange?: (i:number)=>void, onComplete?: (moduleData:object)=>void }} hooks
   */
  constructor(moduleData, container, hooks = {}) {
    this.module = moduleData;
    this.container = container;
    this.hooks = hooks;
    this.stepIndex = 0;
    this.dialogNodeId = null;
    this._buildState = null;
  }

  get steps() {
    return this.module.steps || [];
  }

  get totalSteps() {
    return this.steps.length;
  }

  start(fromStep = 0) {
    this.stepIndex = fromStep;
    this._renderCurrent();
    if (this.hooks.onStepChange) this.hooks.onStepChange(this.stepIndex);
  }

  _advance() {
    if (this.stepIndex >= this.totalSteps - 1) {
      if (this.hooks.onComplete) this.hooks.onComplete(this.module);
      return;
    }
    this.stepIndex += 1;
    this.dialogNodeId = null;
    this._buildState = null;
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

    let body = "";
    switch (step.type) {
      case "theory":
        body = this._renderTheory(step);
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

    this.container.innerHTML = header + `<div class="step-body" data-step-type="${escapeHtml(step.type)}">${body}</div>`;
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
      <div class="card">${formatTheoryBody(step.body || "")}</div>
      <button type="button" class="btn btn--primary" data-action="next">Далее</button>
    `;
  }

  _renderSelect(step) {
    const opts = (step.options || [])
      .map(
        (o) => `
      <button type="button" class="choice" data-select-id="${escapeHtml(o.id)}">
        ${escapeHtml(o.text)}
      </button>
    `
      )
      .join("");

    return `
      <p class="muted">${escapeHtml(step.prompt || "")}</p>
      <div class="choice-list" role="group" aria-label="Варианты ответа">${opts}</div>
      <div class="feedback" id="select-feedback" hidden></div>
      <button type="button" class="btn btn--primary" id="select-next" disabled data-action="next">Далее</button>
    `;
  }

  _renderSort(step) {
    const items = (step.items || [])
      .map(
        (it, idx) => `
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
      <button type="button" class="btn btn--primary" id="sort-check" disabled>Проверить</button>
    `;
  }

  _renderCamera(step) {
    const opts = (step.options || [])
      .map(
        (o) => `
      <button type="button" class="choice" data-camera-id="${escapeHtml(o.id)}">${escapeHtml(o.text)}</button>
    `
      )
      .join("");
    return `
      <p class="muted">${escapeHtml(step.prompt || "")}</p>
      <div class="choice-list">${opts}</div>
      <div class="feedback" id="cam-feedback" hidden></div>
      <button type="button" class="btn btn--primary" id="cam-next" disabled>Далее</button>
    `;
  }

  _renderDialog(step) {
    const start = step.start || "n1";
    if (!this.dialogNodeId) this.dialogNodeId = start;
    const node = (step.nodes || {})[this.dialogNodeId];
    if (!node) {
      return `<p>Ошибка диалога.</p><button type="button" class="btn btn--primary" data-action="next-dlg">Далее</button>`;
    }
    const bubbleClass = node.speaker === "you" ? "dialog-bubble--you" : "dialog-bubble--them";
    const choices = (node.choices || [])
      .map(
        (c) => `
      <button type="button" class="choice" data-dialog-next="${escapeHtml(c.next)}">${escapeHtml(c.text)}</button>
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

    return `
      <div class="dialog-stack">
        <div class="dialog-bubble ${bubbleClass}">${text}</div>
      </div>
      ${choices ? `<div class="choice-list">${choices}</div>` : ""}
      ${continueBtn}
    `;
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
        const label = val ? escapeHtml(this._findBankText(step, val)) : "— нажмите фразу, затем слот —";
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

    return `
      <p class="muted">${escapeHtml(step.instructions || "")}</p>
      <div class="build-slots">${slotHtml}</div>
      <p class="muted" style="font-size:0.85rem">Совет: сначала нажмите фразу, затем подходящий слот (наблюдение, чувство…).</p>
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

  _renderBodySwap(step) {
    const phrases = (step.yourPhrases || []).map((p) => `<li>${escapeHtml(p)}</li>`).join("");
    return `
      <div class="body-swap">
        <h3>Смена тела</h3>
        <p class="muted">Представьте, как ваши слова могли звучать для другого:</p>
        <ul>${phrases}</ul>
        <p><strong>Перспектива собеседника:</strong> ${escapeHtml(step.theirPerspective || "")}</p>
      </div>
      <button type="button" class="btn btn--primary" data-action="next">Далее</button>
    `;
  }

  _renderReflection(step) {
    return `
      <p>${escapeHtml(step.prompt || "")}</p>
      <label class="sr-only" for="refl-area">${escapeHtml(step.title || "Рефлексия")}</label>
      <textarea id="refl-area" rows="3" style="width:100%;padding:12px;border-radius:12px;border:2px solid rgba(0,0,0,0.1);font:inherit;resize:vertical" placeholder="${escapeHtml(step.placeholder || "")}"></textarea>
      <button type="button" class="btn btn--primary" style="margin-top:12px" data-action="next">Далее</button>
    `;
  }

  _bindStepHandlers(step) {
    if (step.type === "theory") {
      const btn = this.container.querySelector('[data-action="next"]');
      if (btn) btn.addEventListener("click", () => this._advance());
    }

    if (step.type === "select") {
      let chosen = null;
      const fb = this.container.querySelector("#select-feedback");
      const nextBtn = this.container.querySelector("#select-next");
      this.container.querySelectorAll(".choice[data-select-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.container.querySelectorAll(".choice[data-select-id]").forEach((b) => b.classList.remove("is-selected"));
          btn.classList.add("is-selected");
          const id = btn.getAttribute("data-select-id");
          const opt = (step.options || []).find((o) => o.id === id);
          chosen = opt;
          if (fb && opt) {
            fb.hidden = false;
            let cls = "feedback--partial";
            if (opt.quality === "best") cls = "feedback--ok";
            if (opt.quality === "poor") cls = "feedback--hint";
            fb.className = `feedback ${cls}`;
            fb.textContent = opt.feedback || "";
          }
          if (nextBtn) nextBtn.disabled = false;
        });
      });
      if (nextBtn) nextBtn.addEventListener("click", () => this._advance());
    }

    if (step.type === "sort") {
      const answers = {};
      const feedback = this.container.querySelector("#sort-feedback");
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
          if (feedback) {
            feedback.hidden = false;
            if (ok === all) {
              feedback.className = "feedback feedback--ok";
              feedback.textContent = "Отлично: вы различаете тон Волка и Жирафа.";
            } else {
              feedback.className = "feedback feedback--partial";
              feedback.textContent = `Верно ${ok} из ${all}. Перечитайте «опасные» слова и просьбы — мягкая подсказка в теории.`;
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
      this.container.querySelectorAll(".choice[data-camera-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.container.querySelectorAll(".choice[data-camera-id]").forEach((b) => {
            b.classList.add("is-disabled");
          });
          const id = btn.getAttribute("data-camera-id");
          const opt = (step.options || []).find((o) => o.id === id);
          if (fb && opt) {
            fb.hidden = false;
            fb.className = opt.correct ? "feedback feedback--ok" : "feedback feedback--partial";
            fb.textContent = opt.explain || "";
          }
          if (nextBtn) nextBtn.disabled = false;
        });
      });
      if (nextBtn) nextBtn.addEventListener("click", () => this._advance());
    }

    if (step.type === "dialog") {
      this.container.querySelectorAll("[data-dialog-next]").forEach((btn) => {
        btn.addEventListener("click", () => {
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
          const fb = this.container.querySelector("#build-feedback");
          if (fb) {
            fb.hidden = false;
            fb.className = good ? "feedback feedback--ok" : "feedback feedback--partial";
            fb.textContent = good
              ? "Собрано верно: факт, чувство, потребность и просьба согласованы."
              : "Почти. Сверьтесь: наблюдение без ярлыков, чувство — ваше, потребность — ценность, просьба — с выбором.";
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
      const btn = this.container.querySelector('[data-action="next"]');
      if (btn) btn.addEventListener("click", () => this._advance());
    }

    if (step.type === "reflection") {
      const btn = this.container.querySelector('[data-action="next"]');
      if (btn) btn.addEventListener("click", () => this._advance());
    }
  }
}
