import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { baseShadowStyles } from "@/components/ui/base-shadow.js";

export { default as Button } from "./Button.vue";

export const buttonVariants = cva(
  [
    "no-drag-region relative isolate inline-flex shrink-0 select-none items-center justify-center",
    "overflow-hidden whitespace-nowrap border text-sm font-medium leading-none",
    "backdrop-blur-[24px] backdrop-saturate-150",
    "transition-[background-color,border-color,box-shadow,color,transform] duration-150",
    "outline-none before:pointer-events-none before:absolute before:inset-px before:rounded-[inherit]",
    "before:border before:border-white/45 before:content-['']",
    "focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/30",
    "disabled:pointer-events-none disabled:text-[#bfbfbf] dark:disabled:text-[#bfbfbf]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default: [
          "border-white/80 bg-white/58 text-[#1a1a1a]",
          baseShadowStyles.glassControl,
          "hover:bg-white/70 active:bg-[#e6e6e6] data-[state=on]:bg-[#e6e6e6]",
          "dark:border-white/12 dark:bg-background dark:text-white/90 dark:before:hidden",
          "dark:hover:bg-white/12 dark:active:bg-white/9 dark:data-[state=on]:bg-white/9",
        ],
        accent: [
          "border-primary bg-primary text-primary-foreground",
          baseShadowStyles.accent,
          "hover:bg-primary/90 active:bg-primary/85",
        ],
        secondary: [
          "border-transparent bg-black/7 text-black/80",
          baseShadowStyles.secondary,
          "hover:bg-black/10 active:bg-black/13",
          "dark:bg-white/10 dark:text-white/85",
          "dark:hover:bg-white/15 dark:active:bg-white/8",
        ],
        ghost: [
          "border-transparent bg-transparent text-black/75 before:hidden",
          baseShadowStyles.none,
          "backdrop-blur-none backdrop-saturate-100",
          "hover:bg-black/7 active:bg-black/11",
          "dark:text-white/80 dark:hover:bg-white/10 dark:active:bg-white/7",
        ],
        borderless: [
          "border-transparent bg-transparent text-black/75 before:hidden",
          baseShadowStyles.none,
          "backdrop-blur-none backdrop-saturate-100",
          "hover:bg-black/10 active:bg-black/11",
          "dark:text-white/80 dark:hover:bg-white/12 dark:active:bg-white/7",
        ],
        destructive: [
          "border-[#d3261d] bg-[#ff3b30] text-white",
          baseShadowStyles.destructive,
          "hover:bg-[#ff453a] active:bg-[#eb342a]",
        ],
      },
      shape: {
        circular: "size-12 rounded-full p-1.5 [&_svg]:size-5",
        capsule: "h-8 min-w-12 gap-1.5 rounded-full px-3 [&_svg]:size-4.5",
      },
    },
    defaultVariants: {
      variant: "default",
      shape: "capsule",
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
