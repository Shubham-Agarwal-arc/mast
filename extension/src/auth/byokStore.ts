import type { SecretStorageLike } from "./types.js";

export const BYOK_API_KEY_KEY = "mast.byok.providerApiKey";

export class ByokSecretStore {
  constructor(private readonly secrets: SecretStorageLike) {}

  async setApiKey(apiKey: string): Promise<void> {
    if (!apiKey.trim()) {
      throw new Error("API key must not be empty");
    }
    await this.secrets.store(BYOK_API_KEY_KEY, apiKey.trim());
  }

  async getApiKey(): Promise<string | undefined> {
    return await this.secrets.get(BYOK_API_KEY_KEY);
  }

  async clearApiKey(): Promise<void> {
    await this.secrets.delete(BYOK_API_KEY_KEY);
  }
}