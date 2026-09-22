"use client";
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
  return (
    <select
      aria-label={ariaLabel}
      className={`ui-native-select ${className}`}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
