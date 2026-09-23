"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

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
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!isOpen) return;

    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return;
    const menuElement = menu;
    const triggerElement = trigger;

    function positionMenu() {
      const rect = triggerElement.getBoundingClientRect();
      const viewportPadding = 8;
      const gap = 6;
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const opensUpward = spaceBelow < 208 && spaceAbove > spaceBelow;
      const availableSpace = opensUpward ? spaceAbove : spaceBelow;
      const width = Math.min(
        Math.max(rect.width, 168),
        window.innerWidth - viewportPadding * 2,
      );
      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        window.innerWidth - width - viewportPadding,
      );

      setMenuStyle({
        left,
        width,
        maxHeight: Math.min(304, Math.max(120, availableSpace - gap)),
        ...(opensUpward
          ? { bottom: window.innerHeight - rect.top + gap, top: "auto" }
          : { bottom: "auto", top: rect.bottom + gap }),
      });
    }

    function closeWhenClickingAway(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerElement.contains(target) && !menuElement.contains(target)) {
        setIsOpen(false);
      }
    }

    positionMenu();
    if (
      typeof menuElement.showPopover === "function" &&
      !menuElement.matches(":popover-open")
    ) {
      menuElement.showPopover();
    }
    document.addEventListener("pointerdown", closeWhenClickingAway);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);

    return () => {
      document.removeEventListener("pointerdown", closeWhenClickingAway);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      if (
        typeof menuElement.hidePopover === "function" &&
        menuElement.matches(":popover-open")
      ) {
        menuElement.hidePopover();
      }
    };
  }, [isOpen]);

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
        style={menuStyle}
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
              <Check aria-hidden="true" size={15} />
              <span>{option.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
