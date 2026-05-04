/**
 * Media Router — File upload + Voice transcription
 *
 * tRPC procedures for:
 *  • upload   – Accepts base64 file data → uploads to storage → returns URL
 *  • transcribe – Accepts audio URL → calls Whisper → returns transcription text
 *
 * Both are protected procedures (require authenticated user).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { transcribeAudio } from "./_core/voiceTranscription";
import { nanoid } from "nanoid";
import { createLogger } from "./_core/logger";

const log = createLogger("media");

export const mediaRouter = router({
  /**
   * Upload a file to storage.
   *
   * Client sends base64-encoded file data + metadata.
   * Returns the storage URL for inclusion in messages.
   */
  upload: protectedProcedure
    .input(
      z.object({
        /** base64-encoded file content */
        data: z.string(),
        /** Original file name */
        fileName: z.string(),
        /** MIME type (e.g., "image/png", "application/pdf") */
        contentType: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { data, fileName, contentType } = input;

      // Validate size (base64 is ~33% larger than binary, so 14 MB base64 ≈ 10 MB file)
      const MAX_BASE64_SIZE = 14 * 1024 * 1024;
      if (data.length > MAX_BASE64_SIZE) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "File exceeds maximum size of 10 MB",
        });
      }

      try {
        const buffer = Buffer.from(data, "base64");
        const userId = ctx.user.id;
        const key = `uploads/${userId}/${nanoid()}/${fileName}`;

        const result = await storagePut(key, buffer, contentType);

        return {
          url: result.url,
          key: result.key,
          fileName,
          contentType,
          size: buffer.length,
        };
      } catch (error) {
        log.error({ err: error }, "File upload failed");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upload file",
        });
      }
    }),

  /**
   * Transcribe an audio file to text.
   *
   * Client uploads the audio blob first (via the upload mutation above),
   * then passes the returned URL here for transcription.
   */
  transcribe: protectedProcedure
    .input(
      z.object({
        /** URL of the uploaded audio file */
        audioUrl: z.string().url(),
        /** Optional language hint (ISO 639-1, e.g., "en") */
        language: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await transcribeAudio({
        audioUrl: input.audioUrl,
        language: input.language,
      });

      // transcribeAudio returns either a WhisperResponse or a TranscriptionError
      if ("error" in result) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error,
          cause: result.details,
        });
      }

      return {
        text: result.text,
        language: result.language,
        duration: result.duration,
        segments: result.segments,
      };
    }),
});
