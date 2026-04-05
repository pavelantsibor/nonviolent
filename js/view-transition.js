/**
 * Обёртка для плавной смены DOM (View Transitions API с fallback).
 */
export function withViewTransition(updateDom) {
  if (typeof document.startViewTransition === "function") {
    return document.startViewTransition(() => {
      updateDom();
    });
  }
  updateDom();
  return Promise.resolve();
}
