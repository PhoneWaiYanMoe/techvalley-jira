"use client";

import { InputHTMLAttributes, useState } from "react";

export function Input({
  label,
  error,
  id,
  className = "",
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const isPassword = type === "password";
  const [show, setShow] = useState(false);

  const input = (
    <input
      id={id}
      type={isPassword && show ? "text" : type}
      className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-400 dark:bg-neutral-900 ${
        isPassword ? "pr-10" : ""
      } ${error ? "border-red-500" : "border-neutral-300 dark:border-neutral-700"} ${className}`}
      {...props}
    />
  );

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {isPassword ? (
        <div className="relative">
          {input}
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            {show ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
                <path d="M1 1l22 22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      ) : (
        input
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
