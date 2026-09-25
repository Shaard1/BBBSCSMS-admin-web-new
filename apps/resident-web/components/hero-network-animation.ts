type Point = {
  originX: number;
  originY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  phase: number;
};

const FRAME_INTERVAL = 1000 / 30;
const POINTER_RADIUS = 150;
const LINK_DISTANCE = 165;

/** A small, decorative canvas; no page content depends on this enhancement. */
export function createHeroNetwork(
  canvas: HTMLCanvasElement,
  stage: HTMLElement,
) {
  const context = canvas.getContext("2d");
  if (!context) return null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  let width = 0;
  let height = 0;
  let points: Point[] = [];
  let pointer: { x: number; y: number } | null = null;
  let paused = false;
  let visible = false;
  let frame = 0;
  let lastFrame = 0;
  let elapsed = 0;

  function paint() {
    if (!context) return;
    context.clearRect(0, 0, width, height);
    for (let index = 0; index < points.length; index++) {
      const point = points[index];
      for (let next = index + 1; next < points.length; next++) {
        const neighbor = points[next];
        const distance = Math.hypot(point.x - neighbor.x, point.y - neighbor.y);
        if (distance >= LINK_DISTANCE) continue;
        context.strokeStyle = `rgba(22, 78, 173, ${0.16 * (1 - distance / LINK_DISTANCE)})`;
        context.lineWidth = 0.8;
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(neighbor.x, neighbor.y);
        context.stroke();
      }
      context.fillStyle =
        index % 5 === 0 ? "rgba(0, 119, 217, 0.42)" : "rgba(22, 78, 173, 0.24)";
      context.beginPath();
      context.arc(
        point.x,
        point.y,
        index % 5 === 0 ? 2.2 : 1.5,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }

  function updatePoints(delta: number) {
    const easing = 1 - Math.exp(-delta / 130);
    for (const point of points) {
      const baseX =
        point.originX * width + Math.sin(elapsed / 6500 + point.phase) * 22;
      const baseY =
        point.originY * height + Math.cos(elapsed / 7800 + point.phase) * 18;
      const dx = pointer ? baseX - pointer.x : 0;
      const dy = pointer ? baseY - pointer.y : 0;
      const distance = Math.hypot(dx, dy);
      const force = pointer
        ? Math.max(0, 1 - distance / POINTER_RADIUS) * 65
        : 0;
      point.offsetX +=
        ((dx / (distance || 1)) * force - point.offsetX) * easing;
      point.offsetY +=
        ((dy / (distance || 1)) * force - point.offsetY) * easing;
      point.x = baseX + point.offsetX;
      point.y = baseY + point.offsetY;
    }
  }

  function tick(now: number) {
    frame = requestAnimationFrame(tick);
    const delta = now - lastFrame;
    if (delta < FRAME_INTERVAL) return;
    lastFrame = now;
    // Clamp resumed frames so tab switching never produces a sudden jump.
    const step = Math.min(delta, 64);
    elapsed += step;
    updatePoints(step);
    paint();
  }

  function syncPlayback() {
    cancelAnimationFrame(frame);
    frame = 0;
    pointer = null;
    if (paused || reducedMotion.matches || !visible || document.hidden) return;
    lastFrame = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function resize() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    // Bounded density keeps the hero light on mobile and wide screens alike.
    const count = Math.min(
      76,
      Math.max(24, Math.round((width * height) / 14000)),
    );
    points = Array.from({ length: count }, (_, index) => {
      const originX = (index * 0.61803398875 + 0.07) % 1;
      const originY = (index * 0.41421356237 + 0.11) % 1;
      return {
        originX,
        originY,
        x: originX * width,
        y: originY * height,
        offsetX: 0,
        offsetY: 0,
        phase: index * 2.4,
      };
    });
    updatePoints(0);
    paint();
  }

  function movePointer(event: PointerEvent) {
    if (
      !finePointer.matches ||
      event.pointerType === "touch" ||
      paused ||
      reducedMotion.matches
    )
      return;
    const bounds = stage.getBoundingClientRect();
    pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function clearPointer() {
    pointer = null;
  }

  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncPlayback();
  });
  const sizeObserver = new ResizeObserver(resize);
  resize();
  intersection.observe(stage);
  sizeObserver.observe(stage);
  stage.addEventListener("pointermove", movePointer, { passive: true });
  stage.addEventListener("pointerleave", clearPointer);
  window.addEventListener("scroll", clearPointer, { passive: true });
  document.addEventListener("visibilitychange", syncPlayback);
  reducedMotion.addEventListener("change", syncPlayback);

  return {
    setPaused(value: boolean) {
      paused = value;
      syncPlayback();
    },
    destroy() {
      cancelAnimationFrame(frame);
      intersection.disconnect();
      sizeObserver.disconnect();
      stage.removeEventListener("pointermove", movePointer);
      stage.removeEventListener("pointerleave", clearPointer);
      window.removeEventListener("scroll", clearPointer);
      document.removeEventListener("visibilitychange", syncPlayback);
      reducedMotion.removeEventListener("change", syncPlayback);
    },
  };
}
