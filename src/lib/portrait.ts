import { RuleError } from "./rules/errors";

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

export function assertPortraitFile(file: { size: number; type: string; name?: string }): void {
  if (file.size <= 0) throw new RuleError("That file is empty.");
  if (file.size > PORTRAIT_MAX_BYTES) throw new RuleError("Choose a photo under 5 MB.");
  const type = file.type.toLowerCase();
  if (type === "image/svg+xml") throw new RuleError("Choose a photo.");
  const looksImage = type.startsWith("image/") || IMAGE_EXT.test(file.name ?? "");
  if (!looksImage) throw new RuleError("Choose a photo.");
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
