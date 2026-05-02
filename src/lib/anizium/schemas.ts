import { z } from "zod";

export const GenreSchema = z.object({
  ID: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
});

export const AnimeDataSchema = z.object({
  ID: z.union([z.string(), z.number()]).transform(String),
  type: z.string().optional().nullable(),
  poster: z.string().optional().nullable(),
  name: z.string(),
  overview: z.string().optional().nullable(),
  imdb_point: z.union([z.number(), z.string()]).optional().nullable(),
  genre: z.array(GenreSchema).optional().default([]),
});

export const PageSchema = z.object({
  page: z.number().optional().default(1),
  per_page_items: z.number().optional().default(20),
  previous_page: z.number().nullable().optional(),
  next_page: z.number().nullable().optional(),
  total_pages: z.number().optional().default(1),
  data: z.array(AnimeDataSchema).default([]),
});

export const ApiResponseSchema = z.object({
  success: z.boolean().optional().default(true),
  page: PageSchema,
});

export const LatestEpisodeDataSchema = z.object({
  ID: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  poster: z.string().optional().nullable(),
  season: z.union([z.number(), z.string()]).optional().nullable(),
  episode: z.union([z.number(), z.string()]).optional().nullable(),
});

export const LatestEpisodeResponseSchema = z.object({
  success: z.boolean().optional().default(true),
  page: z.object({
    data: z.array(LatestEpisodeDataSchema).default([]),
    next_page: z.number().nullable().optional(),
    previous_page: z.number().nullable().optional(),
    total_pages: z.number().optional().default(1),
    page: z.number().optional().default(1),
  }),
});

const BooleanishSchema = z
  .union([z.boolean(), z.number(), z.string()])
  .optional()
  .nullable()
  .transform((value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;

    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "evet"].includes(normalized)) return true;
    if (["false", "0", "no", "hayır", "hayir"].includes(normalized)) return false;
    return null;
  });

export const EpisodeDataSchema = z
  .object({
    ID: z.union([z.string(), z.number()]).transform(String),
    name: z.string(),
    number: z.union([z.number(), z.string()]).optional().nullable(),
    overview: z.string().optional().nullable(),
    banner_link: z.string().optional().nullable(),
    filler: BooleanishSchema,
    is_filler: BooleanishSchema,
    isFiller: BooleanishSchema,
  })
  .transform(({ is_filler, isFiller, filler, ...episode }) => ({
    ...episode,
    filler: filler ?? is_filler ?? isFiller ?? null,
  }));

export const SeasonSchema = z.object({
  ID: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  number: z.union([z.number(), z.string()]).optional().nullable(),
  episodes: z.array(EpisodeDataSchema).default([]),
});

export const StudioSchema = z.object({
  ID: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  logo: z.string().optional().nullable(),
});

export const AvatarSchema = z.object({
  ID: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  link: z.string().optional().nullable(),
  avatar_set: z.string().optional().nullable(),
  who_use: z.string().optional().nullable(),
});

export const AnimeDetailsSchema = z.object({
  ID: z.union([z.string(), z.number()]).transform(String),
  type: z.string().optional().nullable(),
  banner: z.string().optional().nullable(),
  details_banner: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  poster: z.string().optional().nullable(),
  name: z.string(),
  name_jp: z.string().optional().nullable(),
  name_tr: z.string().optional().nullable(),
  overview: z.string().optional().nullable(),
  release_year: z.union([z.number(), z.string()]).optional().nullable(),
  genre: z.array(GenreSchema).optional().default([]),
  imdb_point: z.union([z.number(), z.string()]).optional().nullable(),
  tmdb_id: z.union([z.number(), z.string()]).optional().nullable(),
  youtube_video: z.string().optional().nullable(),
  studios: z.array(StudioSchema).optional().default([]),
  avatar: z.array(AvatarSchema).optional().default([]),
  seasons: z.array(SeasonSchema).optional().default([]),
});

export const AnimeDetailsResponseSchema = z.object({
  success: z.boolean().optional().default(true),
  data: AnimeDetailsSchema,
});

export const SubtitleDataSchema = z.object({
  group: z.string().optional().nullable(),
  name: z.string(),
  link: z.string(),
  row: z.union([z.number(), z.string()]).optional().nullable(),
});

export const SourceItemSchema = z.object({
  quality: z.union([z.number(), z.string()]).optional().nullable(),
  link: z.string(),
  type: z.string().optional().nullable(),
});

export const SourceGroupSchema = z.object({
  platform: z.string().optional().nullable(),
  group: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  items: z.array(SourceItemSchema).default([]),
  row: z.union([z.number(), z.string()]).optional().nullable(),
});

export const SourceContentSchema = z.object({
  name: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  season: z.union([z.number(), z.string()]).optional().nullable(),
  episode: z.union([z.number(), z.string()]).optional().nullable(),
  next_episode: z.string().optional().nullable(),
  next_episode_end: z.string().optional().nullable(),
  finish: z.string().optional().nullable(),
  opening: z
    .object({
      start: z.string().optional().nullable(),
      end: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  next_episode_data: z
    .object({
      season: z.union([z.number(), z.string()]).optional().nullable(),
      episode: z.union([z.number(), z.string()]).optional().nullable(),
      link: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const SourceResponseSchema = z.object({
  success: z.boolean().optional().default(true),
  content: SourceContentSchema.optional().nullable(),
  subtitles: z.array(SubtitleDataSchema).optional().default([]),
  groups: z.array(SourceGroupSchema).optional().default([]),
});

export const TMDBCastSchema = z.object({
  id: z.number(),
  name: z.string(),
  character: z.string(),
  profile_path: z.string().nullable().optional(),
  order: z.number().optional(),
});

export const TMDBCreditsSchema = z.object({
  cast: z.array(TMDBCastSchema).default([]),
});

export type Genre = z.infer<typeof GenreSchema>;
export type AnimeData = z.infer<typeof AnimeDataSchema>;
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
export type LatestEpisodeData = z.infer<typeof LatestEpisodeDataSchema>;
export type LatestEpisodeResponse = z.infer<typeof LatestEpisodeResponseSchema>;
export type EpisodeData = z.infer<typeof EpisodeDataSchema>;
export type Season = z.infer<typeof SeasonSchema>;
export type Studio = z.infer<typeof StudioSchema>;
export type Avatar = z.infer<typeof AvatarSchema>;
export type AnimeDetails = z.infer<typeof AnimeDetailsSchema>;
export type AnimeDetailsResponse = z.infer<typeof AnimeDetailsResponseSchema>;
export type SubtitleData = z.infer<typeof SubtitleDataSchema>;
export type SourceItem = z.infer<typeof SourceItemSchema>;
export type SourceGroup = z.infer<typeof SourceGroupSchema>;
export type SourceContent = z.infer<typeof SourceContentSchema>;
export type SourceResponse = z.infer<typeof SourceResponseSchema>;
export type TMDBCast = z.infer<typeof TMDBCastSchema>;
export type TMDBCredits = z.infer<typeof TMDBCreditsSchema>;
