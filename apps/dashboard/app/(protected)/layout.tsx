import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/session";
import { LogoutButton } from "@/components/logout-button";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/provider-settings", label: "Provider Settings" },
  { href: "/consent-requests/new", label: "Create Consent" },
  { href: "/consent-requests", label: "Consent List" },
  { href: "/webhook-logs", label: "Webhook Logs" }
];

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (!requireAuth()) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <h1 className="font-semibold">Ochqich Dashboard MVP</h1>
          <LogoutButton />
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 p-4 md:grid-cols-[220px_1fr]">
        <nav className="space-y-1 rounded-lg border bg-white p-3">
          {links.map((link) => (
            <Link className="block rounded px-3 py-2 text-sm hover:bg-slate-100" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <main>{children}</main>
      </div>
    </div>
  );
}
