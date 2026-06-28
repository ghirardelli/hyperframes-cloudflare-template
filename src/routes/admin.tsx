import { FormEvent, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Lock, Unlock, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

interface Organization {
  id: string;
  name: string;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  banned?: boolean | null;
  organizationId?: string | null;
  organizationName?: string | null;
}

function AdminPage() {
  const [organizations, setOrganizations] = useState<Array<Organization>>([]);
  const [users, setUsers] = useState<Array<AdminUser>>([]);
  const [status, setStatus] = useState("");
  const [canAdmin, setCanAdmin] = useState(false);

  useEffect(() => {
    void refresh().catch((err) => {
      setStatus(messageFromError(err));
      setCanAdmin(false);
    });
  }, []);

  async function refresh() {
    const me = await fetchJson<{ user: { role?: string | null } }>("/api/me");
    if (!me.user.role?.split(",").map((role) => role.trim()).includes("admin")) {
      setStatus("Admin access required.");
      setCanAdmin(false);
      return;
    }
    setCanAdmin(true);
    const [orgData, userData] = await Promise.all([
      fetchJson<{ organizations: Array<Organization> }>("/api/admin/organizations"),
      fetchJson<{ users: Array<AdminUser> }>("/api/admin/users"),
    ]);
    setOrganizations(orgData.organizations);
    setUsers(userData.users);
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("");
    const organizationMode = String(form.get("organizationMode"));
    try {
      await fetchJson("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name")),
          email: String(form.get("email")),
          password: String(form.get("password")),
          role: String(form.get("role")),
          organizationId:
            organizationMode === "existing" ? String(form.get("organizationId")) : undefined,
          organizationName:
            organizationMode === "new" ? String(form.get("organizationName")) : undefined,
        }),
      });
      event.currentTarget.reset();
      setStatus("User created.");
      await refresh();
    } catch (err) {
      setStatus(messageFromError(err));
    }
  }

  async function setLocked(user: AdminUser, locked: boolean) {
    await fetchJson(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locked }),
    });
    await refresh();
  }

  if (!canAdmin) {
    return (
      <main className="min-h-screen bg-[#f5f5f7] px-6 py-10 text-[#1d1d1f]">
        <div className="mx-auto max-w-4xl">
          <TopLinks />
          <p className="mt-16 text-2xl font-semibold">{status || "Checking access..."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-6 py-10 text-[#1d1d1f]">
      <div className="mx-auto max-w-6xl space-y-8">
        <TopLinks />
        <header>
          <p className="text-sm text-[#0066cc]">Admin</p>
          <h1 className="mt-2 text-4xl font-semibold">Users and organizations</h1>
        </header>

        <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Create invited user</CardTitle>
              <CardDescription>Name, email, password, and tenant assignment.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={createUser}>
                <Field name="name" label="Name" />
                <Field name="email" label="Email" type="email" />
                <Field name="password" label="Password" type="password" />
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <select id="role" name="role" className="h-11 w-full rounded-full border border-stone-300 bg-white px-4 text-sm">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <label className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-3">
                    <input name="organizationMode" value="existing" type="radio" defaultChecked />
                    Existing org
                  </label>
                  <label className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-3">
                    <input name="organizationMode" value="new" type="radio" />
                    New org
                  </label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organizationId">Existing organization</Label>
                  <select id="organizationId" name="organizationId" className="h-11 w-full rounded-full border border-stone-300 bg-white px-4 text-sm">
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Field name="organizationName" label="New organization name" required={false} />
                <Button type="submit" className="w-full">
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  Create user
                </Button>
                {status ? <p className="text-sm text-stone-600">{status}</p> : null}
              </form>
            </CardContent>
          </Card>

          <section className="rounded-[18px] border border-stone-200 bg-white">
            <div className="grid grid-cols-[1fr_1fr_110px] gap-3 border-b border-stone-200 px-5 py-3 text-sm font-semibold text-stone-500">
              <span>User</span>
              <span>Organization</span>
              <span>Status</span>
            </div>
            {users.map((user) => (
              <div key={user.id} className="grid grid-cols-[1fr_1fr_110px] items-center gap-3 border-b border-stone-100 px-5 py-4 last:border-b-0">
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-stone-500">{user.email}</p>
                </div>
                <p className="text-sm text-stone-600">{user.organizationName || "Unassigned"}</p>
                <Button
                  type="button"
                  variant={user.banned ? "default" : "outline"}
                  size="sm"
                  onClick={() => void setLocked(user, !user.banned)}
                >
                  {user.banned ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {user.banned ? "Unlock" : "Lock"}
                </Button>
              </div>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} />
    </div>
  );
}

function TopLinks() {
  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      <Button asChild variant="secondary" size="sm">
        <a href="/">Workspace</a>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <a href="/playground">Playground</a>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <a href="/profile">Profile</a>
      </Button>
    </nav>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (response.status === 401) window.location.assign("/login");
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function messageFromError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
