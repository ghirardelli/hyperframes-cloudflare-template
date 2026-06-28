import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "flex h-11 w-full rounded-full border border-stone-300 bg-white px-4 py-2 text-sm outline-none transition-colors placeholder:text-stone-400 focus-visible:border-[#0066cc] focus-visible:ring-2 focus-visible:ring-[#0066cc]/20 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
