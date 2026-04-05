import { z } from 'zod';

export const ContentBriefSchema = z.object({
  topic: z.string().min(1),
  audience: z.string().optional(),
  goal: z.string().optional(),
  tone: z.string().optional(),
  format: z.string().optional(),
  depth: z.enum(['basic', 'intermediate', 'advanced']).optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  pointOfView: z.string().optional(),
  coreArguments: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  seoKeywords: z.array(z.string()).optional(),
  callToAction: z.string().optional(),
  titleHints: z.array(z.string()).optional(),
  completenessScore: z.number(),
  missingFields: z.array(z.string()),
  ready: z.boolean()
});

export const UserMessageInputSchema = z.object({
  content: z.string().min(1)
});

export type UserMessageInput = z.infer<typeof UserMessageInputSchema>;
