/**
 * Загрузка JSON справочников для экрана справки и модалки в упражнении build.
 */
export async function fetchReferenceCompact() {
  try {
    const [fr, nr] = await Promise.all([
      fetch("data/reference/feelings.json").then((r) => r.json()),
      fetch("data/reference/needs.json").then((r) => r.json()),
    ]);
    return { feelings: fr, needs: nr };
  } catch {
    return null;
  }
}

export function renderFeelingsNeedsHtml(data) {
  if (!data) {
    return '<p class="muted">Нет данных. Откройте приложение через локальный сервер.</p>';
  }
  const fr = data.feelings;
  const nr = data.needs;
  let feelingsHtml = "";
  if (Array.isArray(fr.groups)) {
    feelingsHtml = fr.groups
      .map(
        (g) => `
      <h4 style="margin:14px 0 6px;font-size:0.95rem">${escapeHtml(g.label)}</h4>
      ${(g.subgroups || [])
        .map(
          (sg) => `
        <p class="muted" style="margin:8px 0 4px;font-size:0.82rem">${escapeHtml(sg.label)}</p>
        <ul style="margin:0 0 10px;padding-left:1.2rem">${(sg.items || []).map((i) => `<li>${escapeHtml(i.label)}</li>`).join("")}</ul>
      `
        )
        .join("")}`
      )
      .join("");
  } else {
    const pos = (fr.positive || []).map((x) => `<li>${escapeHtml(x.label)}</li>`).join("");
    const hvy = (fr.heavy || []).map((x) => `<li>${escapeHtml(x.label)}</li>`).join("");
    feelingsHtml = `<h3 style="margin-top:0;font-size:1rem">Позитивные чувства</h3><ul>${pos}</ul>
      <h3 style="font-size:1rem">Тяжёлые чувства</h3><ul>${hvy}</ul>`;
  }
  const needsHtml = (nr.categories || [])
    .map(
      (c) => `
      <h4 style="margin:12px 0 6px;font-size:0.95rem">${escapeHtml(c.label)}</h4>
      <ul style="margin:0;padding-left:1.2rem">${(c.items || []).map((i) => `<li>${escapeHtml(i.label)}</li>`).join("")}</ul>
    `
    )
    .join("");
  return `
    <div class="ref-compact-block">
      <h3 style="margin-top:0;font-size:1rem">Чувства (колесо эмоций)</h3>
      ${feelingsHtml}
      <h3 style="font-size:1rem">Потребности</h3>
      ${needsHtml}
    </div>`;
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : String(str);
  return d.innerHTML;
}
