import { z } from 'zod';

// ============================================================================
// PROVIDER CONFIGURATION SCHEMAS
// ============================================================================

export const OpenAIConfigSchema = z.object({
  type: z.literal('openai'),
  apiKey: z.string().min(1, 'API key is required'),
  model: z.string().default('gpt-4o-mini'),
});

export type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>;

export const OpenAICompatibleConfigSchema = z.object({
  type: z.literal('openai-compatible'),
  apiKey: z.string().min(1, 'API key is required').optional(),
  baseUrl: z.string().url('Must be a valid URL'),
  model: z.string().min(1, 'Model name is required'),
});

export type OpenAICompatibleConfig = z.infer<
  typeof OpenAICompatibleConfigSchema
>;

export const ProviderConfigSchema = z.discriminatedUnion('type', [
  OpenAIConfigSchema,
  OpenAICompatibleConfigSchema,
]);

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

// ============================================================================
// MODEL PROVIDER INTERFACE
// ============================================================================

export interface CompletionParams {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface CompletionResponse {
  content: string;
  tokensUsed?: number;
  model: string;
}

export interface ModelProvider {
  config: ProviderConfig;
  complete(params: CompletionParams): Promise<CompletionResponse>;
  validateConfig(): Promise<boolean>;
}

// ============================================================================
// PROVIDER FACTORY
// ============================================================================

export class ModelProviderFactory {
  static create(config: ProviderConfig): ModelProvider {
    if (config.type === 'openai') {
      return new OpenAIProvider(config);
    } else if (config.type === 'openai-compatible') {
      return new OpenAICompatibleProvider(config);
    }

    throw new Error(`Unknown provider type: ${(config as any).type}`);
  }
}

// ============================================================================
// OPENAI PROVIDER
// ============================================================================

class OpenAIProvider implements ModelProvider {
  config: OpenAIConfig;
  private client: any; // Will be dynamically imported

  constructor(config: OpenAIConfig) {
    this.config = config;
  }

  async complete(params: CompletionParams): Promise<CompletionResponse> {
    // Dynamically import OpenAI client (Node.js environment)
    const { default: OpenAI } = await import('openai');

    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
      });
    }

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 2000,
      top_p: params.topP ?? 1,
    });

    return {
      content:
        response.choices[0]?.message?.content || '',
      tokensUsed: response.usage?.total_tokens,
      model: this.config.model,
    };
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await this.complete({
        messages: [{ role: 'user', content: 'Hello' }],
      });
      return !!response.content;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// OPENAI-COMPATIBLE PROVIDER (Ollama, etc)
// ============================================================================

class OpenAICompatibleProvider implements ModelProvider {
  config: OpenAICompatibleConfig;
  private client: any;

  constructor(config: OpenAICompatibleConfig) {
    this.config = config;
  }

  async complete(params: CompletionParams): Promise<CompletionResponse> {
    // Dynamically import OpenAI client with custom base URL
    const { default: OpenAI } = await import('openai');

    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.config.apiKey || 'not-needed',
        baseURL: this.config.baseUrl,
      });
    }

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 2000,
      top_p: params.topP ?? 1,
    });

    return {
      content:
        response.choices[0]?.message?.content || '',
      tokensUsed: response.usage?.total_tokens,
      model: this.config.model,
    };
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await this.complete({
        messages: [{ role: 'user', content: 'Hello' }],
      });
      return !!response.content;
    } catch {
      return false;
    }
  }
}
