"use client";

import { useState } from "react";

// Plain <img>, not next/image: profile image URLs are arbitrary user-supplied
// URLs (FR-005), so there's no fixed set of domains to allowlist via
// next.config.ts remotePatterns.
export function Avatar({
  src,
  initials,
  size = 30,
  className = "",
}: {
  src?: string | null;
  initials: string;
  size?: number;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (src && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        onError={() => setErrored(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ height: size, width: size }}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-indigo-600 font-bold text-white ${className}`}
      style={{ height: size, width: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials}
    </div>
  );
}
