"use client";

import { useEffect, useState } from "react";
import { useCodex } from "./CodexProvider";
import { Button, cx } from "./ui";

export function usePortrait(path: string | null | undefined): string | null {
  const codex = useCodex();
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setSrc(null);
      return;
    }
    if (path.startsWith("data:")) {
      setSrc(path);
      return;
    }
    let cancel = false;
    void codex.portraitUrl(path).then(
      (url) => {
        if (!cancel) setSrc(url);
      },
      () => {
        if (!cancel) setSrc(null);
      },
    );
    return () => {
      cancel = true;
    };
  }, [codex, path]);

  return src;
}

export function Portrait({
  path,
  name,
  size = "xs",
}: {
  path?: string | null;
  name: string;
  size?: "xs" | "lg";
}) {
  const src = usePortrait(path);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={`${name}'s portrait`}
      className={cx(
        "bg-ink object-cover",
        size === "lg" ? "mt-4 aspect-[4/3] max-h-80 w-full rounded-2xl" : "h-12 w-12 shrink-0 rounded-xl",
      )}
    />
  );
}

export function PortraitControls({
  path,
  busy,
  onPick,
  onRemove,
}: {
  path?: string | null;
  busy: boolean;
  onPick: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <label className={cx("inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-line px-4 text-sm", busy && "opacity-40")}>
          {path ? "Replace portrait" : "Add a portrait"}
          <input
            className="sr-only"
            type="file"
            accept="image/*"
            disabled={busy}
            aria-label={path ? "Replace portrait" : "Add a portrait"}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void onPick(file);
            }}
          />
        </label>
        {path ? (
          <Button tone="ghost" type="button" disabled={busy} onClick={() => void onRemove()}>
            Remove portrait
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-mute">Everyone at the table sees this photo. The rest of the sheet stays private. Photos only, up to 5 MB.</p>
    </div>
  );
}
