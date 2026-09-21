"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type DropdownOption = {
  label: string;
  value: string;
};

type UiDropdownProps = {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
};

export function UiDropdown({
  ariaLabel,
  className = "",
  disabled = false,
  options,
  value,
  onChange
}: UiDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRenderMenu, setShouldRenderMenu] = useState(false);
  const dropdownId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      if (closeTimerRef.current != null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function openMenu() {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
    }

    setShouldRenderMenu(true);
    setIsClosing(false);
    setIsOpen(true);
  }

  function closeMenu() {
    setIsOpen(false);
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setShouldRenderMenu(false);
      setIsClosing(false);
    }, 150);
  }

  function handleSelect(nextValue: string) {
    if (disabled) return;

    onChange(nextValue);
    closeMenu();
  }

  return (
    <div
      className={`ui-dropdown ${isOpen ? "open" : ""} ${isClosing ? "closing" : ""} ${className}`.trim()}
      ref={rootRef}
    >
      <button
        aria-controls={`${dropdownId}-menu`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="ui-dropdown-trigger"
        disabled={disabled}
        onClick={() => {
          if (isOpen) {
            closeMenu();
            return;
          }

          openMenu();
        }}
        type="button"
      >
        <span>{selectedOption?.label ?? "Select"}</span>
        <ChevronDown size={18} />
      </button>
      {shouldRenderMenu ? (
        <div className="ui-dropdown-menu" id={`${dropdownId}-menu`} role="listbox">
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className={option.value === value ? "selected" : ""}
              key={option.value}
              onClick={() => handleSelect(option.value)}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
