import { useId } from "react";

/**
 * Evident mark: an "E" whose middle stroke is a highlighted line pointing to a dot,
 * the evidence link that runs through the product. Source: client/public/brand/evident-mark.svg
 */
export function LogoMark({ size = 32, className = "", title }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role={title ? "img" : undefined}
      aria-label={title} aria-hidden={title ? undefined : true} focusable="false" style={{ flex: "none", display: "block" }}>
      <defs>
        <linearGradient id={`evg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14897C" />
          <stop offset="1" stopColor="#0A5A52" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#evg-${id})`} />
      <rect x="17" y="28.5" width="21" height="7" rx="3.5" fill="#FFE58A" />
      <circle cx="45" cy="32" r="3.5" fill="#FFE58A" />
      <rect x="17" y="16" width="7" height="32" rx="3.5" fill="#FFFFFF" />
      <rect x="17" y="16" width="30" height="7" rx="3.5" fill="#FFFFFF" />
      <rect x="17" y="41" width="30" height="7" rx="3.5" fill="#FFFFFF" />
    </svg>
  );
}

/** Mark + wordmark. `tone="light"` for dark backgrounds. */
export default function Logo({ size = 32, tone = "dark", showText = true, textClassName = "" }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.32) }}>
      <LogoMark size={size} />
      {showText && (
        <span className={textClassName} style={{ fontWeight: 700, fontSize: Math.round(size * 0.56), letterSpacing: "-0.02em",
          color: tone === "light" ? "#fff" : "#111317", lineHeight: 1 }}>Evident</span>
      )}
    </span>
  );
}
