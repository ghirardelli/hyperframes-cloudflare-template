import { useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { messageFromError } from "@/lib/api-client";
import {
  useChangePasswordMutation,
  useProfileQuery,
  useUpdateProfileMutation,
} from "@/lib/app-queries";
import { passwordFormSchema, profileFormSchema } from "@/lib/form-schemas";
import { fieldError, formSubmitHandler } from "@/lib/form-utils";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { data: profile } = useProfileQuery();
  const updateProfileMutation = useUpdateProfileMutation();
  const changePasswordMutation = useChangePasswordMutation();
  const toast = useToast();
  const profileForm = useForm({
    defaultValues: {
      name: profile?.user.name ?? "",
    },
    validators: {
      onSubmit: profileFormSchema,
    },
    onSubmit: async ({ value }) => {
      const input = profileFormSchema.parse(value);
      try {
        await updateProfileMutation.mutateAsync(input.name);
        profileForm.reset(input);
        toast.success("Profile updated.");
      } catch (err) {
        toast.error(messageFromError(err));
      }
    },
  });
  const passwordForm = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
    },
    validators: {
      onSubmit: passwordFormSchema,
    },
    onSubmit: async ({ value }) => {
      const input = passwordFormSchema.parse(value);
      try {
        await changePasswordMutation.mutateAsync(input);
        passwordForm.reset();
        toast.success("Password changed.");
      } catch (err) {
        toast.error(messageFromError(err));
      }
    },
  });

  useEffect(() => {
    const name = profile?.user.name ?? "";
    if (!name || profileForm.state.isDirty) return;
    profileForm.reset({ name });
  }, [profile?.user.name, profileForm]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <AppHeader active="profile" />
      <main className="w-full px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl space-y-8">
          <header>
            <p className="text-sm text-muted-foreground">Profile</p>
            <h1 className="mt-2 text-4xl font-semibold">Account settings</h1>
          </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your organization is assigned by an admin.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={formSubmitHandler(() => profileForm.handleSubmit())}>
                <profileForm.Field name="name">
                  {(field) => (
                    <FormTextField
                      field={field}
                      label="Name"
                      disabled={updateProfileMutation.isPending}
                    />
                  )}
                </profileForm.Field>
                <ReadOnly label="Email" value={profile?.user.email ?? ""} />
                <ReadOnly label="Organization" value={profile?.organization.name ?? ""} />
                <profileForm.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting, state.isDirty] as const}>
                  {([canSubmit, isSubmitting, isDirty]) => (
                    <Button type="submit" disabled={!canSubmit || !isDirty || isSubmitting || updateProfileMutation.isPending}>
                      {isSubmitting ? "Saving..." : "Save profile"}
                    </Button>
                  )}
                </profileForm.Subscribe>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>Change your password without changing organization assignment.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={formSubmitHandler(() => passwordForm.handleSubmit())}>
                <passwordForm.Field name="currentPassword">
                  {(field) => (
                    <FormTextField
                      field={field}
                      label="Current password"
                      type="password"
                      disabled={changePasswordMutation.isPending}
                    />
                  )}
                </passwordForm.Field>
                <passwordForm.Field name="newPassword">
                  {(field) => (
                    <FormTextField
                      field={field}
                      label="New password"
                      type="password"
                      disabled={changePasswordMutation.isPending}
                    />
                  )}
                </passwordForm.Field>
                <passwordForm.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
                  {([canSubmit, isSubmitting]) => (
                    <Button type="submit" disabled={!canSubmit || isSubmitting || changePasswordMutation.isPending}>
                      {isSubmitting ? "Changing..." : "Change password"}
                    </Button>
                  )}
                </passwordForm.Subscribe>
              </form>
            </CardContent>
          </Card>
        </div>
        </div>
      </main>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="rounded-md border border-hairline bg-surface-card px-4 py-3 text-sm text-muted-foreground">
        {value || "Loading..."}
      </div>
    </div>
  );
}

function FormTextField({
  field,
  label,
  type = "text",
  disabled = false,
}: {
  field: {
    name: string;
    state: {
      value: string;
      meta: { errors?: ReadonlyArray<unknown> };
    };
    handleBlur: () => void;
    handleChange: (value: string) => void;
  };
  label: string;
  type?: string;
  disabled?: boolean;
}) {
  const error = fieldError(field.state.meta);
  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        id={field.name}
        name={field.name}
        type={type}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        required
        disabled={disabled}
        aria-invalid={Boolean(error)}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
