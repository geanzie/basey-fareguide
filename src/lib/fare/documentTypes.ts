/**
 * What counts as a fare rate supporting document, shared by client and server.
 *
 * Kept apart from `@/lib/fareDocumentStorage` on purpose: that module imports the
 * AWS SDK, so a client component reaching for the accept list or a MIME check
 * would drag the whole SDK into the browser bundle.
 */

export const FARE_DOCUMENT_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  // Scanned resolutions frequently arrive as a phone photo rather than a PDF.
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Value for an `<input type="file" accept="...">`. */
export const FARE_DOCUMENT_ACCEPT_ATTRIBUTE = Object.keys(
  FARE_DOCUMENT_EXTENSION_BY_MIME_TYPE,
).join(",");

/**
 * Ordinance 105's own scan is 8.7 MB, so a comparable issuance needs headroom.
 * Above this the upload is refused rather than silently truncated.
 */
export const MAX_FARE_DOCUMENT_SIZE = 15 * 1024 * 1024;

export function isPdfFareDocument(mimeType: string | null | undefined): boolean {
  return mimeType === "application/pdf";
}

export function isImageFareDocument(mimeType: string | null | undefined): boolean {
  return typeof mimeType === "string" && mimeType.startsWith("image/");
}
