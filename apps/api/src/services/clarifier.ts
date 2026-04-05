import type { ContentBrief } from '@content-os/shared';

const REQUIRED_FIELDS: Array<keyof ContentBrief> = ['topic', 'audience', 'goal', 'tone', 'length', 'depth'];

const FIELD_QUESTIONS: Record<string, string> = {
  audience: 'Who is the target audience for this article?',
  goal: 'What outcome do you want readers to have after reading?',
  tone: 'What tone should this article use (e.g. practical, opinionated, technical)?',
  length: 'How long should the article be (short, medium, or long)?',
  depth: 'What technical depth do you want (basic, intermediate, advanced)?',
  coreArguments: 'What are at least 2 key takeaways you want to include?'
};

export interface ClarifierTurnResult {
  extractedUpdates: Partial<ContentBrief>;
  nextQuestion?: string;
  ready: boolean;
  completenessScore: number;
  missingFields: string[];
}

function extractField(content: string, key: string): string | undefined {
  const regex = new RegExp(`${key}\\s*:\\s*([^\\n]+)`, 'i');
  const match = content.match(regex);
  return match?.[1]?.trim();
}

export function applyUserInputToBrief(brief: ContentBrief, content: string): ClarifierTurnResult {
  const updates: Partial<ContentBrief> = {};

  const audience = extractField(content, 'audience');
  const goal = extractField(content, 'goal');
  const tone = extractField(content, 'tone');
  const depth = extractField(content, 'depth')?.toLowerCase() as ContentBrief['depth'];
  const length = extractField(content, 'length')?.toLowerCase() as ContentBrief['length'];
  const args = extractField(content, 'arguments') ?? extractField(content, 'takeaways');

  if (audience) updates.audience = audience;
  if (goal) updates.goal = goal;
  if (tone) updates.tone = tone;
  if (depth && ['basic', 'intermediate', 'advanced'].includes(depth)) updates.depth = depth;
  if (length && ['short', 'medium', 'long'].includes(length)) updates.length = length;
  if (args) {
    updates.coreArguments = args
      .split(',')
      .map((arg) => arg.trim())
      .filter(Boolean);
  }

  const merged = { ...brief, ...updates };
  const missingFields = REQUIRED_FIELDS.filter((field) => {
    const value = merged[field];
    return !value || (Array.isArray(value) && value.length === 0);
  }).map(String);

  if (!merged.coreArguments || merged.coreArguments.length < 2) {
    missingFields.push('coreArguments');
  }

  const maxRequired = REQUIRED_FIELDS.length + 1;
  const completenessScore = Math.max(0, Math.min(1, (maxRequired - missingFields.length) / maxRequired));
  const ready = missingFields.length === 0;

  return {
    extractedUpdates: {
      ...updates,
      missingFields,
      completenessScore,
      ready
    },
    nextQuestion: ready ? undefined : FIELD_QUESTIONS[missingFields[0]],
    ready,
    completenessScore,
    missingFields
  };
}
