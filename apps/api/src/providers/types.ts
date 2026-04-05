import type { ProviderConfig } from '@content-os/shared';

export interface GenerateTextInput {
  systemPrompt: string;
  userPrompt: string;
}

export interface GenerateTextOutput {
  text: string;
}

export interface ModelProvider {
  generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;
}

export class MockProvider implements ModelProvider {
  constructor(private readonly providerConfig: ProviderConfig) {}

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    return {
      text: `[${this.providerConfig.provider}:${this.providerConfig.model}] ${input.userPrompt}`
    };
  }
}
