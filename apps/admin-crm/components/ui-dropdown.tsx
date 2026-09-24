"use client";

import { ChevronDown } from "lucide-react";
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useViewportPopover } from "@/components/use-viewport-popover";

type UiDropdownProps = {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
};

export function UiDropdown({
  ariaLabel,
  className = "",
  disabled = false,
  options,
  value,
  onChange,
}: UiDropdownProps) {
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selectedOption = options[selectedIndex];

  useViewportPopover({
    anchorRef: triggerRef,
    panelRef: menuRef,
    isOpen,
    setIsOpen,
    minWidth: 184,
    maxHeight: 320,
  });

  useEffect(() => {
    if (!isOpen) return;
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return;
    const menuElement = menu;
    const triggerElement = trigger;

    function closeWhenClickingAway(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerElement.contains(target) && !menuElement.contains(target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeWhenClickingAway);
    return () => {
      document.removeEventListener("pointerdown", closeWhenClickingAway);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const menu = menuRef.current;
    const option = menu?.children[activeIndex] as HTMLElement | undefined;
    if (!menu || !option) return;
    const menuRect = menu.getBoundingClientRect();
    const optionRect = option.getBoundingClientRect();
    if (optionRect.top < menuRect.top) menu.scrollTop -= menuRect.top - optionRect.top;
    if (optionRect.bottom > menuRect.bottom) menu.scrollTop += optionRect.bottom - menuRect.bottom;
  }, [activeIndex, isOpen]);

  useEffect(() => {
    if (disabled) setIsOpen(false);
  }, [disabled]);

  function openMenu() {
    if (disabled || options.length === 0) return;
    setActiveIndex(selectedIndex);
    setIsOpen(true);
  }

  function chooseOption(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setActiveIndex(index);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled || options.length === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        openMenu();
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex(
        (current) => (current + step + options.length) % options.length,
      );
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (!isOpen) setIsOpen(true);
      setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (isOpen) chooseOption(activeIndex);
      else openMenu();
      return;
    }

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      return;
    }

    if (event.key === "Tab") setIsOpen(false);
  }

  return (
    <div className={`ui-dropdown ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        className="ui-dropdown-trigger"
        aria-label={ariaLabel}
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-activedescendant={
          isOpen ? `${listboxId}-option-${activeIndex}` : undefined
        }
        data-value={value}
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
      >
        <span>{selectedOption?.label ?? "Select"}</span>
        <ChevronDown aria-hidden="true" size={16} />
      </button>
      <div
        ref={menuRef}
        id={listboxId}
        role="listbox"
        className="ui-dropdown-menu"
        aria-label={ariaLabel}
        data-open={isOpen ? "" : undefined}
        popover="manual"
      >
        {options.map((option, index) => {
          const isSelected = option.value === value;
          return (
            <div
              id={`${listboxId}-option-${index}`}
              key={option.value}
              role="option"
              aria-selected={isSelected}
              className="ui-dropdown-option"
              data-active={activeIndex === index ? "" : undefined}
              onPointerDown={(event) => event.preventDefault()}
              onPointerEnter={() => setActiveIndex(index)}
              onClick={() => chooseOption(index)}
            >
              <span>{option.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
