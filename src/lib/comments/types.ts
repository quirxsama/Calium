// Yorum ve puanlama API'lerinin istemci/sunucu paylaştığı tipler.
// Sözleşme: GET /api/comments, POST /api/comments, DELETE /api/comments/[id],
// GET|PUT /api/ratings/[animeId], GET /api/admin/comments.

export type CommentAuthor = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type CommentItem = {
  id: string;
  body: string;
  /** null → seri yorumu, dolu → bölüm yorumu (Anizium episode ID) */
  episodeId: string | null;
  /** ISO 8601 */
  createdAt: string;
  user: CommentAuthor;
  /** Oturum sahibi yazar veya admin ise true */
  canDelete: boolean;
};

export type CommentListData = {
  comments: CommentItem[];
  nextCursor: string | null;
};

/** Admin moderasyon listesi — animeId, herkese açık yorum yanıtında yer almaz. */
export type AdminCommentItem = CommentItem & { animeId: string };

export type RatingSummary = {
  /** Ortalama, 1 ondalık; oy yoksa null */
  average: number | null;
  count: number;
  /** Oturum sahibinin oyu; giriş yoksa veya oy vermemişse null */
  myRating: number | null;
};

export const COMMENT_MAX_LENGTH = 2000;
