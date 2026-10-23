"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "./ui";

export function Nav({ code }: { code: string }) {
  const path = usePathname();
  const key = code.toUpperCase();
  const [sheet, setSheet] = useState(`/t/${key}`);

  useEffect(() => {
    const id = sessionStorage.getItem(`st6-sheet-${key}`);
    setSheet(id ? `/t/${key}/c/${id}` : `/t/${key}`);
  }, [key, path]);

  const items = [
    { href: `/t/${key}`, label: "Table", on: path === `/t/${key}` },
    { href: sheet, label: "Sheet", on: path.includes("/c/") },
    { href: `/t/${key}/gm`, label: "GM", on: path.endsWith("/gm") },
    { href: `/t/${key}/log`, label: "Log", on: path.endsWith("/log") },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 backdrop-blur">
      <div className="mx-auto grid max-w-lg grid-cols-4 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cx(
              "flex min-h-12 flex-col items-center justify-center text-xs uppercase tracking-[0.16em]",
              item.on ? "text-brass" : "text-mute",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function Frame({ code, children }: { code?: string; children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto min-h-dvh w-full max-w-lg px-4 pb-28 pt-5 lg:max-w-5xl">{children}</main>
      {code ? <Nav code={code} /> : null}
    </>
  );
}
