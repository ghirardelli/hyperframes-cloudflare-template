import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Film } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldError, formSubmitHandler } from "@/lib/form-utils";
import { loginFormSchema } from "@/lib/form-schemas";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [status, setStatus] = useState("");
  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: loginFormSchema,
    },
    onSubmit: async ({ value }) => {
      const credentials = loginFormSchema.parse(value);
      setStatus("");
      try {
        const response = await fetch("/api/auth/sign-in/email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(credentials),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
          const message = data.message || data.error || "Unable to sign in.";
          if (message.toLowerCase().includes("invalid email or password")) {
            throw new Error(
              "Invalid email or password. If this user was created in Better Auth Dash, make sure a password is set for the account.",
            );
          }
          throw new Error(message);
        }

        const profile = await fetch("/api/me", { headers: { accept: "application/json" } });
        if (!profile.ok) {
          const data = (await profile.json().catch(() => ({}))) as { message?: string; error?: string };
          throw new Error(
            data.message ||
              data.error ||
              "Sign-in succeeded, but this account is not assigned to a Motion Frames organization. Ask an admin to invite the user from the Motion Frames admin page.",
          );
        }
        window.location.assign("/");
      } catch (err) {
        setStatus(messageFromError(err));
      }
    },
  });

  return (
    <main className="min-h-dvh bg-white text-foreground">
      <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(420px,0.9fr)_minmax(0,1.35fr)]">
        <section className="flex items-center px-6 py-10 sm:px-10 lg:px-16">
          <div className="mx-auto w-full max-w-[520px]">
            <a className="mb-16 inline-flex items-center gap-2 text-sm text-body" href="/">
              <Film className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Motion Frames
            </a>

            <h1 className="text-[40px] font-semibold leading-[1.08] text-foreground sm:text-[52px]">
              Welcome to MotionFrame.
            </h1>
            <p className="mt-4 text-[21px] leading-[1.35] text-muted-foreground">
              Create a promo video, presentation deck, and more...
            </p>

            <form className="mt-10 space-y-5" onSubmit={formSubmitHandler(() => form.handleSubmit())}>
              <form.Field name="email">
                {(field) => {
                  const error = fieldError(field.state.meta);
                  return (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Email</Label>
                      <Input
                        id={field.name}
                        type="email"
                        autoComplete="email"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="name@company.com"
                        required
                        aria-invalid={Boolean(error)}
                      />
                      {error ? <p className="text-sm text-destructive">{error}</p> : null}
                    </div>
                  );
                }}
              </form.Field>
              <form.Field name="password">
                {(field) => {
                  const error = fieldError(field.state.meta);
                  return (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Password</Label>
                      <Input
                        id={field.name}
                        type="password"
                        autoComplete="current-password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="Password"
                        required
                        aria-invalid={Boolean(error)}
                      />
                      {error ? <p className="text-sm text-destructive">{error}</p> : null}
                    </div>
                  );
                }}
              </form.Field>

              {status ? (
                <p className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                  {status}
                </p>
              ) : null}

              <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
                {([canSubmit, isSubmitting]) => (
                  <Button type="submit" size="lg" className="h-12 w-full text-[17px]" disabled={!canSubmit || isSubmitting}>
                    {isSubmitting ? "Signing in..." : "Continue with email"}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </form.Subscribe>
            </form>
          </div>
        </section>

        <section className="hidden min-h-dvh items-center overflow-hidden bg-background p-8 lg:flex">
          <WorkspacePreview />
        </section>
      </div>
    </main>
  );
}

function WorkspacePreview() {
  const cards = [
    ["Promo cut", "12s", "bg-background"],
    ["Launch deck", "8 slides", "bg-[#dce8f7]"],
    ["Founder reel", "24s", "bg-[#e9e2d2]"],
  ];

  return (
    <div className="relative mx-auto aspect-[1.38] w-full max-w-[980px] rounded-[32px] bg-[#0b0b0d] p-7 text-white shadow-[rgba(0,0,0,0.22)_3px_5px_30px_0]">
      <div className="absolute -right-20 -top-16 h-64 w-64 rounded-full border border-white/10" />
      <div className="grid h-full grid-cols-[180px_minmax(0,1fr)] gap-6">
        <aside className="rounded-[22px] border border-white/10 bg-white/[0.06] p-4">
          <div className="mb-8 flex items-center gap-2 text-sm">
            <span className="h-7 w-7 rounded-full bg-white" />
            Acme Studio
          </div>
          {["Home", "Projects", "Published", "Renders"].map((item, index) => (
            <div
              key={item}
              className={`mb-2 rounded-full px-3 py-2 text-sm ${
                index === 0 ? "bg-white text-foreground" : "text-white/70"
              }`}
            >
              {item}
            </div>
          ))}
        </aside>
        <div className="flex flex-col">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <p className="text-sm text-white/50">Motion workspace</p>
              <h2 className="mt-2 text-[40px] font-semibold leading-none">
                Create the next frame.
              </h2>
            </div>
            <span className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/70">
              Private
            </span>
          </div>

          <div className="grid flex-1 grid-cols-3 gap-5">
            {cards.map(([title, meta, className]) => (
              <div key={title} className={`flex flex-col justify-between rounded-[24px] p-5 text-foreground ${className}`}>
                <div>
                  <p className="text-sm text-muted-foreground">{meta}</p>
                  <h3 className="mt-2 text-2xl font-semibold leading-tight">{title}</h3>
                </div>
                <div className="h-24 rounded-[18px] bg-white/70" />
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-full border border-white/10 bg-white/[0.06] px-5 py-4 text-sm text-white/45">
            Ask MotionFrame to create anything...
          </div>
        </div>
      </div>
    </div>
  );
}

function messageFromError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
