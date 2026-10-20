// @ts-nocheck
import { randomUUID } from "node:crypto";
import express, { Router } from "express";
import { firebaseServices } from "../lib/firebase-admin-services";
import { logger } from "../lib/logger";

const router = Router();
const BPSC_ROOT = "competitiveExams/bpsc-cce";
const NOTES_ROOT = `${BPSC_ROOT}/notes`;
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const SAFE_DATABASE_KEY = /^[A-Za-z0-9_-]{1,128}$/;

function decodeHeader(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function parseNoteMetadata(value: unknown) {
  const decoded = decodeHeader(value);
  if (!decoded) return null;
  try {
    const raw = JSON.parse(decoded);
    const language = raw?.language;
    const noteId = String(raw?.noteId ?? "").trim();
    if (noteId && !SAFE_DATABASE_KEY.test(noteId)) return null;
    if (!["hi", "en", "both"].includes(language)) return null;

    const title = String(raw?.title ?? "").trim();
    const description = String(raw?.description ?? "").trim();
    const category = String(raw?.category ?? "").trim();
    if (!title || title.length > 180 || description.length > 4000 || !category || category.length > 120) return null;

    return {
      noteId,
      title,
      description,
      category,
      language,
      published: raw?.published !== false,
    };
  } catch {
    return null;
  }
}

function safePdfFilename(value: unknown) {
  const decoded = decodeHeader(value) || "note.pdf";
  const filename = decoded.split(/[\\/]/).pop()?.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 120);
  if (!filename || !filename.toLowerCase().endsWith(".pdf")) return null;
  return filename;
}

async function requireBpscAdmin(req: any, res: any, next: any) {
  try {
    const tokenMatch = String(req.headers.authorization ?? "").match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) return res.status(401).json({ ok: false, error: "Sign in is required." });

    const { auth, db } = firebaseServices();
    const decoded = await auth.verifyIdToken(tokenMatch[1]);
    const adminSnapshot = await db.ref(`users/${decoded.uid}/isAdmin`).get();
    if (adminSnapshot.val() !== true) {
      return res.status(403).json({ ok: false, error: "This account is not authorized to manage BPSC content." });
    }

    req.bpscAdminUid = decoded.uid;
    next();
  } catch (error) {
    logger.warn({ err: error }, "BPSC admin authorization failed");
    return res.status(401).json({ ok: false, error: "Your session could not be verified. Sign in again." });
  }
}

router.post(
  "/admin/bpsc/notes/upload",
  requireBpscAdmin,
  express.raw({ type: "application/pdf", limit: MAX_PDF_BYTES }),
  async (req: any, res: any) => {
    let uploadedFile: any;
    try {
      const metadata = parseNoteMetadata(req.headers["x-bpsc-note-metadata"]);
      const filename = safePdfFilename(req.headers["x-bpsc-file-name"]);
      const body = req.body;
      if (!metadata || !filename) {
        return res.status(400).json({ ok: false, error: "Valid note details and a PDF filename are required." });
      }
      if (!Buffer.isBuffer(body) || body.length === 0 || body.length > MAX_PDF_BYTES) {
        return res.status(400).json({ ok: false, error: "Choose a PDF file smaller than 25 MB." });
      }
      if (body.subarray(0, 5).toString("ascii") !== "%PDF-") {
        return res.status(415).json({ ok: false, error: "The selected file is not a valid PDF." });
      }

      const { db, bucket } = firebaseServices();
      const notesRef = db.ref(NOTES_ROOT);
      let noteId = metadata.noteId;
      let previousStoragePath = "";
      if (noteId) {
        const existingSnapshot = await notesRef.child(noteId).get();
        if (!existingSnapshot.exists()) {
          return res.status(404).json({ ok: false, error: "The note being edited no longer exists." });
        }
        previousStoragePath = String(existingSnapshot.val()?.storagePath ?? "");
      } else {
        noteId = notesRef.push().key;
        if (!noteId) throw new Error("Could not create a note ID.");
      }

      const storagePath = `${NOTES_ROOT}/${noteId}/${Date.now()}-${filename}`;
      uploadedFile = bucket.file(storagePath);
      const downloadToken = randomUUID();
      await uploadedFile.save(body, {
        resumable: false,
        metadata: {
          contentType: "application/pdf",
          cacheControl: "private, max-age=0, no-transform",
          metadata: { firebaseStorageDownloadTokens: downloadToken },
        },
      });

      const pdfUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
      const note = {
        title: metadata.title,
        description: metadata.description,
        category: metadata.category,
        language: metadata.language,
        pdfUrl,
        storagePath,
        fileName: filename,
        sizeBytes: body.length,
        published: metadata.published,
        uploadedByUid: req.bpscAdminUid,
        updatedAt: Date.now(),
      };

      try {
        await notesRef.child(noteId).set(note);
      } catch (error) {
        await uploadedFile.delete({ ignoreNotFound: true }).catch(() => undefined);
        throw error;
      }

      if (previousStoragePath && previousStoragePath.startsWith(`${NOTES_ROOT}/${noteId}/`) && previousStoragePath !== storagePath) {
        await bucket.file(previousStoragePath).delete({ ignoreNotFound: true }).catch((error: unknown) => {
          logger.warn({ err: error, noteId }, "Could not remove replaced BPSC PDF");
        });
      }

      return res.status(metadata.noteId ? 200 : 201).json({ ok: true, note: { id: noteId, ...note } });
    } catch (error) {
      logger.error({ err: error }, "BPSC PDF upload failed");
      if (uploadedFile) await uploadedFile.delete({ ignoreNotFound: true }).catch(() => undefined);
      return res.status(500).json({ ok: false, error: "The PDF could not be uploaded. Please try again." });
    }
  },
);

router.delete("/admin/bpsc/notes/:noteId", requireBpscAdmin, async (req: any, res: any) => {
  try {
    const noteId = String(req.params.noteId ?? "");
    if (!SAFE_DATABASE_KEY.test(noteId)) return res.status(400).json({ ok: false, error: "Invalid note ID." });

    const { db, bucket } = firebaseServices();
    const noteRef = db.ref(`${NOTES_ROOT}/${noteId}`);
    const snapshot = await noteRef.get();
    if (!snapshot.exists()) return res.status(404).json({ ok: false, error: "Note not found." });

    const storagePath = String(snapshot.val()?.storagePath ?? "");
    if (storagePath && storagePath.startsWith(`${NOTES_ROOT}/${noteId}/`)) {
      await bucket.file(storagePath).delete({ ignoreNotFound: true });
    }
    await noteRef.remove();
    return res.json({ ok: true });
  } catch (error) {
    logger.error({ err: error }, "BPSC note delete failed");
    return res.status(500).json({ ok: false, error: "The note could not be deleted." });
  }
});

export default router;
