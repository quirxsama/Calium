import { z } from "zod";

export const createRoomSchema = z.object({
  animeId: z.string().min(1).max(64),
  animeName: z.string().min(1).max(200),
  episodeId: z.string().min(1).max(64),
  episodeName: z.string().max(200).nullable().optional(),
  poster: z.string().url().max(500).nullable().optional(),
  isPublic: z.boolean().optional(),
});

export const updateRoomSchema = z.object({
  episodeId: z.string().min(1).max(64).optional(),
  episodeName: z.string().max(200).nullable().optional(),
  isPublic: z.boolean().optional(),
});

export const inviteSchema = z.object({
  username: z.string().min(2).max(32),
});

export const kickSchema = z.object({
  userId: z.string().min(1).max(64),
  ban: z.boolean().optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
