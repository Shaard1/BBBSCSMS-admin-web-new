import Image from "next/image";
import { useEffect, useState } from "react";

export function WorkspaceLoader() {
  const [showMessage, setShowMessage] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setShowMessage(true), 3000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <main
      className="admin-loading workspace-loading"
      role="status"
      aria-live="polite"
      aria-label="Checking account access. Opening your workspace."
    >
      <div className="workspace-loading-content">
        <picture>
        <source
          media="(prefers-reduced-motion: reduce)"
          srcSet="/assets/brand/workspace-loader-still.png"
        />
        <Image
          className="workspace-loading-logo"
          src="/assets/brand/workspace-loader.webp"
          width={480}
          height={480}
          alt=""
          priority
          unoptimized
        />
        </picture>
        <p className="workspace-loading-message" aria-hidden={!showMessage}>
          {showMessage ? "Opening your workspace…" : "\u00a0"}
        </p>
      </div>
    </main>
  );
}
