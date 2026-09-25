"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createHeroNetwork } from "./hero-network-animation";

export function HeroNetwork() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const animation = useRef<ReturnType<typeof createHeroNetwork>>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const surface = canvas.current;
    const stage = surface?.closest<HTMLElement>(".hero-stage");
    if (!surface || !stage) return;

    animation.current = createHeroNetwork(surface, stage);
    if (animation.current) surface.dataset.ready = "true";
    return () => {
      animation.current?.destroy();
      animation.current = null;
      delete surface.dataset.ready;
    };
  }, []);

  function toggleMotion() {
    const next = !paused;
    animation.current?.setPaused(next);
    setPaused(next);
  }

  return (
    <>
      <canvas ref={canvas} className="hero-network" aria-hidden="true" />
      <button
        className="hero-motion-toggle"
        type="button"
        aria-label="Pause background animation"
        aria-pressed={paused}
        title={
          paused ? "Resume background animation" : "Pause background animation"
        }
        onClick={toggleMotion}
      >
        {paused ? (
          <Play size={15} aria-hidden="true" />
        ) : (
          <Pause size={15} aria-hidden="true" />
        )}
      </button>
    </>
  );
}
