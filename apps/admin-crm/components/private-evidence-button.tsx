"use client";

import { useEffect, useRef, useState } from "react";
import { ImageViewer } from "@/components/image-viewer";
import { resolvePrivateFiles } from "@/lib/private-files";

export function PrivateEvidenceButton({ source, kind }: { source: string; kind: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function openEvidence() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const [resolved] = await resolvePrivateFiles([{ identity_evidence_url: source }]);
      if (!mounted.current) return;
      if (!resolved.identity_evidence_url) {
        setError("Evidence could not be opened. Check your connection and access, then try again.");
      } else {
        setImageUrl(resolved.identity_evidence_url);
      }
    } catch {
      if (mounted.current) setError("Evidence could not be opened. Please try again.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }
  return <>
    <button type="button" className="document-evidence-open" disabled={loading} onClick={() => void openEvidence()}>
      {loading ? "Opening evidence…" : `Open ${kind} evidence`}
    </button>
    {loading ? <span className="evidence-load-status" role="status">Requesting secure access…</span> : null}
    {error ? <p className="evidence-load-error" role="alert">{error}</p> : null}
    {imageUrl ? <ImageViewer key={imageUrl} imageUrl={imageUrl} title={`${kind[0].toUpperCase()}${kind.slice(1)} evidence`} allowOriginal={false} onClose={() => setImageUrl(null)} /> : null}
  </>;
}
