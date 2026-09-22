/* eslint-disable @next/next/no-img-element */
"use client";

import { ExternalLink, Minus, Plus, RotateCcw, X } from "lucide-react";
import { Modal } from "@/components/modal";
import { useState } from "react";

type ImageViewerProps = {
  imageUrl: string;
  title: string;
  onClose: () => void;
};

export function ImageViewer({ imageUrl, title, onClose }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const safeImageUrl = toSafeImageUrl(imageUrl);

  return (
    <Modal title={title} onClose={onClose} className="image-viewer-backdrop">
      <div className="image-viewer-toolbar">
        <div>
          <strong>{title}</strong>
          <span>{Math.round(scale * 100)}%</span>
        </div>
        <button
          type="button"
          onClick={() => setScale((value) => Math.max(0.5, value - 0.25))}
        >
          <Minus size={18} /> Zoom out
        </button>
        <button
          type="button"
          onClick={() => setScale((value) => Math.min(3, value + 0.25))}
        >
          <Plus size={18} /> Zoom in
        </button>
        <button type="button" onClick={() => setScale(1)}>
          <RotateCcw size={18} /> Reset
        </button>
        {safeImageUrl ? (
          <a href={safeImageUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={18} /> Open original
          </a>
        ) : null}
        <button type="button" onClick={onClose} aria-label="Close image viewer">
          <X size={18} />
        </button>
      </div>
      <button className="image-viewer-stage" onClick={onClose} type="button">
        {safeImageUrl ? (
          <img
            src={safeImageUrl}
            alt={title}
            onClick={(event) => event.stopPropagation()}
            style={{ transform: `scale(${scale})` }}
          />
        ) : (
          <span>Image unavailable.</span>
        )}
      </button>
    </Modal>
  );
}

function toSafeImageUrl(value: string) {
  try {
    const parsedUrl = new URL(value, window.location.origin);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
      ? parsedUrl.href
      : null;
  } catch {
    return null;
  }
}
