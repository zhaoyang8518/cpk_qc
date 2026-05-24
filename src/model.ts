import { invoke } from "@tauri-apps/api/core";

export type ModelProvider = "none" | "ollama" | "openai" | "custom";

export type ModelSettings = {
  enabled: boolean;
  provider: ModelProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
  isManual?: boolean;
};

export type ModelConnectionResult = {
  ok: boolean;
  source: "provider" | "registry" | "tauri" | string;
  models: string[];
  message: string;
};

const SETTINGS_KEY = "cpk-qc:model-settings";
const API_KEY_STORAGE_KEY = "cpk-qc:api-key";

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  enabled: false,
  provider: "ollama",
  baseUrl: "http://127.0.0.1:11434",
  model: "qwen2.5:3b",
  apiKey: "",
  isManual: false,
};

export async function loadModelSettings(): Promise<ModelSettings> {
  let apiKey = "";

  if (isTauriRuntime()) {
    try {
      apiKey = await invoke<string>("get_secure_api_key");
    } catch {
      apiKey = "";
    }
  } else {
    apiKey = localStorage.getItem(API_KEY_STORAGE_KEY) || "";
  }

  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_MODEL_SETTINGS, apiKey };

  try {
    return { ...DEFAULT_MODEL_SETTINGS, ...JSON.parse(raw), apiKey };
  } catch {
    return { ...DEFAULT_MODEL_SETTINGS, apiKey };
  }
}

export async function saveModelSettings(settings: ModelSettings) {
  const { apiKey, ...rest } = settings;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest));

  if (isTauriRuntime()) {
    try {
      await invoke("save_secure_api_key", { apiKey });
    } catch (err) {
      console.error("Failed to save API key securely:", err);
    }
  } else {
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
  }
}

export async function testModelConnection(settings: ModelSettings): Promise<ModelConnectionResult> {
  if (isTauriRuntime()) {
    try {
      return await invoke<ModelConnectionResult>("test_model_connection", { settings });
    } catch (err) {
      return {
        ok: false,
        source: "tauri",
        models: fallbackModels(settings.provider),
        message: `Tauri invocation failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  try {
    if (settings.provider === "ollama") {
      const models = await fetchOllamaModels(settings);
      return {
        ok: true,
        source: "provider",
        models,
        message:
          models.length > 0
            ? `Connected to Ollama at ${settings.baseUrl}. Found ${models.length} model(s): ${models.join(", ")}`
            : `Connected to Ollama at ${settings.baseUrl}, but no models installed.`,
      };
    }

    if (settings.provider === "openai" || settings.provider === "custom") {
      const models = await fetchOpenAICompatibleModels(settings);
      return {
        ok: true,
        source: "provider",
        models,
        message: `Connected successfully. Found ${models.length} model(s).`,
      };
    }
  } catch (err) {
    return {
      ok: false,
      source: "provider",
      models: fallbackModels(settings.provider),
      message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const models = fallbackModels(settings.provider);
  return {
    ok: false,
    source: "registry",
    models,
    message: "Connection test is available for Ollama, OpenAI, and custom OpenAI-compatible providers.",
  };
}

async function fetchOllamaModels(settings: ModelSettings): Promise<string[]> {
  const baseUrl = trimSlash(settings.baseUrl || "http://127.0.0.1:11434");
  const response = await fetch(`${baseUrl}/api/tags`, {
    method: "GET",
    headers: { "content-type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return (data.models || []).map((model: any) => model.name || model).filter(Boolean);
}

async function fetchOpenAICompatibleModels(settings: ModelSettings): Promise<string[]> {
  const baseUrl = trimSlash(settings.baseUrl || defaultBaseUrl(settings.provider));
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (settings.apiKey) headers.authorization = `Bearer ${settings.apiKey}`;

  const response = await fetch(`${baseUrl}/models`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`${settings.provider} returned ${response.status}`);
  }

  const data = await response.json();
  return (data.data || []).map((model: any) => model.id).filter(Boolean);
}

export function fallbackModels(provider: ModelProvider): string[] {
  if (provider === "ollama") return ["qwen2.5:3b", "qwen2.5:7b", "llama3.2:3b", "gemma2:2b"];
  if (provider === "openai") return ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"];
  return [];
}

function defaultBaseUrl(provider: ModelProvider): string {
  if (provider === "openai") return "https://api.openai.com/v1";
  return "";
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

