import type * as React from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "hyperframes-player": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          srcdoc?: string;
          width?: string | number;
          height?: string | number;
          controls?: boolean;
          class?: string;
        },
        HTMLElement
      >;
    }
  }
}
