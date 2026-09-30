/** Yield only UI-triggered work so its loading feedback can actually be painted. */
export function feedbackPaint(): Promise<void> {
  if (typeof document === 'undefined' || document.hidden) return Promise.resolve();
  return new Promise((resolve) => {
    let frame = 0;
    const finish = (): void => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      resolve();
    };
    const timer = setTimeout(finish, 100);
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(finish);
    });
  });
}
