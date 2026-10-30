import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AdminCommentItem, CommentItem, CommentListData, ProfileCommentsData, RatingSummary } from "./types";

const COMMENT_SELECT = {
  id: true,
  userId: true,
  animeId: true,
  body: true,
  episodeId: true,
  createdAt: true,
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
} as const;

type CommentRow = Prisma.CommentGetPayload<{ select: typeof COMMENT_SELECT }>;

/** canDelete hesabı için yeterli oturum bilgisi; giriş yoksa null. */
export type CommentViewer = { id: string; role: string } | null;

function toCommentItem(row: CommentRow, viewer: CommentViewer): CommentItem {
  return {
    id: row.id,
    body: row.body,
    episodeId: row.episodeId,
    createdAt: row.createdAt.toISOString(),
    user: row.user,
    canDelete: viewer !== null && (viewer.id === row.userId || viewer.role === "admin"),
  };
}

async function fetchCommentRows(where: Prisma.CommentWhereInput, cursor: string | null, limit: number) {
  const rows = await prisma.comment.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: COMMENT_SELECT,
  });

  let nextCursor: string | null = null;
  if (rows.length > limit) {
    nextCursor = rows[limit - 1].id;
    rows.pop();
  }

  return { rows, nextCursor };
}

export async function listComments(params: {
  where: Prisma.CommentWhereInput;
  cursor: string | null;
  limit: number;
  viewer: CommentViewer;
}): Promise<CommentListData> {
  const { rows, nextCursor } = await fetchCommentRows(params.where, params.cursor, params.limit);
  return { comments: rows.map((row) => toCommentItem(row, params.viewer)), nextCursor };
}

/** Bir kullanıcının profilinde listelenecek yorumları (en yeni önce) döner. */
export async function listCommentsByUser(params: {
  userId: string;
  cursor: string | null;
  limit: number;
  viewer: CommentViewer;
}): Promise<Omit<ProfileCommentsData, "visible">> {
  const { rows, nextCursor } = await fetchCommentRows(
    { userId: params.userId, deleted: false },
    params.cursor,
    params.limit
  );
  return {
    comments: rows.map((row) => ({ ...toCommentItem(row, params.viewer), animeId: row.animeId })),
    nextCursor,
  };
}

export async function listCommentsForAdmin(params: {
  q: string | null;
  cursor: string | null;
  limit: number;
  admin: { id: string; role: string };
}): Promise<{ comments: AdminCommentItem[]; nextCursor: string | null }> {
  const where: Prisma.CommentWhereInput = {
    deleted: false,
    ...(params.q
      ? {
          OR: [
            { body: { contains: params.q } },
            { user: { username: { contains: params.q } } },
          ],
        }
      : {}),
  };

  const { rows, nextCursor } = await fetchCommentRows(where, params.cursor, params.limit);
  const comments = rows.map((row) => ({ ...toCommentItem(row, params.admin), animeId: row.animeId }));
  return { comments, nextCursor };
}

export async function createComment(
  input: { userId: string; animeId: string; episodeId: string | null; body: string },
  viewer: { id: string; role: string }
): Promise<CommentItem> {
  const row = await prisma.comment.create({
    data: {
      userId: input.userId,
      animeId: input.animeId,
      episodeId: input.episodeId,
      body: input.body,
    },
    select: COMMENT_SELECT,
  });
  return toCommentItem(row, viewer);
}

export async function softDeleteComment(
  commentId: string,
  actor: { id: string; role: string }
): Promise<"ok" | "not_found" | "forbidden"> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { userId: true, deleted: true },
  });
  if (!comment || comment.deleted) return "not_found";
  if (comment.userId !== actor.id && actor.role !== "admin") return "forbidden";

  await prisma.comment.update({ where: { id: commentId }, data: { deleted: true } });
  return "ok";
}

export async function softDeleteCommentAsAdmin(commentId: string): Promise<boolean> {
  const result = await prisma.comment.updateMany({
    where: { id: commentId, deleted: false },
    data: { deleted: true },
  });
  return result.count > 0;
}

export async function getRatingSummary(animeId: string, viewerId: string | null): Promise<RatingSummary> {
  const [aggregate, mine] = await Promise.all([
    prisma.rating.aggregate({ where: { animeId }, _sum: { value: true }, _count: true }),
    viewerId
      ? prisma.rating.findUnique({
          where: { userId_animeId: { userId: viewerId, animeId } },
          select: { value: true },
        })
      : Promise.resolve(null),
  ]);

  const count = aggregate._count;
  const sum = aggregate._sum.value;
  const average = count === 0 || sum === null ? null : Math.round((sum / count) * 10) / 10;

  return { average, count, myRating: mine?.value ?? null };
}

export async function rateAnime(userId: string, animeId: string, value: number): Promise<RatingSummary> {
  await prisma.rating.upsert({
    where: { userId_animeId: { userId, animeId } },
    update: { value },
    create: { userId, animeId, value },
  });
  return getRatingSummary(animeId, userId);
}
