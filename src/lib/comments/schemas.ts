import { z } from "zod";
import { COMMENT_MAX_LENGTH } from "./types";

export const COMMENT_LIMIT_DEFAULT = 20;
export const COMMENT_LIMIT_MAX = 50;

/** `limit` query parametresini 1..50 aralığına sabitler; geçersizse varsayılana döner. */
export function resolveCommentLimit(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return COMMENT_LIMIT_DEFAULT;
  return Math.min(parsed, COMMENT_LIMIT_MAX);
}

export const CreateCommentSchema = z.object({
  animeId: z.string("animeId gerekli.").trim().min(1, "animeId gerekli.").max(128, "animeId çok uzun."),
  // Boş string episodeId seri yorumu sayılır; istemcinin "" göndermesi 400 üretmesin.
  episodeId: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z
      .string("episodeId metin olmalı.")
      .trim()
      .min(1, "episodeId geçersiz.")
      .max(128, "episodeId çok uzun.")
      .nullable()
      .optional()
  ),
  body: z
    .string("Yorum metni gerekli.")
    .trim()
    .min(1, "Yorum boş olamaz.")
    .max(COMMENT_MAX_LENGTH, `Yorum en fazla ${COMMENT_MAX_LENGTH} karakter olabilir.`),
});

export const RateAnimeSchema = z.object({
  value: z
    .number("Puan gerekli.")
    .int("Puan tam sayı olmalı.")
    .min(1, "Puan 1 ile 10 arasında olmalı.")
    .max(10, "Puan 1 ile 10 arasında olmalı."),
});
