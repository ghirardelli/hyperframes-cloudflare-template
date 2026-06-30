import { useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { Lock, Unlock, UserPlus } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { messageFromError } from "@/lib/api-client";
import { adminCreateUserFormSchema, type AdminCreateUserFormValues } from "@/lib/form-schemas";
import { fieldError, formSubmitHandler } from "@/lib/form-utils";
import {
  useAdminOrganizationsQuery,
  useAdminUsersQuery,
  useCreateAdminUserMutation,
  useMeQuery,
  useSetUserLockedMutation,
  type AdminUser,
} from "@/lib/app-queries";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const meQuery = useMeQuery();
  const canAdmin = !!meQuery.data?.user.role
    ?.split(",")
    .map((role) => role.trim())
    .includes("admin");
  const organizationsQuery = useAdminOrganizationsQuery(canAdmin);
  const usersQuery = useAdminUsersQuery(canAdmin);
  const createUserMutation = useCreateAdminUserMutation();
  const setUserLockedMutation = useSetUserLockedMutation();
  const organizations = organizationsQuery.data?.organizations ?? [];
  const users = usersQuery.data?.users ?? [];
  const status = statusMessage({ canAdmin, meQuery, organizationsQuery, usersQuery });
  const toast = useToast();
  const defaultCreateUserValues: AdminCreateUserFormValues = {
    name: "",
    email: "",
    password: "",
    role: "user",
    organizationMode: "existing",
    organizationId: organizations[0]?.id ?? "",
    organizationName: "",
  };
  const createUserForm = useForm({
    defaultValues: defaultCreateUserValues,
    validators: {
      onSubmit: adminCreateUserFormSchema,
    },
    onSubmit: async ({ value }) => {
      const input = adminCreateUserFormSchema.parse(value);
      try {
        await createUserMutation.mutateAsync({
          name: input.name,
          email: input.email,
          password: input.password,
          role: input.role,
          organizationId: input.organizationMode === "existing" ? input.organizationId : undefined,
          organizationName: input.organizationMode === "new" ? input.organizationName : undefined,
        });
        createUserForm.reset();
        createUserForm.setFieldValue("organizationId", organizations[0]?.id ?? "");
        toast.success("User created.");
      } catch (err) {
        toast.error(messageFromError(err));
      }
    },
  });

  useEffect(() => {
    const firstOrganizationId = organizations[0]?.id;
    if (!firstOrganizationId || createUserForm.state.values.organizationId) return;
    createUserForm.setFieldValue("organizationId", firstOrganizationId);
  }, [createUserForm, organizations]);

  async function setLocked(user: AdminUser, locked: boolean) {
    try {
      await setUserLockedMutation.mutateAsync({ userId: user.id, locked });
      toast.success(`${user.name} ${locked ? "locked" : "unlocked"}.`);
    } catch (err) {
      toast.error(messageFromError(err));
    }
  }

  if (!canAdmin) {
    return (
      <div className="flex min-h-dvh flex-col bg-background text-foreground">
        <AppHeader active="admin" />
        <main className="w-full px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-3xl">
            <p className="mt-4 text-2xl font-semibold">{status || "Checking access..."}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <AppHeader active="admin" />
      <main className="w-full space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header>
          <p className="text-sm text-muted-foreground">Admin</p>
          <h1 className="mt-2 text-4xl font-semibold">Users and organizations</h1>
        </header>

        <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Create invited user</CardTitle>
              <CardDescription>Name, email, password, and tenant assignment.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={formSubmitHandler(() => createUserForm.handleSubmit())}>
                <createUserForm.Field name="name">
                  {(field) => <FormTextField field={field} label="Name" />}
                </createUserForm.Field>
                <createUserForm.Field name="email">
                  {(field) => <FormTextField field={field} label="Email" type="email" />}
                </createUserForm.Field>
                <createUserForm.Field name="password">
                  {(field) => <FormTextField field={field} label="Password" type="password" />}
                </createUserForm.Field>
                <createUserForm.Field name="role">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Role</Label>
                      <select
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value as "user" | "admin")}
                        className="h-10 w-full rounded-md border border-hairline bg-background px-4 text-sm"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  )}
                </createUserForm.Field>
                <createUserForm.Field name="organizationMode">
                  {(field) => (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <label className="flex items-center gap-2 rounded-md border border-hairline bg-background px-4 py-3">
                        <input
                          name={field.name}
                          value="existing"
                          type="radio"
                          checked={field.state.value === "existing"}
                          onChange={() => field.handleChange("existing")}
                        />
                        Existing org
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-hairline bg-background px-4 py-3">
                        <input
                          name={field.name}
                          value="new"
                          type="radio"
                          checked={field.state.value === "new"}
                          onChange={() => field.handleChange("new")}
                        />
                        New org
                      </label>
                    </div>
                  )}
                </createUserForm.Field>
                <createUserForm.Field name="organizationId">
                  {(field) => {
                    const error = fieldError(field.state.meta);
                    return (
                      <div className="space-y-2">
                        <Label htmlFor={field.name}>Existing organization</Label>
                        <select
                          id={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          className="h-10 w-full rounded-md border border-hairline bg-background px-4 text-sm"
                          aria-invalid={Boolean(error)}
                        >
                          <option value="">Select organization</option>
                          {organizations.map((org) => (
                            <option key={org.id} value={org.id}>
                              {org.name}
                            </option>
                          ))}
                        </select>
                        {error ? <p className="text-sm text-destructive">{error}</p> : null}
                      </div>
                    );
                  }}
                </createUserForm.Field>
                <createUserForm.Field name="organizationName">
                  {(field) => <FormTextField field={field} label="New organization name" required={false} />}
                </createUserForm.Field>
                <createUserForm.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
                  {([canSubmit, isSubmitting]) => (
                    <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting || createUserMutation.isPending}>
                      <UserPlus className="h-4 w-4" aria-hidden="true" />
                      {isSubmitting ? "Creating..." : "Create user"}
                    </Button>
                  )}
                </createUserForm.Subscribe>
              </form>
            </CardContent>
          </Card>

          <section className="rounded-xl border border-hairline bg-card">
            <div className="grid grid-cols-[1fr_1fr_110px] gap-3 border-b border-hairline px-5 py-3 text-sm font-semibold text-muted-foreground">
              <span>User</span>
              <span>Organization</span>
              <span>Status</span>
            </div>
            {users.map((user) => (
              <div key={user.id} className="grid grid-cols-[1fr_1fr_110px] items-center gap-3 border-b border-hairline-soft px-5 py-4 last:border-b-0">
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <p className="text-sm text-muted-foreground">{user.organizationName || "Unassigned"}</p>
                <Button
                  type="button"
                  variant={user.banned ? "default" : "outline"}
                  size="sm"
                  onClick={() => void setLocked(user, !user.banned)}
                  disabled={setUserLockedMutation.isPending}
                >
                  {user.banned ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {user.banned ? "Unlock" : "Lock"}
                </Button>
              </div>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}

function statusMessage({
  canAdmin,
  meQuery,
  organizationsQuery,
  usersQuery,
}: {
  canAdmin: boolean;
  meQuery: ReturnType<typeof useMeQuery>;
  organizationsQuery: ReturnType<typeof useAdminOrganizationsQuery>;
  usersQuery: ReturnType<typeof useAdminUsersQuery>;
}): string {
  if (meQuery.isPending) return "Checking access...";
  if (meQuery.isError) return messageFromError(meQuery.error);
  if (!canAdmin) return "Admin access required.";
  if (organizationsQuery.isError) return messageFromError(organizationsQuery.error);
  if (usersQuery.isError) return messageFromError(usersQuery.error);
  return "";
}

function FormTextField({
  field,
  label,
  type = "text",
  required = true,
}: {
  field: {
    name: string;
    state: {
      value: string | undefined;
      meta: { errors?: ReadonlyArray<unknown> };
    };
    handleBlur: () => void;
    handleChange: (value: string) => void;
  };
  label: string;
  type?: string;
  required?: boolean;
}) {
  const error = fieldError(field.state.meta);
  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        id={field.name}
        name={field.name}
        type={type}
        required={required}
        value={field.state.value ?? ""}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={Boolean(error)}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
