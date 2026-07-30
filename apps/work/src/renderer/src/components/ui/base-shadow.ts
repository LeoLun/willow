export const baseShadowStyles = {
  glass: "shadow-[var(--glass-surface-shadow)]",
  glassControl: ["shadow-[var(--glass-surface-shadow)]", "dark:shadow-[0_1px_2px_rgb(0_0_0/0.28)]"],
  glassSidebar: "[&>[data-sidebar=sidebar]]:shadow-[var(--glass-surface-shadow)]",
  pressed: "data-[state=on]:shadow-[inset_0_1px_2px_rgb(0_0_0/0.06),0_8px_20px_rgb(0_0_0/0.1)]",
  accent: "shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(0_64_150/0.28)]",
  secondary: [
    "shadow-[inset_0_1px_0_rgb(255_255_255/0.45)]",
    "dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]",
  ],
  destructive: "shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(150_20_10/0.25)]",
  none: "shadow-none",
} as const;
