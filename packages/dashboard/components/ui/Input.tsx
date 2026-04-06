import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | undefined;
  hint?: string | undefined;
}

export function Input({
  label,
  error,
  hint,
  id,
  className = "",
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-200">
          {label}
          {props.required && <span className="ml-1 text-red-400">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={[
          "rounded-lg border bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400",
          "transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500",
          error
            ? "border-red-500 focus:ring-red-500"
            : "border-slate-600 hover:border-slate-500",
          className,
        ].join(" ")}
        {...props}
      />
      {hint && !error && (
        <p className="text-xs text-slate-400">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
