"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function useUnsavedChanges(dirty: boolean) {
  const router = useRouter();
  const pendingAction = useRef<(() => void) | null>(null);
  const leaving = useRef(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  function requestDiscard(action: () => void) {
    if (!dirty) { action(); return; }
    pendingAction.current = action;
    setShowConfirmation(true);
  }

  function cancelDiscard() {
    pendingAction.current = null;
    setShowConfirmation(false);
  }

  function confirmDiscard() {
    const action = pendingAction.current;
    cancelDiscard();
    action?.();
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!leaving.current) event.preventDefault();
    };
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== "_self") || link.hasAttribute("download") || link.href === location.href) return;
      const destination = new URL(link.href);
      if (!['http:', 'https:'].includes(destination.protocol)) return;
      if (destination.origin === location.origin && destination.pathname === location.pathname && destination.search === location.search) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      pendingAction.current = () => {
        leaving.current = true;
        if (destination.origin === location.origin) router.push(destination.pathname + destination.search + destination.hash);
        else location.assign(destination.href);
      };
      setShowConfirmation(true);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty, router]);

  return { showConfirmation, requestDiscard, cancelDiscard, confirmDiscard };
}
