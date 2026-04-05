"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const items = [
  { href: "/services", label: "Services" },
  { href: "/consumers", label: "Agents" },
  { href: "/audit", label: "History" },
  { href: "/settings", label: "Settings" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "app-nav-pill rounded-full px-4 py-2 text-sm font-medium",
              active
                ? "app-nav-pill-active"
                : "",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
