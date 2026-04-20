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

export const EpisodeDataSchema = z.object({
  ID: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  number: z.union([z.number(), z.string()]).optional().nullable(),
  overview: z.string().optional().nullable(),
  banner_link: z.string().optional().nullable(),
});

export const SeasonSchema = z.object({
  ID: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  number: z.union([z.number(), z.string()]).optional().nullable(),
  episodes: z.array(EpisodeDataSchema).default([]),
});

export const AnimeDetailsSchema = z.object({
  ID: z.union([z.string(), z.number()]).transform(String),
  type: z.string().optional().nullable(),
  banner: z.string().optional().nullable(),
  details_banner: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  poster: z.string().optional().nullable(),
  name: z.string(),
  overview: z.string().optional().nullable(),
  release_year: z.union([z.number(), z.string()]).optional().nullable(),
  genre: z.array(GenreSchema).optional().default([]),
  imdb_point: z.union([z.number(), z.string()]).optional().nullable(),
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

export type Genre = z.infer<typeof GenreSchema>;
export type AnimeData = z.infer<typeof AnimeDataSchema>;
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
export type LatestEpisodeData = z.infer<typeof LatestEpisodeDataSchema>;
export type LatestEpisodeResponse = z.infer<typeof LatestEpisodeResponseSchema>;
export type EpisodeData = z.infer<typeof EpisodeDataSchema>;
export type Season = z.infer<typeof SeasonSchema>;
export type AnimeDetails = z.infer<typeof AnimeDetailsSchema>;
export type AnimeDetailsResponse = z.infer<typeof AnimeDetailsResponseSchema>;
export type SubtitleData = z.infer<typeof SubtitleDataSchema>;
export type SourceItem = z.infer<typeof SourceItemSchema>;
export type SourceGroup = z.infer<typeof SourceGroupSchema>;
export type SourceContent = z.infer<typeof SourceContentSchema>;
export type SourceResponse = z.infer<typeof SourceResponseSchema>;
