import type { GitHubTokenProvider } from "./types.js";

export interface VscodeAuthenticationLike {
  getSession(
    providerId: string,
    scopes: readonly string[],
    options: { createIfNone: boolean },
  ): PromiseLike<{ accessToken: string } | undefined>;
}

export class VscodeGitHubTokenProvider implements GitHubTokenProvider {
  constructor(private readonly authentication: VscodeAuthenticationLike) {}

  async getGitHubAccessToken(): Promise<string | undefined> {
    const session = await this.authentication.getSession("github", ["read:user"], { createIfNone: true });
    return session?.accessToken;
  }
}