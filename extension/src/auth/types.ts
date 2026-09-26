export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
}

export interface SecretStorageLike {
  get(key: string): Thenable<string | undefined> | Promise<string | undefined>;
  store(key: string, value: string): Thenable<void> | Promise<void>;
  delete(key: string): Thenable<void> | Promise<void>;
}

export type AuthMode = "managed" | "byok";

export interface GitHubTokenProvider {
  getGitHubAccessToken(): Promise<string | undefined>;
}

export interface AuthGateway {
  exchangeGitHubToken(accessToken: string): Promise<TokenPair>;
  refreshTokens(refreshToken: string): Promise<TokenPair>;
}

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
}