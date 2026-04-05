import { getAllModules, MODULE_ORDER, getModule } from "./content/catalog.js";
import * as storage from "./storage.js";
import { LessonEngine } from "./lesson-engine.js";

const app = document.getElementById("app");
let currentEngine = null;
let activeModuleId = null;

function showHome() {
  const st = storage.getState();
  const modules = getAllModules();
  const completed = st.completedModules.length;
  const total = modules.length;

  const cards = modules
    .map((m) => {
      const unlocked = storage.isModuleUnlocked(m.id, MODULE_ORDER);
      const done = st.completedModules.includes(m.id);
      const lockClass = unlocked ? "" : "card--locked";
      const meta = `${m.estimatedMinutes || "—"} мин · ${done ? "пройдено" : "не начато"}`;
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

  const pct = total ? Math.round((completed / total) * 100) : 0;
  const pctUnit = total ? completed / total : 0;
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
    : '<p class="muted" style="margin:0">Пройдите модуль — появится значок.</p>';

  const lockedSlots = MODULE_ORDER.filter((id) => !st.completedModules.includes(id)).length;

  app.innerHTML = `
    <section class="screen is-active" id="screen-home">
      <div class="hero">
        <div class="hero-mascots" aria-hidden="true"><span class="hero-mascots__g">🦒</span><span class="hero-mascots__w">🐺</span></div>
        <h1>ННО Тренажёр</h1>
        <p class="muted">Ненасильственное общение: язык Жирафа и язык Волка. Маршалл Розенберг, «язык жизни».</p>
      </div>

      <div class="card">
        <h2 style="margin:0 0 8px;font-size:1rem">Ваш рост</h2>
        <div class="giraffe-progress" style="--pct:${pctUnit}" role="img" aria-label="Прогресс: ${completed} из ${total} модулей">
          <div class="giraffe-progress__scene">
            <div class="giraffe-progress__neck-wrap">
              <div class="giraffe-progress__neck"></div>
              <div class="giraffe-progress__head" aria-hidden="true">🦒</div>
            </div>
          </div>
        </div>
        <p class="muted" style="margin:8px 0 4px;font-size:0.9rem">Модулей завершено: ${completed} из ${total}. Чем выше «шея», тем шире взгляд на ситуации.</p>
        <p class="muted" style="margin:0;font-size:0.9rem">Мягкие баллы Жирафа (всего): <strong>${giraffePoints}</strong> — без штрафов, только поддержка интереса.</p>
      </div>

      <h2 class="muted" style="font-size:0.85rem;margin:20px 0 10px">Модули</h2>
      ${cards}

      <div class="card" style="margin-top:16px">
        <h2 style="margin:0 0 8px;font-size:1rem">Подарки гармонии</h2>
        <p class="muted" style="font-size:0.85rem;margin:0 0 10px">Предметы для «комнаты Жирафа» — напоминание о росте, а не гонка.</p>
        ${collectionBlock}
        ${lockedSlots ? `<p class="muted" style="font-size:0.8rem;margin-top:8px">Ещё ${lockedSlots} модул(ей) — по порядку или по желанию.</p>` : ""}
      </div>

      <p style="margin-top:16px">
        <button type="button" class="btn btn--secondary" id="btn-reference">Дневник чувств и справочник</button>
      </p>
      <p style="margin-top:8px">
        <button type="button" class="btn btn--ghost" id="btn-reset">Сбросить прогресс</button>
      </p>

      <div class="disclaimer">
        Это учебный тренажёр формулировок, а не замена терапии, медицинской или юридической помощи в острых ситуациях.
      </div>
    </section>
  `;

  app.querySelectorAll(".card--clickable[data-module-id]").forEach((el) => {
    el.addEventListener("click", () => {
      if (el.classList.contains("card--locked")) return;
      const id = el.getAttribute("data-module-id");
      startLesson(id);
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
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : String(str);
  return d.innerHTML;
}

async function showReference() {
  let feelingsHtml = "";
  let needsHtml = "";
  let feelingsData = [];
  try {
    const [fr, nr] = await Promise.all([
      fetch("data/reference/feelings.json").then((r) => r.json()),
      fetch("data/reference/needs.json").then((r) => r.json()),
    ]);
    feelingsData = [
      ...(fr.positive || []).map((x) => ({ ...x, group: "positive" })),
      ...(fr.heavy || []).map((x) => ({ ...x, group: "heavy" })),
    ];
    const pos = (fr.positive || []).map((x) => `<li>${escapeHtml(x.label)}</li>`).join("");
    const hvy = (fr.heavy || []).map((x) => `<li>${escapeHtml(x.label)}</li>`).join("");
    feelingsHtml = `
      <h3>Позитивные чувства</h3><ul>${pos}</ul>
      <h3>Тяжёлые чувства</h3><ul>${hvy}</ul>
    `;
    needsHtml = (nr.categories || [])
      .map(
        (c) => `
      <h3>${escapeHtml(c.label)}</h3>
      <ul>${(c.items || []).map((i) => `<li>${escapeHtml(i.label)}</li>`).join("")}</ul>
    `
      )
      .join("");
  } catch {
    feelingsHtml = "<p class=\"muted\">Откройте приложение через локальный сервер (например, <code>python -m http.server</code>), чтобы загрузить справочники.</p>";
  }

  let wolfHtml = "";
  try {
    const w = await fetch("data/reference/wolf_markers.json").then((r) => r.json());
    wolfHtml = `<ul>${(w.markers || []).map((m) => `<li><strong>${escapeHtml(m.word)}</strong> — ${escapeHtml(m.hint)}</li>`).join("")}</ul>`;
  } catch {
    wolfHtml = "";
  }

  const diaryIds = storage.getFeelingsDiary();
  const diaryChips =
    feelingsData.length > 0
      ? `<div class="diary-chips" role="group" aria-label="Что я чувствую сейчас">
          <p class="muted" style="margin:0 0 10px">Нажмите слова — это самоэмпатия, не оценка. Сохранится в браузере.</p>
          ${feelingsData
            .map((f) => {
              const on = diaryIds.includes(f.id) ? " is-on" : "";
              return `<button type="button" class="diary-chip${on}" data-feeling-id="${escapeHtml(f.id)}">${escapeHtml(f.label)}</button>`;
            })
            .join("")}
        </div>`
      : "";

  app.innerHTML = `
    <section class="screen is-active">
      <div class="lesson-header">
        <div>
          <span class="tag">Справочник</span>
          <h2>Дневник чувств</h2>
        </div>
        <button type="button" class="lesson-header__close" id="ref-close" aria-label="Назад">×</button>
      </div>
      <div class="card">
        <h3 style="margin-top:0">Сейчас</h3>
        ${diaryChips || "<p class=\"muted\">Нет списка чувств — загрузите справочник через сервер.</p>"}
      </div>
      <div class="card">${feelingsHtml}</div>
      <div class="card">${needsHtml}</div>
      <div class="card">
        <h3 style="margin-top:0">Маркеры «Волка»</h3>
        ${wolfHtml || "<p class=\"muted\">Нет данных.</p>"}
      </div>
      <button type="button" class="btn btn--primary" id="ref-back">На главную</button>
    </section>
  `;
  document.getElementById("ref-close")?.addEventListener("click", showHome);
  document.getElementById("ref-back")?.addEventListener("click", showHome);

  app.querySelectorAll(".diary-chip[data-feeling-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-feeling-id");
      let cur = storage.getFeelingsDiary();
      if (cur.includes(id)) cur = cur.filter((x) => x !== id);
      else cur = [...cur, id];
      storage.saveFeelingsDiary(cur);
      btn.classList.toggle("is-on", cur.includes(id));
    });
  });
}

function startLesson(moduleId) {
  const mod = getModule(moduleId);
  if (!mod) return;
  activeModuleId = moduleId;
  const container = document.createElement("div");
  app.innerHTML = "";
  app.appendChild(container);

  const saved = storage.getStepIndex(moduleId);
  currentEngine = new LessonEngine(mod, container, {
    onStepChange: (i) => storage.setStepIndex(moduleId, i),
    onComplete: (m, meta) => {
      storage.markModuleCompleted(m.id);
      if (m.badge?.id) storage.addCollectionItem(m.badge.id);
      if (meta?.points) storage.addGiraffePoints(meta.points);
      storage.setStepIndex(m.id, 0);
      showSummary(m, meta?.points ?? 0);
    },
  });

  currentEngine.start(Math.min(saved, (mod.steps?.length || 1) - 1));

  window.addEventListener(
    "nvc-lesson-exit",
    () => {
      storage.setStepIndex(moduleId, currentEngine?.stepIndex ?? 0);
      showHome();
    },
    { once: true }
  );
}

function showSummary(mod, sessionPoints) {
  const gift = mod.badge?.giftTitle || mod.badge?.label || "подарок";
  const giftDesc = mod.badge?.giftDescription || "";
  app.innerHTML = `
    <section class="screen is-active">
      <div class="hero">
        <div class="hero__emoji">${mod.badge?.emoji || "🦒"}</div>
        <h1>Модуль завершён</h1>
        <p class="muted">${escapeHtml(mod.title)}</p>
      </div>
      <div class="card">
        <p>В коллекцию добавлено: <strong>${escapeHtml(gift)}</strong>.</p>
        ${giftDesc ? `<p class="muted" style="margin-top:8px">${escapeHtml(giftDesc)}</p>` : ""}
        <p class="muted" style="margin-top:12px">Баллы за этот заход: <strong>${sessionPoints}</strong> (2 — «чистый Жираф», 1 — «старающийся», 0 — сигнал, не провал).</p>
        <p class="muted" style="margin:0">Продолжайте в своём темпе — без штрафов за паузы.</p>
      </div>
      <button type="button" class="btn btn--primary" id="sum-continue">К модулям</button>
    </section>
  `;
  document.getElementById("sum-continue")?.addEventListener("click", showHome);
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

showHome();
