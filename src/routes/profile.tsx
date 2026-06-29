import { FormEvent, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

interface Profile {
  user: {
    name: string;
    email: string;
    role?: string | null;
  };
  organization: {
    name: string;
  };
}

function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetchJson<Profile>("/api/profile").then(setProfile).catch((err) => setStatus(messageFromError(err)));
  }, []);

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await fetchJson<Profile>("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: String(form.get("name")) }),
      });
      setProfile(data);
      setStatus("Profile updated.");
    } catch (err) {
      setStatus(messageFromError(err));
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await fetchJson("/api/profile/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: String(form.get("currentPassword")),
          newPassword: String(form.get("newPassword")),
        }),
      });
      event.currentTarget.reset();
      setStatus("Password changed.");
    } catch (err) {
      setStatus(messageFromError(err));
    }
  }

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
              <form className="space-y-4" onSubmit={updateProfile}>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" defaultValue={profile?.user.name ?? ""} required />
                </div>
                <ReadOnly label="Email" value={profile?.user.email ?? ""} />
                <ReadOnly label="Organization" value={profile?.organization.name ?? ""} />
                <Button type="submit">Save profile</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>Change your password without changing organization assignment.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={changePassword}>
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current password</Label>
                  <Input id="currentPassword" name="currentPassword" type="password" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <Input id="newPassword" name="newPassword" type="password" required />
                </div>
                <Button type="submit">Change password</Button>
              </form>
            </CardContent>
          </Card>
        </div>
          {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
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
