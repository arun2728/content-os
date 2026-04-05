import type { ProviderConfig } from '@content-os/shared';
import { MockProvider, type ModelProvider } from './types.js';

export function createProvider(config: ProviderConfig): ModelProvider {
  return new MockProvider(config);
}
