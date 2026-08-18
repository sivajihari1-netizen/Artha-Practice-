import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard clsx+tailwind-merge combiner. Added for the marketing homepage
// port (src/components/marketing/*), which imports from this exact path —
// a pure, side-effect-free utility, safe to share app-wide if anything
// else ever wants it.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
