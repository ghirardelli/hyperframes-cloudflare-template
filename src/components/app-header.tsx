import { useEffect, useState } from "react";
import { Film, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

type NavKey = "workspace" | "playground" | "admin" | "profile";

interface MeResponse {
  user: { role?: string | null };
  organization: { name?: string | null };
}

const NAV: Array<{ key: NavKey; label: string; href: string; adminOnly?: boolean }> = [
  { key: "workspace", label: "Workspace", href: "/" },
  { key: "playground", label: "Playground", href: "/playground" },
  { key: "admin", label: "Admin", href: "/admin", adminOnly: true },
  { key: "profile", label: "Profile", href: "/profile" },
];

/**
 * Global top navigation. Full-width, sticky to the top of every authenticated
 * page so the header stays consistent across the site. Fetches /api/me itself
 * to stay self-contained (org name + admin visibility) and provides logout.
 */
export function AppHeader({ active }: { active?: NavKey }) {
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    fetch("/api/me", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? (r.json() as Promise<MeResponse>) : null))
      .then(setMe)
      .catch(() => {});
  }, []);

  const isAdmin = !!me?.user.role
    ?.split(",")
    .map((r) => r.trim())
    .includes("admin");

  async function logout() {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }).catch(() => {});
    window.location.assign("/login");
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-hairline bg-background/95 backdrop-blur">
      <div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Film className="h-5 w-5" aria-hidden="true" />
          Motion Frames
          {me?.organization?.name ? (
            <span className="ml-2 hidden text-xs font-normal text-muted-foreground sm:inline">
              {me.organization.name}
            </span>
          ) : null}
        </a>

        <nav className="flex items-center gap-1">
          {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => (
            <a
              key={item.key}
              href={item.href}
              aria-current={active === item.key ? "page" : undefined}
              className={
                "rounded-md px-3 py-2 text-sm transition-colors " +
                (active === item.key
                  ? "font-semibold text-foreground"
                  : "font-medium text-muted-foreground hover:bg-surface-card hover:text-foreground")
              }
            >
              {item.label}
            </a>
          ))}
          <Button type="button" variant="secondary" size="sm" className="ml-2" onClick={logout}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </Button>
        </nav>
      </div>
    </header>
  );
}
