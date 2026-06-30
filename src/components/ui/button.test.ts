import { describe, expect, it } from "vitest";

import { buttonVariants } from "./button";

describe("buttonVariants", () => {
  it("keeps primary buttons readable on dark backgrounds", () => {
    expect(buttonVariants({ variant: "default" })).toContain("!text-primary-foreground");
  });
});
