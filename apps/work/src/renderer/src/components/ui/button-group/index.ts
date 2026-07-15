import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { baseShadowStyles } from "@/components/ui/base-shadow.js";

export { default as ButtonGroup } from "./ButtonGroup.vue";

export const buttonGroupVariants = cva(
  [
    "no-drag-region relative isolate inline-flex w-fit items-center overflow-hidden rounded-full",
    "border border-white/80 bg-white/58 backdrop-blur-[24px] backdrop-saturate-150",
    baseShadowStyles.glass,
    "before:pointer-events-none before:absolute before:inset-px before:rounded-[inherit]",
    "before:border before:border-white/45 before:content-['']",
    "dark:border-white/24 dark:bg-white/16",
  ],
  {
    variants: {
      shape: {
        circular: "h-12 gap-1.5 p-1.5",
        capsule: "h-8 gap-1.5 p-[3px]",
      },
    },
    defaultVariants: {
      shape: "capsule",
    },
  },
);

export type ButtonGroupVariants = VariantProps<typeof buttonGroupVariants>;
