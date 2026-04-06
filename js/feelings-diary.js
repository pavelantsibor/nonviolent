/**
 * Колесо эмоций из data/reference/feelings.json (groups → subgroups → items)
 */
export function flattenFeelingsWheel(fr) {
  if (!fr || !Array.isArray(fr.groups)) return [];
  const out = [];
  for (const g of fr.groups) {
    for (const sg of g.subgroups || []) {
      for (const it of sg.items || []) {
        if (!it?.id) continue;
        out.push({
          id: it.id,
          label: it.label,
          groupId: g.id,
          groupLabel: g.label,
          subgroupId: sg.id,
          subgroupLabel: sg.label,
        });
      }
    }
  }
  return out;
}

export function flattenNeeds(nr) {
  if (!nr || !Array.isArray(nr.categories)) return [];
  const out = [];
  for (const c of nr.categories) {
    for (const it of c.items || []) {
      if (!it?.id) continue;
      out.push({
        id: it.id,
        label: it.label,
        categoryId: c.id,
        categoryLabel: c.label,
      });
    }
  }
  return out;
}

export function formatDiaryDate(iso, locale = "ru-RU") {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}
