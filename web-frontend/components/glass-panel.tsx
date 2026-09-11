import type { ComponentPropsWithoutRef } from "react";

interface GlassPanelProps extends ComponentPropsWithoutRef<"div"> {
  tone?: "light" | "dark";
}

export function GlassPanel({
  className = "",
  tone = "light",
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={`glass-panel glass-panel--${tone} ${className}`.trim()}
      {...props}
    />
  );
}
