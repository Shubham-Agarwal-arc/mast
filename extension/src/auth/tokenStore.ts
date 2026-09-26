import type { SecretStorageLike, StoredTokens, TokenPair } from "./types.js";

export const MAST_ACCESS_TOKEN_KEY = "mast.auth.accessToken";
export const MAST_REFRESH_TOKEN_KEY = "mast.auth.refreshToken";

export class MastTokenStore {
  constructor(private readonly secrets: SecretStorageLike) {}

  async save(tokens: TokenPair): Promise<void> {
    const [previousAccess, previousRefresh] = await Promise.all([
      this.secrets.get(MAST_ACCESS_TOKEN_KEY),
      this.secrets.get(MAST_REFRESH_TOKEN_KEY),
    ]);
    try {
      await this.secrets.store(MAST_ACCESS_TOKEN_KEY, tokens.access_token);
      await this.secrets.store(MAST_REFRESH_TOKEN_KEY, tokens.refresh_token);
    } catch (error) {
      await this.restore(MAST_ACCESS_TOKEN_KEY, previousAccess);
      await this.restore(MAST_REFRESH_TOKEN_KEY, previousRefresh);
      throw error;
    }
  }

  async get(): Promise<StoredTokens | undefined> {
    const [accessToken, refreshToken] = await Promise.all([
      this.secrets.get(MAST_ACCESS_TOKEN_KEY),
      this.secrets.get(MAST_REFRESH_TOKEN_KEY),
    ]);
    if (!accessToken || !refreshToken) {
      return undefined;
    }
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async clear(): Promise<void> {
    await Promise.all([
      this.secrets.delete(MAST_ACCESS_TOKEN_KEY),
      this.secrets.delete(MAST_REFRESH_TOKEN_KEY),
    ]);
  }

  private async restore(key: string, value: string | undefined): Promise<void> {
    if (value === undefined) {
      await this.secrets.delete(key);
    } else {
      await this.secrets.store(key, value);
    }
  }
}