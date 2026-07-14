import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { glassSurfaceShadow } from "@/components/ui/glass-surface";

export { default as Button } from "./Button.vue";

export const buttonVariants = cva(
  [
    "no-drag-region relative isolate inline-flex shrink-0 select-none items-center justify-center",
    "overflow-hidden whitespace-nowrap border text-[13px] font-medium leading-none",
    "backdrop-blur-[24px] backdrop-saturate-150",
    "transition-[background-color,border-color,box-shadow,color,transform] duration-150",
    "outline-none before:pointer-events-none before:absolute before:inset-px before:rounded-[inherit]",
    "before:border before:border-white/45 before:content-['']",
    "focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-[#007aff]/30",
    "disabled:pointer-events-none disabled:text-black/25 dark:disabled:text-white/25",
    "active:not-disabled:scale-[0.97] data-[state=on]:scale-[0.98]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default: [
          "border-white/80 bg-white/58 text-black/90",
          glassSurfaceShadow,
          "hover:bg-white/70 active:bg-white/48 data-[state=on]:border-white/55",
          "data-[state=on]:bg-black/9 data-[state=on]:shadow-[inset_0_1px_2px_rgb(0_0_0/0.06),0_8px_20px_rgb(0_0_0/0.1)]",
          "dark:border-white/24 dark:bg-white/16 dark:text-white/90",
          "dark:hover:bg-white/22 dark:active:bg-white/12 dark:data-[state=on]:bg-white/9",
        ],
        accent: [
          "border-[#0068d8] bg-[#007aff] text-white",
          "shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(0_64_150/0.28)]",
          "hover:bg-[#087ff5] active:bg-[#006ee6]",
          "dark:border-[#1687ff] dark:bg-[#0a84ff] dark:hover:bg-[#2190ff] dark:active:bg-[#0077ed]",
        ],
        secondary: [
          "border-transparent bg-black/7 text-black/80 shadow-[inset_0_1px_0_rgb(255_255_255/0.45)]",
          "hover:bg-black/10 active:bg-black/13",
          "dark:bg-white/10 dark:text-white/85 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]",
          "dark:hover:bg-white/15 dark:active:bg-white/8",
        ],
        ghost: [
          "border-transparent bg-transparent text-black/75 shadow-none before:hidden",
          "backdrop-blur-none backdrop-saturate-100",
          "hover:bg-black/7 active:bg-black/11",
          "dark:text-white/80 dark:hover:bg-white/10 dark:active:bg-white/7",
        ],
        borderless: [
          "border-transparent bg-transparent text-black/75 shadow-none before:hidden",
          "backdrop-blur-none backdrop-saturate-100",
          "hover:bg-black/7 active:bg-black/11",
          "dark:text-white/80 dark:hover:bg-white/10 dark:active:bg-white/7",
        ],
        destructive: [
          "border-[#d3261d] bg-[#ff3b30] text-white",
          "shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(150_20_10/0.25)]",
          "hover:bg-[#ff453a] active:bg-[#eb342a]",
        ],
      },
      shape: {
        circular: "size-12 rounded-full p-0 [&_svg]:size-6",
        capsule: "h-9 min-w-14 gap-1.5 rounded-full px-4 [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      shape: "capsule",
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
