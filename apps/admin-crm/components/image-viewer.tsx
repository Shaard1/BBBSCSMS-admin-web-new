/* eslint-disable @next/next/no-img-element */
"use client";

import { ChevronLeft, ChevronRight, ExternalLink, Minus, Plus, RotateCcw, X } from "@/components/crm-icons";
import { Modal } from "@/components/modal";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type ImageViewerProps = {
  imageUrl: string;
  images?: string[];
  title: string;
  onClose: () => void;
  allowOriginal?: boolean;
};

export function ImageViewer({ imageUrl, images, title, onClose, allowOriginal = true }: ImageViewerProps) {
  const gallery = images?.length ? images : [imageUrl];
  const [index, setIndex] = useState(Math.max(0, gallery.indexOf(imageUrl)));
  const [scale, setScale] = useState(1);
  const [failed, setFailed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const pendingAnchor = useRef<{ x: number; y: number; imageX: number; imageY: number } | null>(null);
  const fitRatio = natural.width && natural.height ? Math.min(Math.max(1, viewport.width - 48) / natural.width, Math.max(1, viewport.height - 48) / natural.height) : 1;
  const width = natural.width * fitRatio;
  const height = natural.height * fitRatio;
  const drag = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);
  const safeImageUrl = toSafeImageUrl(gallery[index] ?? imageUrl);
  const zoomTo = useCallback((value: number, point?: { x: number; y: number }) => {
    const stage = stageRef.current;
    const oldScale = scaleRef.current;
    const next = Math.min(3, Math.max(0.5, value));
    if (!stage || !width || !height || next === oldScale) return;
    const x = point?.x ?? stage.clientWidth / 2;
    const y = point?.y ?? stage.clientHeight / 2;
    pendingAnchor.current = {
      x, y,
      imageX: (stage.scrollLeft + x - Math.max(0, (stage.clientWidth - width * oldScale) / 2)) / (width * oldScale),
      imageY: (stage.scrollTop + y - Math.max(0, (stage.clientHeight - height * oldScale) / 2)) / (height * oldScale),
    };
    scaleRef.current = next;
    setScale(next);
  }, [width, height]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => setViewport({ width: stage.clientWidth, height: stage.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [index]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const anchor = pendingAnchor.current;
    if (!stage) return;
    stage.scrollLeft = anchor ? Math.max(0, (stage.clientWidth - width * scale) / 2) + anchor.imageX * width * scale - anchor.x : Math.max(0, (width * scale - stage.clientWidth) / 2);
    stage.scrollTop = anchor ? Math.max(0, (stage.clientHeight - height * scale) / 2) + anchor.imageY * height * scale - anchor.y : Math.max(0, (height * scale - stage.clientHeight) / 2);
    pendingAnchor.current = null;
  }, [scale, width, height, index]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    function wheel(event: WheelEvent) {
      event.preventDefault();
      const bounds = stage!.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage!.clientHeight : 1;
      const delta = Math.max(-100, Math.min(100, event.deltaY * unit));
      zoomTo(scaleRef.current * Math.exp(-delta * 0.002), { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    }
    stage.addEventListener("wheel", wheel, { passive: false });
    return () => stage.removeEventListener("wheel", wheel);
  }, [zoomTo, index]);

  function resetZoom() {
    pendingAnchor.current = null;
    scaleRef.current = 1;
    setScale(1);
    const stage = stageRef.current;
    if (stage) { stage.scrollLeft = 0; stage.scrollTop = 0; }
  }
  function changeImage(step: number) {
    setIndex(current => (current + step + gallery.length) % gallery.length);
    setScale(1);
    scaleRef.current = 1;
    pendingAnchor.current = null;
    setNatural({ width: 0, height: 0 });
    setFailed(false);
    drag.current = null;
    setIsDragging(false);
  }

  return (
    <Modal title={title} onClose={onClose} className="image-viewer-backdrop">
      <div onKeyDown={event => {
        if (gallery.length < 2 || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          changeImage(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}>
      <div className="image-viewer-toolbar">
        <div className="image-viewer-identity">
        <div className="image-viewer-title">
          <strong>{title}</strong>
          {gallery.length > 1 ? <small className="image-viewer-counter" role="status">Image {index + 1} of {gallery.length}</small> : null}
        </div>
        {safeImageUrl && allowOriginal ? (
          <a className="image-viewer-original" href={safeImageUrl} target="_blank" rel="noreferrer" aria-label="Open original image in a new tab">
            <ExternalLink size={18} /> Open original
          </a>
        ) : null}
        </div>
        <div className="image-viewer-adjustments" role="group" aria-label="Image adjustments">
        <div className="image-viewer-zoom" role="group" aria-label="Image zoom controls">
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={scale <= 0.5}
          onClick={() => zoomTo(scaleRef.current - 0.25)}
        >
          <Minus size={18} />
        </button>
        <output aria-live="polite" aria-label="Zoom level">{Math.round(scale * 100)}%</output>
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          disabled={scale >= 3}
          onClick={() => zoomTo(scaleRef.current + 0.25)}
        >
          <Plus size={18} />
        </button>
        </div>
        <button type="button" onClick={resetZoom}>
          <RotateCcw size={18} /> Reset
        </button>
        </div>
        <button className="image-viewer-close" type="button" onClick={onClose} aria-label="Close image viewer" title="Close image viewer">
          <X size={18} />
        </button>
      </div>
      <div className="image-viewer-body">
      {gallery.length > 1 ? <button className="image-viewer-nav previous" type="button" aria-label="Previous image" onClick={() => changeImage(-1)}><ChevronLeft size={24} /></button> : null}
      <div ref={stageRef} className="image-viewer-stage" role="region" aria-label="Image preview" tabIndex={0} key={index}
        style={{ cursor: scale > 1 ? isDragging ? "grabbing" : "grab" : "default", touchAction: scale > 1 ? "none" : "auto", userSelect: "none" }}
        onPointerDown={event => {
          if (scale <= 1 || event.button !== 0) return;
          const stage = event.currentTarget;
          event.preventDefault();
          stage.focus({ preventScroll: true });
          stage.setPointerCapture(event.pointerId);
          drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
          setIsDragging(true);
        }}
        onPointerMove={event => {
          const start = drag.current;
          if (!start || start.pointerId !== event.pointerId) return;
          event.currentTarget.scrollLeft = start.left + start.x - event.clientX;
          event.currentTarget.scrollTop = start.top + start.y - event.clientY;
        }}
        onPointerUp={event => {
          if (drag.current?.pointerId !== event.pointerId) return;
          drag.current = null;
          setIsDragging(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onLostPointerCapture={() => { drag.current = null; setIsDragging(false); }}
        onPointerCancel={() => { drag.current = null; setIsDragging(false); }}
      >
        {safeImageUrl && !failed ? (
          <div className="image-viewer-canvas" style={{ width: Math.max(viewport.width, width * scale), height: Math.max(viewport.height, height * scale) }}>
          <img
            src={safeImageUrl}
            draggable={false}
            alt={gallery.length > 1 ? `${title} — image ${index + 1} of ${gallery.length}` : title}
            onError={() => setFailed(true)}
            onLoad={event => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            style={{ width: width || undefined, height: height || undefined, transform: `scale(${scale})` }}
          />
          </div>
        ) : (
          <span role="alert">Image unavailable. Close this preview and open the evidence again to retry.</span>
        )}
      </div>
      {gallery.length > 1 ? <button className="image-viewer-nav next" type="button" aria-label="Next image" onClick={() => changeImage(1)}><ChevronRight size={24} /></button> : null}
      </div>
      </div>
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
