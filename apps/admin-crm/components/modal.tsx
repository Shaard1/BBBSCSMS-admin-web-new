"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Native modal provides focus containment, Escape and an inert background. */
export function Modal({
  children,
  title,
  onClose,
  className = "",
  dismissible = true,
}: {
  children: ReactNode | ((close:()=>void)=>ReactNode);
  title: string;
  onClose: () => void;
  className?: string;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const closingRef=useRef(false);
  const [closing,setClosing]=useState(false);
  function requestClose(){
    if(!dismissible||closingRef.current)return;
    // Existing callers may have unsaved-change guards. Their close remains synchronous.
    if(typeof children!=='function'||window.matchMedia('(prefers-reduced-motion: reduce)').matches){onClose();return;}
    closingRef.current=true;setClosing(true);
    // Only visual dismissal waits; network mutations and navigation are never queued here.
    timer.current=setTimeout(onClose,140);
  }
  useEffect(() => {
    const dialog = ref.current;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog?.showModal();
    return () => {
      if(timer.current)clearTimeout(timer.current);
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      data-closing={closing}
      inert={closing}
      className={`workspace-dialog ${className}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      {typeof children==='function'?children(requestClose):children}
    </dialog>
  );
}
