import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Geçerli bir email adresi girin."),
  username: z
    .string()
    .min(3, "Kullanıcı adı en az 3 karakter olmalı.")
    .max(20, "Kullanıcı adı en fazla 20 karakter olabilir.")
    .regex(/^[a-zA-Z0-9_]+$/, "Sadece harf, rakam ve alt çizgi kullanılabilir."),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı."),
});

export const loginSchema = z.object({
  email: z.string().email("Geçerli bir email adresi girin."),
  password: z.string().min(1, "Şifre boş olamaz."),
});

export const updateProfileSchema = z.object({
  displayName: z.string().max(50).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable().or(z.literal("")),
  profilePublic: z.boolean().optional(),
  listsPublic: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  dndEnabled: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, "Yeni şifre en az 6 karakter olmalı."),
});

export const changeEmailSchema = z.object({
  password: z.string().min(1),
  newEmail: z.string().email("Geçerli bir email adresi girin."),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1),
});
