"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "@/components/crm-icons";

export function PasswordField({ label, value, onChange, disabled }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <div className="settings-password-field">
    <label htmlFor={id}>{label}</label>
    <div className="settings-input-group">
      <input id={id} type={visible ? "text" : "password"} autoComplete="new-password"
        minLength={8} maxLength={128} required value={value} disabled={disabled}
        onChange={event => onChange(event.target.value)} />
      <button type="button" disabled={disabled} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
        aria-controls={id} aria-pressed={visible} onClick={() => setVisible(value => !value)}>
        {visible ? <EyeOff size={18}/> : <Eye size={18}/>}
      </button>
    </div>
  </div>;
}
