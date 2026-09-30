import { onBeforeUnmount } from 'vue';

/** Animate the entering page without CSS transition detection or serial exit waits. */
export function usePageTransition(name: () => string) {
  const active = new Map<Element, Animation>();
  const transforms: Record<string, string> = {
    'slide-left': 'translateX(30px)',
    'slide-right': 'translateX(-30px)',
    'slide-up': 'translateY(24px)',
    'slide-down': 'translateY(-24px)',
    zoom: 'scale(0.95)',
    'zoom-big': 'scale(0.8)',
  };

  function cancel(element: Element): void {
    active.get(element)?.cancel();
    active.delete(element);
  }

  function enter(element: Element, done: () => void): void {
    cancel(element);
    const animationName = name();
    if (
      animationName === 'none' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      typeof element.animate !== 'function'
    ) {
      done();
      return;
    }
    // Only compositor properties change; no offsetHeight/getComputedStyle read is needed.
    const transform = transforms[animationName];
    const animation = element.animate(
      [
        { opacity: 0, ...(transform ? { transform } : {}) },
        { opacity: 1, ...(transform ? { transform: 'none' } : {}) },
      ],
      { duration: 200, easing: 'ease-out' },
    );
    active.set(element, animation);
    const finish = (): void => {
      if (active.get(element) === animation) active.delete(element);
      done();
    };
    animation.onfinish = finish;
    animation.oncancel = finish;
  }

  onBeforeUnmount(() => {
    active.forEach((animation) => animation.cancel());
    active.clear();
  });
  return { enter, cancel };
}
