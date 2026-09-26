import type { AuthMode } from "./types.js";
import { ByokSecretStore } from "./byokStore.js";

export interface AuthModePreferences {
  get(): unknown;
  set(mode: AuthMode): Promise<void>;
}

export function parseAuthMode(value: unknown): AuthMode {
  return value === "byok" ? "byok" : "managed";
}

export class AuthModeService {
  constructor(
    private readonly preferences: AuthModePreferences,
    private readonly byokKeys: ByokSecretStore,
  ) {}

  getMode(): AuthMode {
    return parseAuthMode(this.preferences.get());
  }

  async setMode(mode: AuthMode): Promise<void> {
    if (mode === "byok" && !(await this.byokKeys.getApiKey())) {
      throw new Error("Configure a provider API key before selecting BYOK mode");
    }
    await this.preferences.set(mode);
  }
}