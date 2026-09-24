"use client";

import { type Dispatch, type RefObject, type SetStateAction, useLayoutEffect } from "react";

type ViewportPopoverOptions = {
  align?: "start" | "end";
  maxHeight: number;
  maxWidth?: number;
  minWidth: number;
};

type ViewportPopoverArgs = ViewportPopoverOptions & {
  anchorRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
};

/** Position a native popover in the visible viewport, including after nested scrolls. */
export function useViewportPopover({
  align = "start",
  anchorRef,
  isOpen,
  maxHeight,
  maxWidth = Infinity,
  minWidth,
  panelRef,
  setIsOpen,
}: ViewportPopoverArgs) {
  useLayoutEffect(() => {
    if (!isOpen) return;
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const anchorElement = anchor;
    const panelElement = panel;

    let frame = 0;
    const viewport = window.visualViewport;

    function positionPanel() {
      const anchorRect = anchorElement.getBoundingClientRect();
      const padding = 8;
      const gap = 5;
      const bounds = {
        left: (viewport?.offsetLeft ?? 0) + padding,
        top: (viewport?.offsetTop ?? 0) + padding,
        right: (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth) - padding,
        bottom: (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - padding,
      };

      if (
        anchorRect.bottom < bounds.top || anchorRect.top > bounds.bottom ||
        anchorRect.right < bounds.left || anchorRect.left > bounds.right
      ) {
        setIsOpen(false);
        return;
      }

      const width = Math.min(
        Math.max(anchorRect.width, minWidth),
        maxWidth,
        bounds.right - bounds.left,
      );
      panelElement.style.width = `${width}px`;
      const height = Math.min(panelElement.scrollHeight, maxHeight, bounds.bottom - bounds.top);
      const below = bounds.bottom - anchorRect.bottom - gap;
      const above = anchorRect.top - bounds.top - gap;
      const opensUpward = below < height && above > below;
      const available = opensUpward ? above : below;
      const panelHeight = Math.min(height, Math.max(0, available));
      const top = available >= 44
        ? opensUpward ? anchorRect.top - gap - panelHeight : anchorRect.bottom + gap
        : bounds.top;
      const preferredLeft = align === "end" ? anchorRect.right - width : anchorRect.left;

      panelElement.style.left = `${Math.min(Math.max(preferredLeft, bounds.left), bounds.right - width)}px`;
      panelElement.style.top = `${top}px`;
      panelElement.style.maxHeight = `${available >= 44 ? panelHeight : bounds.bottom - bounds.top}px`;
      panelElement.dataset.placement = opensUpward ? "top" : "bottom";
    }

    function schedulePosition() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(positionPanel);
    }

    if (typeof panel.showPopover === "function" && !panel.matches(":popover-open")) {
      panel.showPopover();
    }
    positionPanel();
    const resizeObserver = new ResizeObserver(schedulePosition);
    resizeObserver.observe(anchor);
    resizeObserver.observe(panel);
    const contentObserver = new MutationObserver(schedulePosition);
    contentObserver.observe(panel, { childList: true, characterData: true, subtree: true });
    window.addEventListener("resize", schedulePosition);
    window.addEventListener("scroll", schedulePosition, true);
    window.addEventListener("transitionend", schedulePosition, true);
    viewport?.addEventListener("resize", schedulePosition);
    viewport?.addEventListener("scroll", schedulePosition);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      contentObserver.disconnect();
      window.removeEventListener("resize", schedulePosition);
      window.removeEventListener("scroll", schedulePosition, true);
      window.removeEventListener("transitionend", schedulePosition, true);
      viewport?.removeEventListener("resize", schedulePosition);
      viewport?.removeEventListener("scroll", schedulePosition);
      if (typeof panel.hidePopover === "function" && panel.matches(":popover-open")) {
        panel.hidePopover();
      }
    };
  }, [align, anchorRef, isOpen, maxHeight, maxWidth, minWidth, panelRef, setIsOpen]);
}
