"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ResidentMotion({ children }: { children: ReactNode }) {
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = main.current;
    if (!root) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Map<Element, Animation>();
    const revealed = new WeakSet<Element>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (!isIntersecting) return;
          observer.unobserve(target);
          if (
            revealed.has(target) ||
            reducedMotion.matches ||
            target.contains(document.activeElement)
          )
            return;
          revealed.add(target);
          // Content stays visible in HTML, with or without JavaScript.
          const animation = target.animate(
            [
              { opacity: 0.65, transform: "translateY(18px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
          );
          animations.set(target, animation);
          animation.onfinish = () => animations.delete(target);
        });
      },
      { threshold: 0.08 },
    );

    root
      .querySelectorAll<HTMLElement>("[data-reveal]")
      .forEach((element) => observer.observe(element));

    function stopAnimations() {
      animations.forEach((animation) => animation.cancel());
      animations.clear();
    }

    function handleMotionPreference() {
      if (reducedMotion.matches) stopAnimations();
    }

    // Keyboard navigation should never land on a moving control.
    root.addEventListener("focusin", stopAnimations);
    reducedMotion.addEventListener("change", handleMotionPreference);
    return () => {
      observer.disconnect();
      stopAnimations();
      root.removeEventListener("focusin", stopAnimations);
      reducedMotion.removeEventListener("change", handleMotionPreference);
    };
  }, []);

  return (
    <main ref={main} id="main-content" tabIndex={-1}>
      {children}
    </main>
  );
}
