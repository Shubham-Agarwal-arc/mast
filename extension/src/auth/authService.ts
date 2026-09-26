import type { AuthGateway, GitHubTokenProvider, TokenPair } from "./types.js";
import { MastTokenStore } from "./tokenStore.js";

export class ExtensionAuthService {
  constructor(
    private readonly github: GitHubTokenProvider,
    private readonly gateway: AuthGateway,
    private readonly tokens: MastTokenStore,
  ) {}

  async signInWithGitHub(): Promise<TokenPair | undefined> {
    const providerToken = await this.github.getGitHubAccessToken();
    if (!providerToken) {
      return undefined;
    }
    const tokenPair = await this.gateway.exchangeGitHubToken(providerToken);
    await this.tokens.save(tokenPair);
    return tokenPair;
  }

  async refresh(): Promise<TokenPair> {
    const currentTokens = await this.tokens.get();
    if (!currentTokens) {
      throw new Error("Sign in with GitHub before refreshing MAST credentials");
    }
    const refreshedTokens = await this.gateway.refreshTokens(currentTokens.refresh_token);
    await this.tokens.save(refreshedTokens);
    return refreshedTokens;
  }
}