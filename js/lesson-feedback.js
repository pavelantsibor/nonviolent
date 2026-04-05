/**
 * Мягкая визуальная и тактильная обратная связь (Волк / Жираф)
 */
export function flashTone(tone) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const el = document.body;
  if (tone === "wolf") {
    el.classList.add("anim-flash-wolf");
    window.setTimeout(() => el.classList.remove("anim-flash-wolf"), 500);
  } else if (tone === "giraffe") {
    el.classList.add("anim-flash-giraffe");
    window.setTimeout(() => el.classList.remove("anim-flash-giraffe"), 500);
  }
}

export function vibrateTone(tone) {
  if (!navigator.vibrate) return;
  if (tone === "wolf") navigator.vibrate([80, 50, 80]);
  else if (tone === "giraffe") navigator.vibrate(40);
}
