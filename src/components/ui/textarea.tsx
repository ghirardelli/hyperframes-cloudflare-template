import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-28 w-full resize-none rounded-[18px] border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-stone-400 focus-visible:border-[#0066cc] focus-visible:ring-2 focus-visible:ring-[#0066cc]/20 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
