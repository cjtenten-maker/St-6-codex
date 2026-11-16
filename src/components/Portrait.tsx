"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { PortraitFit, PortraitFocus } from "@/lib/model";
import type { ArtBucket } from "@/lib/portrait";
import { focusFromClientPoint, portraitFrame, portraitLayout, roundFocus } from "@/lib/portrait";
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
  fit,
  focus,
}: {
  path?: string | null;
  name: string;
  size?: "xs" | "lg";
  bucket?: ArtBucket;
  fit?: PortraitFit | null;
  focus?: PortraitFocus | null;
}) {
  const src = usePortrait(path, bucket);
  if (!src) return null;
  const layout = portraitLayout(size === "lg" ? "sheet" : "thumb", { portraitFit: fit, portraitFocus: focus });
  return (
    <span
      className={cx(
        "relative overflow-hidden bg-ink",
        size === "lg" ? "mt-4 block aspect-[4/3] max-h-80 w-full rounded-2xl" : "inline-block h-12 w-12 shrink-0 rounded-xl",
      )}
    >
      {layout.blurFill ? (
        <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-2xl" />
      ) : null}
      <img
        src={src}
        alt={name ? `${name}'s portrait` : ""}
        className={cx("relative h-full w-full", layout.objectFit === "contain" ? "object-contain" : "object-cover")}
        style={{ objectPosition: layout.objectPosition }}
      />
    </span>
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

export function PortraitFraming({
  path,
  name,
  bucket = "character-art",
  fit,
  focus,
  busy,
  onFit,
  onFocus,
}: {
  path: string;
  name: string;
  bucket?: ArtBucket;
  fit?: PortraitFit | null;
  focus?: PortraitFocus | null;
  busy: boolean;
  onFit: (fit: PortraitFit) => void;
  onFocus: (focus: PortraitFocus) => void;
}) {
  const src = usePortrait(path, bucket);
  const photoRef = useRef<HTMLImageElement>(null);
  const frame = portraitFrame({ portraitFit: fit, portraitFocus: focus });
  const [draft, setDraft] = useState(frame.focus);
  const draftRef = useRef(draft);
  const [photoBox, setPhotoBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [layoutEpoch, setLayoutEpoch] = useState(0);
  const storedX = frame.focus.x;
  const storedY = frame.focus.y;

  useEffect(() => {
    const next = portraitFrame({ portraitFocus: { x: storedX, y: storedY } }).focus;
    draftRef.current = next;
    setDraft(next);
  }, [storedX, storedY]);

  useEffect(() => {
    const photo = photoRef.current;
    if (!photo) return;
    const measure = () => {
      const current = photoRef.current;
      const parent = current?.parentElement;
      if (!current || !parent) return;
      const photoRect = current.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      setPhotoBox({
        left: photoRect.left - parentRect.left,
        top: photoRect.top - parentRect.top,
        width: photoRect.width,
        height: photoRect.height,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(photo);
    if (photo.parentElement) observer.observe(photo.parentElement);
    return () => observer.disconnect();
  }, [src, layoutEpoch]);

  const place = (event: ReactPointerEvent<HTMLDivElement>) => {
    const photo = photoRef.current;
    if (!photo) return null;
    const next = focusFromClientPoint(event.clientX, event.clientY, photo.getBoundingClientRect());
    if (!next) return null;
    draftRef.current = next;
    setDraft(next);
    return next;
  };

  const mark = `${Math.round(draft.x * 100)} percent across, ${Math.round(draft.y * 100)} percent down`;

  return (
    <div className={cx("mt-3", busy && "opacity-40")}>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="How the portrait sits in the frame">
        <button
          type="button"
          className={choiceClass(frame.fit === "contain")}
          aria-pressed={frame.fit === "contain"}
          disabled={busy}
          onClick={() => onFit("contain")}
        >
          Fit whole picture
        </button>
        <button
          type="button"
          className={choiceClass(frame.fit === "cover")}
          aria-pressed={frame.fit === "cover"}
          disabled={busy}
          onClick={() => onFit("cover")}
        >
          Fill frame
        </button>
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-mute">Face</p>
      <div
        className={cx(
          "relative mx-auto mt-2 max-w-full touch-none select-none rounded-2xl",
          src ? "w-fit" : "w-full",
        )}
        role="slider"
        tabIndex={busy ? -1 : 0}
        aria-label="Face position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(draft.y * 100)}
        aria-valuetext={mark}
        aria-disabled={busy}
        onPointerDown={(event) => {
          if (busy) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          place(event);
        }}
        onPointerMove={(event) => {
          if (busy || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
          place(event);
        }}
        onPointerUp={(event) => {
          if (busy) return;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          const next = place(event);
          if (next) onFocus(next);
        }}
        onKeyDown={(event) => {
          if (busy) return;
          const step = event.shiftKey ? 0.1 : 0.05;
          const current = draftRef.current;
          let next = current;
          if (event.key === "ArrowLeft") next = { x: current.x - step, y: current.y };
          else if (event.key === "ArrowRight") next = { x: current.x + step, y: current.y };
          else if (event.key === "ArrowUp") next = { x: current.x, y: current.y - step };
          else if (event.key === "ArrowDown") next = { x: current.x, y: current.y + step };
          else return;
          event.preventDefault();
          const placed = roundFocus(next);
          draftRef.current = placed;
          setDraft(placed);
          onFocus(placed);
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        {src ? (
          <img
            ref={photoRef}
            src={src}
            alt=""
            draggable={false}
            className="block h-auto max-h-80 w-auto max-w-full rounded-2xl"
            onLoad={() => setLayoutEpoch((epoch) => epoch + 1)}
            style={{ WebkitTouchCallout: "none" }}
          />
        ) : (
          <span className="block h-40 w-full rounded-2xl bg-ink" />
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-brass shadow-[0_0_0_3px_rgba(12,15,13,0.9)]"
          style={{
            left: photoBox ? `${photoBox.left + draft.x * photoBox.width}px` : `${draft.x * 100}%`,
            top: photoBox ? `${photoBox.top + draft.y * photoBox.height}px` : `${draft.y * 100}%`,
          }}
        >
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper shadow-[0_0_0_2px_rgba(12,15,13,0.9)]" />
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Portrait path={path} name={name} bucket={bucket} fit="cover" focus={draft} />
        <p className="text-xs text-mute">
          Fit whole picture shows all of it on this sheet. Fill frame crops the sheet to the box. The small picture at the table keeps the spot you tap.
        </p>
      </div>
    </div>
  );
}

function choiceClass(on: boolean): string {
  return cx(
    "min-h-11 rounded-xl border px-3 text-sm font-medium",
    on ? "border-brass bg-brass text-ink" : "border-line bg-panel/60 text-paper",
  );
}
