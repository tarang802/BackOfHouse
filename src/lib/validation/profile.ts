import { z } from "zod";

export const RESERVED_USERNAMES = new Set(["admin", "owner", "club", "new", "settings", "me", "null", "undefined", "support"]);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Usernames need at least 3 characters.")
  .max(20, "Usernames can be at most 20 characters.")
  .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores only.")
  .refine((value) => !RESERVED_USERNAMES.has(value), "That username is reserved.");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter the name your friends know you by.")
  .max(40, "Display names can be at most 40 characters.");

export const emblemSchema = z.enum(["spade", "heart", "diamond", "club"]);

export const profileSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  emblem: emblemSchema,
});

export const clubNameSchema = z
  .string()
  .trim()
  .min(2, "Club names need at least 2 characters.")
  .max(60, "Club names can be at most 60 characters.");

export const createClubSchema = z.object({
  name: clubNameSchema,
  tagline: z.string().trim().max(120, "Taglines can be at most 120 characters.").optional(),
  timezone: z.string().trim().max(64).optional(),
});

export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((value) => value.replace(/[^A-Z0-9]/g, ""))
  .pipe(z.string().regex(/^[A-Z0-9]{8}$/, "Invitation codes are 8 letters and numbers."));

/** Suggests a username from a display name: "Arjun Mehta" -> "arjun_mehta". */
export function suggestUsername(displayName: string): string {
  const base = displayName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  return base.length >= 3 ? base : `${base}_player`.replace(/^_/, "").slice(0, 20);
}
