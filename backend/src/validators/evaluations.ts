import { z } from "zod";

export const evaluationSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  passingScore: z.coerce.number().int().min(1).max(100).default(80),
  timeLimitMin: z.coerce.number().int().min(1).max(600).optional(),
  maxAttempts: z.coerce.number().int().min(1).max(20).default(3),
  shuffleQuestions: z.coerce.boolean().default(true),
  shuffleAnswers: z.coerce.boolean().default(true),
  showCorrectAnswers: z.coerce.boolean().default(false),
});

const answerOptionSchema = z.object({
  text: z.string().trim().min(1).max(500),
  isCorrect: z.boolean().default(false),
  order: z.coerce.number().int().min(1).max(50),
  matchKey: z.string().trim().max(200).optional(),
});

export const questionSchema = z
  .object({
    type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "MATCHING", "SHORT_ANSWER"]),
    text: z.string().trim().min(3).max(2000),
    order: z.coerce.number().int().min(1).max(200),
    points: z.coerce.number().int().min(1).max(100).default(1),
    options: z.array(answerOptionSchema).max(20).default([]),
  })
  .superRefine((data, ctx) => {
    if (["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "MATCHING"].includes(data.type)) {
      if (data.options.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Se requieren al menos 2 opciones." });
      }
      if (!data.options.some((o) => o.isCorrect)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe marcar al menos una respuesta correcta." });
      }
      if (data.type === "SINGLE_CHOICE" || data.type === "TRUE_FALSE") {
        if (data.options.filter((o) => o.isCorrect).length !== 1) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Este tipo admite exactamente una respuesta correcta." });
        }
      }
    }
  });

export const submitAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().cuid(),
        selectedOptionIds: z.array(z.string().cuid()).max(20).optional(),
        shortAnswerText: z.string().trim().max(2000).optional(),
      })
    )
    .min(1),
});
