import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

export { default as NavigationMenu } from "./NavigationMenu.vue";
export { default as NavigationMenuItem } from "./NavigationMenuItem.vue";
export { default as NavigationMenuLink } from "./NavigationMenuLink.vue";
export { default as NavigationMenuList } from "./NavigationMenuList.vue";

export const navigationMenuLinkVariants = cva([
  "group inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
  "text-muted-foreground transition-colors outline-none",
  "hover:bg-muted hover:text-foreground",
  "focus-visible:bg-muted focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:opacity-50",
  "data-[active]:bg-muted data-[active]:text-foreground",
  "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:shrink-0",
]);

export type NavigationMenuLinkVariants = VariantProps<typeof navigationMenuLinkVariants>;
