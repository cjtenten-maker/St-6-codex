import type { PortraitFit, PortraitFocus } from "./model";
import { RuleError } from "./rules/errors";

/** Small pictures crop here when nobody has tapped a face yet. */
export const PORTRAIT_TOP_FOCUS: PortraitFocus = { x: 0.5, y: 0 };

export type ArtBucket = "character-art" | "trouble-art";

/** Originals larger than this are refused before the browser decodes them. */
export const PORTRAIT_MAX_BYTES = 5 * 1024 * 1024;

/** Longest edge after the client downscale. The upload is a JPEG. */
export const PORTRAIT_MAX_EDGE = 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/i;

/**
 * Storage object name. A new revision on every upload so a replaced portrait
 * is not served from an old cached URL. Matches character_art_target in the migration.
 */
export function portraitObjectName(tableId: string, characterId: string, rev = Date.now()): string {
  if (!UUID.test(tableId) || !UUID.test(characterId)) {
    throw new RuleError("That portrait doesn't belong to a character.");
  }
  const stamp = Math.floor(rev);
  if (!Number.isFinite(stamp) || stamp <= 0) {
    throw new RuleError("That portrait doesn't belong to a character.");
  }
  return `${tableId}/${characterId}/${stamp}.jpg`;
}

const ART_FILE = /^[0-9]{1,16}\.jpg$/i;

/**
 * Object names to remove when a character or a trouble leaves.
 * Only files already stored under that id. A data URL stays in the demo.
 * Both buckets use {tableId}/{id}/{revision}.jpg.
 */
export function characterArtObjectNames(
  tableId: string,
  characterId: string,
  portraitPath: string | null | undefined,
  listedFileNames: readonly string[],
): string[] {
  if (!UUID.test(tableId) || !UUID.test(characterId)) return [];
  const folder = `${tableId}/${characterId}`;
  const names = new Set<string>();
  if (portraitPath && !portraitPath.startsWith("data:") && portraitPath.startsWith(`${folder}/`) && ART_FILE.test(portraitPath.slice(folder.length + 1))) {
    names.add(portraitPath);
  }
  for (const file of listedFileNames) {
    if (!ART_FILE.test(file) || file.includes("/") || file.includes("\\")) continue;
    names.add(`${folder}/${file}`);
  }
  return [...names];
}

export function assertPortraitFile(file: { size: number; type: string; name?: string }): void {
  if (file.size <= 0) throw new RuleError("That file is empty.");
  if (file.size > PORTRAIT_MAX_BYTES) throw new RuleError("Choose a photo under 5 MB.");
  const type = file.type.toLowerCase();
  if (type === "image/svg+xml") throw new RuleError("Choose a photo.");
  const looksImage = type.startsWith("image/") || IMAGE_EXT.test(file.name ?? "");
  if (!looksImage) throw new RuleError("Choose a photo.");
}

export function normalizePortraitFit(value: unknown): PortraitFit | undefined {
  return value === "contain" || value === "cover" ? value : undefined;
}

/** Keep a finite point inside the photo. Anything else is treated as unset. */
export function normalizePortraitFocus(value: unknown): PortraitFocus | undefined {
  if (!value || typeof value !== "object") return undefined;
  const point = value as { x?: unknown; y?: unknown };
  if (typeof point.x !== "number" || typeof point.y !== "number") return undefined;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return undefined;
  if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return undefined;
  return roundFocus({ x: point.x, y: point.y });
}

export function roundFocus(point: { x: number; y: number }): PortraitFocus {
  return {
    x: Math.round(clamp01(point.x) * 1000) / 1000,
    y: Math.round(clamp01(point.y) * 1000) / 1000,
  };
}

/**
 * What to draw. A sheet with no saved choice shows the whole photo.
 * A thumbnail always covers, and an unset face mark stays at the top.
 */
export function portraitFrame(source?: { portraitFit?: unknown; portraitFocus?: unknown } | null): {
  fit: PortraitFit;
  focus: PortraitFocus;
} {
  return {
    fit: normalizePortraitFit(source?.portraitFit) ?? "contain",
    focus: normalizePortraitFocus(source?.portraitFocus) ?? PORTRAIT_TOP_FOCUS,
  };
}

export function portraitObjectPosition(focus: PortraitFocus): string {
  const point = roundFocus(focus);
  return `${trimPercent(point.x * 100)}% ${trimPercent(point.y * 100)}%`;
}

/** Sheet frame versus the small pictures on the table and the GM screen. */
export function portraitLayout(
  slot: "sheet" | "thumb",
  source?: { portraitFit?: unknown; portraitFocus?: unknown } | null,
): { objectFit: "contain" | "cover"; objectPosition: string; blurFill: boolean } {
  const frame = portraitFrame(source);
  if (slot === "sheet" && frame.fit === "contain") {
    return { objectFit: "contain", objectPosition: "50% 50%", blurFill: true };
  }
  return { objectFit: "cover", objectPosition: portraitObjectPosition(frame.focus), blurFill: false };
}

/** Map a tap on the photo itself to a stored face mark. The box is the photo, not the letterbox. */
export function focusFromClientPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): PortraitFocus | null {
  if (!(rect.width > 0) || !(rect.height > 0)) return null;
  return roundFocus({
    x: (clientX - rect.left) / rect.width,
    y: (clientY - rect.top) / rect.height,
  });
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function trimPercent(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** Downscale to a JPEG the bucket will accept. iPhone HEIC is decoded when the browser can. */
export async function downscalePortrait(file: File): Promise<Blob> {
  assertPortraitFile(file);
  const source = await loadPortrait(file);
  const longest = Math.max(source.width, source.height);
  const scale = longest > PORTRAIT_MAX_EDGE ? PORTRAIT_MAX_EDGE / longest : 1;
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new RuleError("This browser couldn't prepare the photo.");
  context.drawImage(source, 0, 0, width, height);
  if ("close" in source && typeof source.close === "function") source.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new RuleError("This browser couldn't prepare the photo. Try a JPEG or PNG.");
  return blob;
}

export async function portraitDataUrl(file: File): Promise<string> {
  const blob = await downscalePortrait(file);
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new RuleError("This browser couldn't prepare the photo."));
    reader.readAsDataURL(blob);
  });
}

async function loadPortrait(file: File): Promise<CanvasImageSource & { width: number; height: number; close?: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Some photo-picker types only decode through an Image element.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new RuleError("That photo couldn't be read. Try a JPEG or PNG."));
      element.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
