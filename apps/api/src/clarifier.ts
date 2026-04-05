import { Brief, ClarifyingQuestion, ModelProvider } from '@content-os/shared';

// ============================================================================
// CLARIFIER SYSTEM
// ============================================================================

/**
 * The Clarifier generates and manages clarifying questions to refine user briefs.
 * It uses AI to generate contextual questions, tracks answers, and determines when
 * the brief is ready to proceed to outline generation.
 */
export class Clarifier {
  constructor(private modelProvider: ModelProvider) {}

  /**
   * Generate clarifying questions for a user prompt
   */
  async generateQuestions(userPrompt: string): Promise<ClarifyingQuestion[]> {
    const systemPrompt = `You are a content strategy expert. Your task is to ask clarifying questions 
to better understand the user's content needs. Generate exactly 5 clarifying questions that cover:
- Target audience
- Content tone/style
- Specific goals or outcomes
- Content format preferences
- Any specific requirements or constraints

Return your response as a JSON array with objects containing:
- id: unique identifier (q1, q2, etc.)
- question: the clarifying question text
- category: one of [topic, audience, tone, length, format, other]

Make questions conversational and specific to the user's prompt.`;

    const response = await this.modelProvider.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `User's initial idea: "${userPrompt}"`,
        },
      ],
      temperature: 0.7,
      maxTokens: 1000,
    });

    try {
      // Extract JSON from response
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return this.generateDefaultQuestions();
      }

      const questions = JSON.parse(jsonMatch[0]);
      return questions.map((q: any) => ({
        id: q.id || `q_${Math.random().toString(36).substr(2, 9)}`,
        question: q.question,
        category: q.category || 'other',
        userAnswer: undefined,
      }));
    } catch (error) {
      console.error('[Clarifier] Error parsing questions:', error);
      return this.generateDefaultQuestions();
    }
  }

  /**
   * Refine the initial prompt based on user answers
   */
  async refineBrief(
    userPrompt: string,
    questions: ClarifyingQuestion[]
  ): Promise<string> {
    const answers = questions
      .map((q) => `Q: ${q.question}\nA: ${q.userAnswer}`)
      .join('\n\n');

    const systemPrompt = `You are a content strategist. Based on the user's initial idea and their 
answers to clarifying questions, create a comprehensive, refined brief that will guide content creation.

The refined brief should:
- Synthesize all information into a clear, cohesive brief
- Highlight key objectives and target audience
- Note important constraints or preferences
- Be detailed enough to guide the next stages (outline, write, edit)
- Be 3-5 paragraphs long`;

    const response = await this.modelProvider.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Initial idea: "${userPrompt}"\n\n${answers}`,
        },
      ],
      temperature: 0.7,
      maxTokens: 1500,
    });

    return response.content;
  }

  /**
   * Determine if a brief is ready to proceed
   */
  isBriefReady(brief: Brief): boolean {
    // Brief is ready if:
    // 1. All questions have been answered
    // 2. Refined prompt has been generated
    const allAnswered = brief.clarifyingQuestions.every(
      (q) => q.userAnswer && q.userAnswer.trim().length > 0
    );

    return allAnswered && !!brief.refinedPrompt;
  }

  /**
   * Default fallback questions if generation fails
   */
  private generateDefaultQuestions(): ClarifyingQuestion[] {
    return [
      {
        id: 'q1',
        question: 'Who is the primary audience for this content?',
        category: 'audience',
      },
      {
        id: 'q2',
        question: 'What tone or style would you prefer? (e.g., professional, casual, humorous)',
        category: 'tone',
      },
      {
        id: 'q3',
        question: 'What is the main goal or outcome you want from this content?',
        category: 'topic',
      },
      {
        id: 'q4',
        question: 'How long should this content be? (e.g., short 500-word post, longer 2000+ word article)',
        category: 'length',
      },
      {
        id: 'q5',
        question: 'Are there any specific requirements, constraints, or topics to avoid?',
        category: 'other',
      },
    ];
  }
}
