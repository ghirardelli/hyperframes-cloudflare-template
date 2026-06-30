export interface FieldMetaLike {
  errors?: ReadonlyArray<unknown>;
}

export function firstFormError(errors: ReadonlyArray<unknown> | undefined): string {
  const first = errors?.[0];
  if (!first) return "";
  if (typeof first === "string") return first;
  if (first instanceof Error) return first.message;
  if (typeof first === "object" && "message" in first) {
    const message = (first as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return String(first);
}

export function fieldError(meta: FieldMetaLike): string {
  return firstFormError(meta.errors);
}

export function formSubmitHandler(handleSubmit: () => void | Promise<void>) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void handleSubmit();
  };
}
import type { FormEvent } from "react";
