"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  placeholder: string;
  disabled?: boolean;
  saving?: boolean;
  onSave: (next: string) => void | Promise<void>;
  className?: string;
};

export function BeneficiaryFieldCell({
  value,
  placeholder,
  disabled,
  saving,
  onSave,
  className,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed === value.trim()) return;
    await onSave(trimmed);
  }

  if (disabled) {
    return (
      <span className={className}>
        {value.trim() || "—"}
      </span>
    );
  }

  if (!editing) {
    const display = value.trim();
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`text-left w-full rounded px-1 -mx-1 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-dashed hover:border-gray-300 dark:hover:border-gray-600 transition-colors ${className ?? ""}`}
        title={placeholder}
      >
        {display ? (
          display
        ) : (
          <span className="text-gray-400 italic font-normal">{placeholder}</span>
        )}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") void commit();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      disabled={saving}
      placeholder={placeholder}
      className={`w-full min-w-[120px] rounded border border-blue-400 dark:border-blue-600 bg-white dark:bg-gray-900 px-1.5 py-0.5 text-sm ${className ?? ""}`}
    />
  );
}
