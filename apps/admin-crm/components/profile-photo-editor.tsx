"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/modal";
import { X } from "@/components/crm-icons";

const frame = 280;
type Position = { x: number; y: number };

export function ProfilePhotoEditor({ file, onCancel, onApply }: {
  file: File;
  onCancel: () => void;
  onApply: (file: File) => Promise<boolean>;
}) {
  const [url, setUrl] = useState("");
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const imageRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; start: Position } | null>(null);
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  const base = natural.width ? Math.max(frame / natural.width, frame / natural.height) : 1;
  const scale = base * zoom;
  function constrain(next: Position, nextZoom = zoom) {
    const limitX = Math.max(0, (natural.width * base * nextZoom - frame) / 2);
    const limitY = Math.max(0, (natural.height * base * nextZoom - frame) / 2);
    return { x: Math.max(-limitX, Math.min(limitX, next.x)), y: Math.max(-limitY, Math.min(limitY, next.y)) };
  }
  async function apply() {
    if (!imageRef.current || !natural.width || busy) return;
    setBusy(true); setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 512;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image editing is unavailable in this browser.");
      const ratio = 512 / frame;
      context.drawImage(imageRef.current,
        (frame / 2 + position.x - natural.width * scale / 2) * ratio,
        (frame / 2 + position.y - natural.height * scale / 2) * ratio,
        natural.width * scale * ratio, natural.height * scale * ratio);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Unable to prepare your photo.")), "image/png"));
      if (await onApply(new File([blob], "profile-photo.png", { type: "image/png" }))) onCancel();
      else setError("Your photo could not be saved. Please try again.");
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to prepare your photo."); }
    finally { setBusy(false); }
  }
  return <Modal title="Adjust profile photo" onClose={onCancel} dismissible={!busy} className="photo-editor">
    <header><h2>Adjust profile photo</h2><button type="button" aria-label="Close photo editor" disabled={busy} onClick={onCancel}><X size={18}/></button></header>
    <div className="photo-editor-body">
      <p>Drag to position your photo. The circle shows your avatar.</p>
      <div className="photo-crop-stage" role="group" aria-label="Photo position" tabIndex={0}
        onKeyDown={event => {
          const moves: Record<string, Position> = { ArrowLeft: {x:-8,y:0}, ArrowRight:{x:8,y:0}, ArrowUp:{x:0,y:-8}, ArrowDown:{x:0,y:8} };
          const move = moves[event.key];
          if (move && !busy) { event.preventDefault(); setPosition(value => constrain({x:value.x+move.x,y:value.y+move.y})); }
        }}
        onPointerDown={event => {
          if (busy || !natural.width || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {id:event.pointerId,x:event.clientX,y:event.clientY,start:position};
        }}
        onPointerMove={event => {
          const current = drag.current;
          if (!current || current.id !== event.pointerId) return;
          const ratio = frame / event.currentTarget.getBoundingClientRect().width;
          setPosition(constrain({ x:current.start.x+(event.clientX-current.x)*ratio, y:current.start.y+(event.clientY-current.y)*ratio }));
        }}
        onPointerUp={() => {drag.current=null;}} onPointerCancel={() => {drag.current=null;}} onLostPointerCapture={() => {drag.current=null;}}>
        {url ? <Image ref={imageRef} unoptimized src={url} alt="Photo to crop" draggable={false} width={natural.width || frame} height={natural.height || frame}
          style={{width:`${natural.width*scale/frame*100}%`,height:`${natural.height*scale/frame*100}%`,left:`${50+position.x/frame*100}%`,top:`${50+position.y/frame*100}%`}}
          onLoad={event=>setNatural({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})}
          onError={()=>setError("This image could not be opened. Choose another photo.")}/> : null}
        <span className="photo-crop-mask" aria-hidden="true"/>
      </div>
      <label className="photo-editor-zoom">Zoom<input aria-label="Photo zoom" type="range" min="1" max="3" step="0.01" value={zoom} disabled={busy || !natural.width} onChange={event=>{const value=Number(event.target.value);setZoom(value);setPosition(position=>constrain(position,value));}}/><output>{Math.round(zoom*100)}%</output></label>
      <small>Use arrow keys to move the photo when the preview is focused.</small>
      {error ? <p role="alert">{error}</p> : null}
    </div>
    <footer><button type="button" disabled={busy} onClick={()=>{setZoom(1);setPosition({x:0,y:0});}}>Reset</button><span/><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button className="primary-admin-button" type="button" disabled={busy || !natural.width} onClick={()=>void apply()}>{busy?"Saving…":"Apply"}</button></footer>
  </Modal>;
}
