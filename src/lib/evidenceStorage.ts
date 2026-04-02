import { EvidenceType, Prisma } from "@prisma/client";
import { existsSync } from "fs";
import { mkdir, unlink, writeFile } from "fs/promises";
import { join } from "path";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "application/pdf",
  "audio/mpeg",
  "audio/wav",
]);

const allowedExtensions = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "mp4",
  "mov",
  "avi",
  "pdf",
  "mp3",
  "wav",
]);

const evidenceInclude = {
  uploader: {
    select: {
      firstName: true,
      lastName: true,
      username: true,
    },
  },
  reviewer: {
    select: {
      firstName: true,
      lastName: true,
      username: true,
    },
  },
} as const;

type UploadedEvidenceRecord = Prisma.EvidenceGetPayload<{
  include: typeof evidenceInclude;
}>;

function getEvidenceFileType(mimeType: string): EvidenceType {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  if (mimeType.includes("pdf") || mimeType.includes("document")) return "DOCUMENT";
  return "OTHER";
}

function getUploadDirectory() {
  return join(process.cwd(), "public", "uploads", "evidence");
}

function validateEvidenceFile(file: File) {
  const maxSize = file.type.startsWith("video/") ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

  if (file.size > maxSize) {
    const maxSizeMB = Math.floor(maxSize / (1024 * 1024));
    throw new Error(
      `File size too large. Maximum ${maxSizeMB}MB allowed for ${file.type.startsWith("video/") ? "videos" : "files"}.`,
    );
  }

  if (!allowedMimeTypes.has(file.type)) {
    throw new Error("Invalid file type. Only images, videos, PDFs, and audio files are allowed.");
  }

  const fileExtension = file.name.split(".").pop()?.toLowerCase();
  if (!fileExtension || !allowedExtensions.has(fileExtension)) {
    throw new Error("Invalid file extension. Only image, video, PDF, and audio files are allowed.");
  }

  return fileExtension;
}

async function ensureUploadDirectory() {
  await mkdir(getUploadDirectory(), { recursive: true });
}

async function removeStoredFile(fileName: string) {
  const filePath = join(getUploadDirectory(), fileName);
  if (!existsSync(filePath)) {
    return;
  }

  await unlink(filePath);
}

async function storeEvidenceFile(incidentId: string, file: File) {
  const fileExtension = validateEvidenceFile(file);
  await ensureUploadDirectory();

  const randomBytes = crypto.randomBytes(16).toString("hex");
  const timestamp = Date.now();
  const fileName = `evidence_${incidentId}_${timestamp}_${randomBytes}.${fileExtension}`.replace(/[\\/]/g, "");
  const filePath = join(getUploadDirectory(), fileName);

  if (!filePath.startsWith(getUploadDirectory())) {
    throw new Error("Invalid file path");
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  await writeFile(filePath, buffer);

  return {
    fileName,
    fileUrl: `/uploads/evidence/${fileName}`,
    fileType: getEvidenceFileType(file.type),
    fileSize: file.size,
  };
}

export function extractEvidenceFiles(formData: FormData): File[] {
  return Array.from(formData.values()).filter(
    (value): value is File => value instanceof File && value.size > 0 && Boolean(value.name),
  );
}

export async function uploadEvidenceFiles(options: {
  incidentId: string;
  files: File[];
  uploadedBy: string;
}) {
  const { incidentId, files, uploadedBy } = options;
  const createdEvidence: Array<{ id: string; fileName: string }> = [];
  const evidenceRecords: UploadedEvidenceRecord[] = [];

  try {
    for (const file of files) {
      const storedFile = await storeEvidenceFile(incidentId, file);

      try {
        const evidence = await prisma.evidence.create({
          data: {
            incidentId,
            fileName: storedFile.fileName,
            fileUrl: storedFile.fileUrl,
            fileType: storedFile.fileType,
            fileSize: storedFile.fileSize,
            uploadedBy,
            status: "PENDING_REVIEW",
            storageStatus: "AVAILABLE",
          },
          include: evidenceInclude,
        });

        createdEvidence.push({ id: evidence.id, fileName: evidence.fileName });
        evidenceRecords.push(evidence);
      } catch (error) {
        await removeStoredFile(storedFile.fileName).catch(() => {});
        throw error;
      }
    }

    return evidenceRecords;
  } catch (error) {
    if (createdEvidence.length > 0) {
      await prisma.evidence.deleteMany({
        where: {
          id: { in: createdEvidence.map((evidence) => evidence.id) },
        },
      });

      await Promise.all(
        createdEvidence.map((evidence) =>
          removeStoredFile(evidence.fileName).catch(() => {}),
        ),
      );
    }

    throw error;
  }
}
