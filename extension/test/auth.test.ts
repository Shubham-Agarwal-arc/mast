import assert from "node:assert/strict";
import test from "node:test";

import { ExtensionAuthService } from "../src/auth/authService.js";
import { AuthModeService, parseAuthMode } from "../src/auth/authMode.js";
import { BYOK_API_KEY_KEY, ByokSecretStore } from "../src/auth/byokStore.js";
import { GatewayApiClient, GatewayApiError, normalizeGatewayBaseUrl } from "../src/auth/gatewayClient.js";
import { MAST_ACCESS_TOKEN_KEY, MAST_REFRESH_TOKEN_KEY, MastTokenStore } from "../src/auth/tokenStore.js";
import { VscodeGitHubTokenProvider } from "../src/auth/vscodeGitHubTokenProvider.js";
import type { SecretStorageLike, TokenPair } from "../src/auth/types.js";

class MemorySecretStorage implements SecretStorageLike {
  readonly values = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.values.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

const firstPair: TokenPair = {
  access_token: "mast-access-first",
  refresh_token: "mast-refresh-first",
  token_type: "bearer",
  expires_in: 900,
};

const refreshedPair: TokenPair = {
  access_token: "mast-access-next",
  refresh_token: "mast-refresh-next",
  token_type: "bearer",
  expires_in: 900,
};

test("VS Code GitHub adapter requests only read:user and returns the provider token", async () => {
  const calls: unknown[][] = [];
  const provider = new VscodeGitHubTokenProvider({
    getSession: async (...args) => {
      calls.push(args);
      return { accessToken: "github-provider-token" };
    },
  });

  assert.equal(await provider.getGitHubAccessToken(), "github-provider-token");
  assert.deepEqual(calls, [["github", ["read:user"], { createIfNone: true }]]);
});

test("Gateway client matches the GitHub exchange contract and validates its response", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const client = new GatewayApiClient("https://gateway.example.test/", async (input, init) => {
    requests.push({ url: String(input), init });
    return new Response(JSON.stringify(firstPair), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  assert.deepEqual(await client.exchangeGitHubToken("github-provider-token"), firstPair);
  assert.equal(requests[0].url, "https://gateway.example.test/v1/auth/github");
  assert.equal(requests[0].init?.method, "POST");
  assert.equal(requests[0].init?.headers && (requests[0].init.headers as Record<string, string>)["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), { access_token: "github-provider-token" });
});

test("Gateway refresh uses the existing refresh endpoint contract", async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const client = new GatewayApiClient("http://127.0.0.1:8000", async (input, init) => {
    request = { url: String(input), init };
    return new Response(JSON.stringify(refreshedPair), { status: 200 });
  });

  assert.deepEqual(await client.refreshTokens(firstPair.refresh_token), refreshedPair);
  assert.equal(request?.url, "http://127.0.0.1:8000/v1/auth/refresh");
  assert.deepEqual(JSON.parse(String(request?.init?.body)), { refresh_token: firstPair.refresh_token });
});

test("remote Gateway URLs require HTTPS while localhost HTTP remains available for development", () => {
  assert.equal(normalizeGatewayBaseUrl("http://127.0.0.1:8000/"), "http://127.0.0.1:8000");
  assert.equal(normalizeGatewayBaseUrl("https://gateway.example.test/"), "https://gateway.example.test");
  assert.throws(() => normalizeGatewayBaseUrl("http://gateway.example.test"), /must use HTTPS/);
  assert.throws(() => normalizeGatewayBaseUrl("https://user:pass@gateway.example.test"), /must not contain credentials/);
});

test("GitHub sign-in exchanges the provider token and stores only the MAST pair in SecretStorage", async () => {
  const secrets = new MemorySecretStorage();
  const tokenStore = new MastTokenStore(secrets);
  const calls: string[] = [];
  const service = new ExtensionAuthService(
    { getGitHubAccessToken: async () => "github-provider-token" },
    {
      exchangeGitHubToken: async (token) => {
        calls.push(token);
        return firstPair;
      },
      refreshTokens: async () => refreshedPair,
    },
    tokenStore,
  );

  assert.deepEqual(await service.signInWithGitHub(), firstPair);
  assert.deepEqual(calls, ["github-provider-token"]);
  assert.deepEqual([...secrets.values.keys()].sort(), [MAST_ACCESS_TOKEN_KEY, MAST_REFRESH_TOKEN_KEY].sort());
  assert.deepEqual([...secrets.values.values()].sort(), [firstPair.access_token, firstPair.refresh_token].sort());
  assert.equal([...secrets.values.values()].includes("github-provider-token"), false);
  assert.deepEqual(await tokenStore.get(), {
    access_token: firstPair.access_token,
    refresh_token: firstPair.refresh_token,
  });
});

test("sign-in cancellation makes no Gateway request and refresh rotates both stored tokens", async () => {
  const secrets = new MemorySecretStorage();
  const tokenStore = new MastTokenStore(secrets);
  let exchangeCalls = 0;
  let refreshArgument = "";
  const service = new ExtensionAuthService(
    { getGitHubAccessToken: async () => undefined },
    {
      exchangeGitHubToken: async () => {
        exchangeCalls += 1;
        return firstPair;
      },
      refreshTokens: async (token) => {
        refreshArgument = token;
        return refreshedPair;
      },
    },
    tokenStore,
  );

  assert.equal(await service.signInWithGitHub(), undefined);
  assert.equal(exchangeCalls, 0);
  await tokenStore.save(firstPair);
  assert.deepEqual(await service.refresh(), refreshedPair);
  assert.equal(refreshArgument, firstPair.refresh_token);
  assert.deepEqual(await tokenStore.get(), {
    access_token: refreshedPair.access_token,
    refresh_token: refreshedPair.refresh_token,
  });
});

test("BYOK set/read/clear uses only SecretStorage and is separate from the Gateway", async () => {
  const secrets = new MemorySecretStorage();
  const byok = new ByokSecretStore(secrets);
  let gatewayRequests = 0;
  const gateway = new GatewayApiClient("https://gateway.example.test", async () => {
    gatewayRequests += 1;
    return new Response(JSON.stringify(firstPair), { status: 200 });
  });
  assert.equal(await byok.getApiKey(), undefined);
  await byok.setApiKey("  provider-secret-value  ");
  assert.equal(await byok.getApiKey(), "provider-secret-value");
  assert.deepEqual([...secrets.values.keys()], [BYOK_API_KEY_KEY]);
  assert.equal(gatewayRequests, 0);
  assert.equal(typeof gateway.exchangeGitHubToken, "function");
  await byok.clearApiKey();
  assert.equal(await byok.getApiKey(), undefined);
  assert.equal(secrets.values.size, 0);
  await assert.rejects(byok.setApiKey("  "), /must not be empty/);
});

test("managed/BYOK mode is explicit, defaults to managed, and BYOK requires a SecretStorage key", async () => {
  const secrets = new MemorySecretStorage();
  const byok = new ByokSecretStore(secrets);
  let storedMode: unknown;
  const modes = new AuthModeService(
    {
      get: () => storedMode,
      set: async (mode) => {
        storedMode = mode;
      },
    },
    byok,
  );

  assert.equal(parseAuthMode(undefined), "managed");
  assert.equal(modes.getMode(), "managed");
  await assert.rejects(modes.setMode("byok"), /Configure a provider API key/);
  await byok.setApiKey("provider-secret-value");
  await modes.setMode("byok");
  assert.equal(modes.getMode(), "byok");
  await modes.setMode("managed");
  assert.equal(modes.getMode(), "managed");
  assert.deepEqual([...secrets.values.keys()], [BYOK_API_KEY_KEY]);
  assert.equal(JSON.stringify({ authMode: storedMode }).includes("provider-secret-value"), false);
});

test("malformed Gateway responses and HTTP failures do not expose response bodies", async () => {
  const invalidClient = new GatewayApiClient("https://gateway.example.test", async () =>
    new Response(JSON.stringify({ access_token: "only-half-a-pair" }), { status: 200 }),
  );
  await assert.rejects(invalidClient.exchangeGitHubToken("github-token"), /invalid token response/);

  const failingClient = new GatewayApiClient("https://gateway.example.test", async () =>
    new Response("sensitive server body", { status: 401 }),
  );
  await assert.rejects(failingClient.exchangeGitHubToken("github-token"), (error: unknown) => {
    assert.ok(error instanceof GatewayApiError);
    assert.equal(error.message.includes("sensitive server body"), false);
    assert.equal(error.statusCode, 401);
    return true;
  });
});