/**
 * Upload validation, sanitization, and the retention policy for X-ray pixels.
 *
 * Every uploaded file passes through sanitizeUpload() before it reaches the model or
 * the database. Nothing here writes to disk unless STORE_ORIGINAL_IMAGES is enabled.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { payloadTooLarge, unprocessableImage, unsupportedMediaType } from '../lib/errors.js';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'] as const;

/**
 * Content sniffing by magic bytes. A file extension is attacker-controlled metadata, so
 * a renamed executable or SVG would otherwise sail through extension-only checks.
 */
const SIGNATURES: Array<{ mime: 'image/jpeg' | 'image/png'; bytes: number[] }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

export function detectImageType(buffer: Buffer): 'image/jpeg' | 'image/png' | null {
  for (const signature of SIGNATURES) {
    if (signature.bytes.every((byte, index) => buffer[index] === byte)) {
      return signature.mime;
    }
  }
  return null;
}

export interface SanitizedImage {
  /** Re-encoded pixels with all metadata removed. Safe to forward to the model. */
  buffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png';
  width: number;
  height: number;
  byteSize: number;
  /** SHA-256 of the original upload, so a result can be tied to a specific file. */
  checksum: string;
}

/**
 * Validate, decode, and re-encode an upload.
 *
 * Re-encoding through sharp is the sanitization step: it drops EXIF (which routinely
 * carries patient names and device identifiers in clinical exports), discards any
 * trailing payload appended after the image data, and guarantees the bytes we forward
 * are actually decodable pixels.
 */
export async function sanitizeUpload(
  raw: Buffer,
  originalName: string,
): Promise<SanitizedImage> {
  if (raw.length === 0) {
    throw unprocessableImage('The uploaded file is empty.');
  }
  if (raw.length > env.MAX_UPLOAD_BYTES) {
    throw payloadTooLarge(
      `The image exceeds the ${Math.round(env.MAX_UPLOAD_BYTES / (1024 * 1024))}MB limit.`,
    );
  }

  const extension = path.extname(originalName).toLowerCase();
  if (extension && !ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
    throw unsupportedMediaType(`Unsupported file type "${extension}". Upload a JPG, JPEG, or PNG.`);
  }

  const detected = detectImageType(raw);
  if (!detected) {
    throw unsupportedMediaType('The file contents are not a valid JPEG or PNG image.');
  }

  const checksum = createHash('sha256').update(raw).digest('hex');

  let pipeline: sharp.Sharp;
  let metadata: sharp.Metadata;
  try {
    pipeline = sharp(raw, { limitInputPixels: 100_000_000, failOn: 'error' });
    metadata = await pipeline.metadata();
  } catch {
    throw unprocessableImage('The image could not be decoded. It may be corrupt.');
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < 32 || height < 32) {
    throw unprocessableImage('The image is too small to be a diagnostic chest X-ray.');
  }

  const rotated = sharp(raw, { limitInputPixels: 100_000_000 }).rotate();
  const buffer =
    detected === 'image/png'
      ? await rotated.png({ compressionLevel: 6 }).toBuffer()
      : await rotated.jpeg({ quality: 95, mozjpeg: true }).toBuffer();

  return { buffer, mimeType: detected, width, height, byteSize: raw.length, checksum };
}

async function downscaleToDataUrl(
  image: SanitizedImage,
  size: number,
  quality: number,
  label: string,
): Promise<string | null> {
  try {
    const buffer = await sharp(image.buffer)
      .resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch (error) {
    logger.warn(`${label} generation failed`, {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

/** Small preview for history lists. Returned as a data URL, never written to disk. */
export async function createThumbnail(image: SanitizedImage): Promise<string | null> {
  if (!env.STORE_THUMBNAILS) return null;
  return downscaleToDataUrl(image, env.THUMBNAIL_SIZE, 72, 'Thumbnail');
}

/**
 * Larger rendition for the on-screen viewer and the report.
 *
 * A 256px thumbnail is unreadable as a radiograph, but retaining the original is a
 * retention decision the deployment may not want. This middle rendition keeps the study
 * reviewable without persisting diagnostic-resolution pixels.
 */
export async function createDisplayImage(image: SanitizedImage): Promise<string | null> {
  if (!env.STORE_THUMBNAILS) return null;
  return downscaleToDataUrl(image, env.DISPLAY_IMAGE_SIZE, 85, 'Display image');
}

/**
 * Persist full-resolution pixels only when explicitly configured. Off by default, so a
 * default deployment retains no diagnostic imagery at all.
 */
export async function persistOriginal(image: SanitizedImage): Promise<string | null> {
  if (!env.STORE_ORIGINAL_IMAGES) return null;

  try {
    const directory = path.resolve(env.IMAGE_STORAGE_DIR);
    await mkdir(directory, { recursive: true });

    const extension = image.mimeType === 'image/png' ? 'png' : 'jpg';
    // Random filename: a sequential or patient-derived name would leak information
    // through directory listings.
    const fileName = `${randomUUID()}.${extension}`;
    await writeFile(path.join(directory, fileName), image.buffer, { mode: 0o600 });

    return fileName;
  } catch (error) {
    logger.error('Failed to persist original image', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

/** Heatmaps are stored under the same flag as thumbnails. */
export function retainHeatmap(dataUrl: string | null): string | null {
  if (!dataUrl) return null;
  return env.STORE_THUMBNAILS ? dataUrl : null;
}
