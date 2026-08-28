import { z } from "zod";

export const courseSchema = z.object({
  code: z.string().trim().min(2).max(40),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(3).max(4000),
  objective: z.string().trim().max(2000).optional(),
  targetAudience: z.string().trim().max(500).optional(),
  category: z.string().trim().max(100).optional(),
  level: z.string().trim().max(100).optional(),
  durationMin: z.coerce.number().int().min(0).max(100000).default(0),
  imageUrl: z.string().trim().url().max(1000).optional().or(z.literal("")),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  passingScore: z.coerce.number().int().min(1).max(100).default(80),
  maxAttempts: z.coerce.number().int().min(1).max(20).default(3),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
});

export const moduleSchema = z.object({
  title: z.string().trim().min(3).max(200),
  order: z.coerce.number().int().min(1).max(1000),
});

export const lessonSchema = z.object({
  title: z.string().trim().min(3).max(200),
  order: z.coerce.number().int().min(1).max(1000),
  contentType: z.enum(["RICH_TEXT", "VIDEO", "PDF", "DOCUMENT", "LINK", "IMAGE"]),
  bodyHtml: z.string().max(50000).optional(),
  externalUrl: z.string().trim().url().max(1000).optional().or(z.literal("")),
  fileId: z.string().cuid().optional(),
  normReference: z.string().trim().max(1000).optional(),
  normCode: z.string().trim().max(100).optional(),
  normArticle: z.string().trim().max(100).optional(),
  normYear: z.coerce.number().int().min(1900).max(2100).optional(),
  normVersion: z.string().trim().max(50).optional(),
  normSource: z.string().trim().max(300).optional(),
  normReviewedAt: z.coerce.date().optional(),
});

export const assignmentSchema = z.object({
  targetType: z.enum(["USER", "COMPANY", "AREA", "POSITION", "ALL"]),
  userId: z.string().cuid().optional(),
  targetValue: z.string().trim().max(200).optional(),
  mandatory: z.boolean().default(true),
  dueAt: z.coerce.date().optional(),
});
