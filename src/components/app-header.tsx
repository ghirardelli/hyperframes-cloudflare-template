import { useQueryClient } from "@tanstack/react-query";
import { Film, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/api-client";
import { clearProtectedCaches, useMeQuery } from "@/lib/app-queries";

type NavKey = "workspace" | "projects" | "playground" | "admin" | "profile";

const NAV: Array<{ key: NavKey; label: string; href: string; adminOnly?: boolean }> = [
  { key: "workspace", label: "Workspace", href: "/" },
  { key: "projects", label: "My Projects", href: "/projects" },
  { key: "playground", label: "Playground", href: "/playground" },
  { key: "admin", label: "Admin", href: "/admin", adminOnly: true },
  { key: "profile", label: "Profile", href: "/profile" },
];

/**
 * Global top navigation. Full-width, sticky to the top of every authenticated
 * page so the header stays consistent across the site.
 */
export function AppHeader({ active }: { active?: NavKey }) {
  const queryClient = useQueryClient();
  const { data: me } = useMeQuery();

  const isAdmin = !!me?.user.role
    ?.split(",")
    .map((r) => r.trim())
    .includes("admin");

  async function logout() {
    await apiJson("/api/auth/sign-out", {
      method: "POST",
      body: "{}",
    }).catch(() => {});
    clearProtectedCaches(queryClient);
    window.location.assign("/login");
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-hairline bg-background/95 backdrop-blur">
      <div className="flex min-h-16 w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-6 lg:px-8">
        <a href="/" className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <Film className="h-5 w-5" aria-hidden="true" />
          Motion Frames
          {me?.organization?.name ? (
            <span className="ml-2 hidden text-xs font-normal text-muted-foreground sm:inline">
              {me.organization.name}
            </span>
          ) : null}
        </a>

        <nav className="flex min-w-0 flex-wrap items-center gap-1">
          {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => (
            <a
              key={item.key}
              href={item.href}
              aria-current={active === item.key ? "page" : undefined}
              className={
                "rounded-md px-2 py-2 text-sm transition-colors sm:px-3 " +
                (active === item.key
                  ? "font-semibold text-foreground"
                  : "font-medium text-muted-foreground hover:bg-surface-card hover:text-foreground")
              }
            >
              {item.label}
            </a>
          ))}
          <Button type="button" variant="secondary" size="sm" className="ml-1 sm:ml-2" onClick={logout}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </Button>
        </nav>
      </div>
    </header>
  );
}
