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
  username: z.string().min(2).max(32).optional(),
});

export const inviteRespondSchema = z.object({
  action: z.enum(["accept", "decline"]),
  inviteId: z.string().min(1).max(64).optional(),
});

export const joinByCodeSchema = z.object({
  code: z.string().trim().min(4).max(12),
});

export const joinRoomSchema = z.object({
  code: z.string().trim().min(4).max(12).optional(),
});

export const roomRequestSchema = z.object({
  roomId: z.string().min(1).max(64).optional(),
  roomCode: z.string().trim().min(4).max(12).optional(),
  targetUserId: z.string().min(1).max(64),
  animeId: z.string().min(1).max(64).optional(),
  animeName: z.string().min(1).max(200).optional(),
  episodeId: z.string().min(1).max(64).optional(),
  episodeName: z.string().max(200).nullable().optional(),
  poster: z.string().url().max(500).nullable().optional(),
});

export const kickSchema = z.object({
  userId: z.string().min(1).max(64),
  ban: z.boolean().optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
