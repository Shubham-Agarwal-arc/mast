import type { AuthGateway, TokenPair } from "./types.js";

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface GatewayChatRequest {
  message: string;
  error_text?: string;
  error_category?: string;
  classification_confidence?: number;
  kc_ids?: string[];
  mastery_by_kc: Record<string, number>;
  retrieved_context: string[];
  hint_depth: number;
}

export interface GatewayChatResponse {
  response: string;
  interactionId?: string;
}

export interface GatewayFeedbackRequest {
  interaction_id: string;
  resolved: boolean;
  mastery_delta?: number;
}

export class GatewayApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "GatewayApiError";
  }
}

function validateTokenPair(value: unknown): TokenPair {
  if (typeof value !== "object" || value === null) {
    throw new GatewayApiError("Gateway returned an invalid token response");
  }
  const response = value as Partial<TokenPair>;
  if (
    typeof response.access_token !== "string" ||
    !response.access_token ||
    typeof response.refresh_token !== "string" ||
    !response.refresh_token ||
    response.token_type !== "bearer" ||
    typeof response.expires_in !== "number" ||
    !Number.isFinite(response.expires_in) ||
    response.expires_in <= 0
  ) {
    throw new GatewayApiError("Gateway returned an invalid token response");
  }
  return response as TokenPair;
}

function isLoopback(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized.endsWith(".localhost") || normalized === "127.0.0.1" || normalized === "::1";
}

export function normalizeGatewayBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new GatewayApiError("Set a valid MAST Gateway URL in extension settings");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback(url.hostname))) {
    throw new GatewayApiError("The MAST Gateway URL must use HTTPS (HTTP is allowed only for localhost development)");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new GatewayApiError("The MAST Gateway URL must not contain credentials, query parameters, or a fragment");
  }
  return url.toString().replace(/\/+$/, "");
}

export class GatewayApiClient implements AuthGateway {
  private readonly baseUrl: string;

  constructor(baseUrl: string, private readonly fetcher: FetchLike = globalThis.fetch.bind(globalThis)) {
    this.baseUrl = normalizeGatewayBaseUrl(baseUrl);
  }

  exchangeGitHubToken(accessToken: string): Promise<TokenPair> {
    if (!accessToken.trim()) {
      throw new GatewayApiError("GitHub did not provide an access token");
    }
    return this.postTokenPair("/v1/auth/github", { access_token: accessToken });
  }

  refreshTokens(refreshToken: string): Promise<TokenPair> {
    if (!refreshToken.trim()) {
      throw new GatewayApiError("No MAST refresh token is stored");
    }
    return this.postTokenPair("/v1/auth/refresh", { refresh_token: refreshToken });
  }

  async chat(accessToken: string, payload: GatewayChatRequest): Promise<GatewayChatResponse> {
    if (!accessToken.trim()) {
      throw new GatewayApiError("Sign in with GitHub before starting a MAST chat");
    }
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}/v1/chat`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new GatewayApiError("Could not reach the MAST Gateway");
    }
    if (!response.ok) {
      const message = response.status === 429
        ? "MAST chat quota is temporarily unavailable. Your draft is still here."
        : response.status === 401
          ? "Your MAST sign-in has expired. Refresh your sign-in and try again."
          : "MAST could not complete this chat. Your draft is still here.";
      throw new GatewayApiError(message, response.status);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new GatewayApiError("MAST Gateway returned an invalid chat response", response.status);
    }
    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as Partial<GatewayChatResponse>).response !== "string" ||
      !(body as Partial<GatewayChatResponse>).response?.trim()
    ) {
      throw new GatewayApiError("MAST Gateway returned an invalid chat response", response.status);
    }
    const interactionId = response.headers.get("X-MAST-Interaction-ID");
    return {
      response: (body as GatewayChatResponse).response,
      ...(interactionId ? { interactionId } : {}),
    };
  }

  async feedback(accessToken: string, payload: GatewayFeedbackRequest): Promise<void> {
    if (!accessToken.trim()) {
      throw new GatewayApiError("Sign in with GitHub before sending MAST feedback");
    }
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}/v1/feedback`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new GatewayApiError("Could not reach the MAST Gateway");
    }
    if (!response.ok) {
      throw new GatewayApiError("MAST feedback could not be recorded", response.status);
    }
  }

  private async postTokenPair(path: string, payload: Record<string, string>): Promise<TokenPair> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new GatewayApiError("Could not reach the MAST Gateway");
    }
    if (!response.ok) {
      throw new GatewayApiError(`MAST Gateway authentication failed (${response.status})`, response.status);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new GatewayApiError("MAST Gateway returned an invalid response", response.status);
    }
    return validateTokenPair(body);
  }
}