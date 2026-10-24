"use client";

import { useEffect, useState } from "react";
import type { ArtBucket } from "@/lib/portrait";
import { useCodex } from "./CodexProvider";
import { Button, cx } from "./ui";

export function usePortrait(path: string | null | undefined, bucket: ArtBucket = "character-art"): string | null {
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
    void codex.portraitUrl(path, bucket).then(
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
  }, [bucket, codex, path]);

  return src;
}

export function Portrait({
  path,
  name,
  size = "xs",
  bucket = "character-art",
}: {
  path?: string | null;
  name: string;
  size?: "xs" | "lg";
  bucket?: ArtBucket;
}) {
  const src = usePortrait(path, bucket);
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
  noun = "portrait",
  hint = "Everyone at the table sees this photo. The rest of the sheet stays private. Photos only, up to 5 MB.",
}: {
  path?: string | null;
  busy: boolean;
  onPick: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  noun?: string;
  hint?: string;
}) {
  const add = path ? `Replace ${noun}` : `Add a ${noun}`;
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <label className={cx("inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-line px-4 text-sm", busy && "opacity-40")}>
          {add}
          <input
            className="sr-only"
            type="file"
            accept="image/*"
            disabled={busy}
            aria-label={add}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void onPick(file);
            }}
          />
        </label>
        {path ? (
          <Button tone="ghost" type="button" disabled={busy} onClick={() => void onRemove()}>
            Remove {noun}
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-mute">{hint}</p>
    </div>
  );
}
