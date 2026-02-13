import fs from 'fs';
import path from 'path';
import { config as dotenvConfig } from 'dotenv';
import type { Config, LLMProvider, LLMConfig, LLMModeConfig } from '../core/types.js';

export class ConfigLoader {
  private config: Config;

  constructor(configPath?: string) {
    // Load .env file
    dotenvConfig();

    // Load configuration
    this.config = this.loadConfig(configPath);
  }

  private loadConfig(configPath?: string): Config {
    // 1. Start with default config
    const defaultConfig = this.getDefaultConfig();

    // 2. Load user config file if exists
    const userConfig = this.loadConfigFile(configPath);

    // 3. Override with environment variables (최우선)
    const envConfig = this.loadEnvConfig();

    // 4. Merge all configs (env가 최우선)
    const merged = this.mergeConfigs(defaultConfig, userConfig, envConfig);

    // 5. Inject API keys from environment
    this.injectApiKeys(merged);

    return merged;
  }

  private getDefaultConfig(): Config {
    return {
      llm: {
        provider: 'anthropic',
        model: 'claude-sonnet-4.5',
        maxTokens: 8096,
        temperature: 0.7,
      },
      telegram: {
        enabled: false,
      },
      tools: {
        gui: {
          enabled: true,
          screenCaptureInterval: 1000,
        },
        builtin: {
          filesystem: true,
          websearch: false,
          codeExecutor: false,
        },
      },
      agent: {
        maxIterations: 10,
      },
    };
  }

  private loadConfigFile(configPath?: string): Partial<Config> {
    const paths = [
      configPath,
      path.join(process.cwd(), 'config', 'config.json'),
      path.join(process.cwd(), 'config.json'),
    ].filter((p): p is string => p !== undefined);

    for (const p of paths) {
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, 'utf-8');
          return JSON.parse(content);
        } catch (error) {
          console.warn(`Failed to load config from ${p}:`, error);
        }
      }
    }

    return {};
  }

  private loadEnvConfig(): Partial<Config> {
    const envConfig: Partial<Config> = {};

    // ===== LLM Config from env =====
    // DEFAULT가 있으면 모드 설정으로 처리
    if (process.env.DEFAULT_PROVIDER) {
      const defaultConfig = this.loadLLMConfigFromEnv('DEFAULT');
      const fastConfig = this.loadLLMConfigFromEnv('FAST');
      const visionConfig = this.loadLLMConfigFromEnv('VISION');

      envConfig.llm = {
        default: defaultConfig,
        // FAST/VISION 설정 없으면 DEFAULT 사용
        fast: fastConfig.provider ? fastConfig : defaultConfig,
        vision: visionConfig.provider ? visionConfig : defaultConfig,
      } as LLMModeConfig;
    }

    // ===== Agent Config from env =====
    if (process.env.AGENT_MAX_ITERATIONS) {
      envConfig.agent = {
        maxIterations: parseInt(process.env.AGENT_MAX_ITERATIONS, 10),
      };
    }

    // ===== Telegram Config from env =====
    if (process.env.TELEGRAM_ENABLED || process.env.TELEGRAM_BOT_TOKEN) {
      envConfig.telegram = {
        enabled: process.env.TELEGRAM_ENABLED === 'true',
        botToken: process.env.TELEGRAM_BOT_TOKEN,
      };
    }

    return envConfig;
  }

  /**
   * Load LLM config from environment variables with prefix
   * @param prefix - 'LLM', 'DEFAULT', 'FAST', 'VISION'
   */
  private loadLLMConfigFromEnv(prefix: string): LLMConfig {
    const config: Partial<LLMConfig> = {};

    const provider = process.env[`${prefix}_PROVIDER`];
    if (provider) {
      config.provider = provider as LLMProvider;
    }

    const model = process.env[`${prefix}_MODEL`];
    if (model) {
      config.model = model;
    }

    const maxTokens = process.env[`${prefix}_MAX_TOKENS`];
    if (maxTokens) {
      config.maxTokens = parseInt(maxTokens, 10);
    }

    const temperature = process.env[`${prefix}_TEMPERATURE`];
    if (temperature) {
      config.temperature = parseFloat(temperature);
    }

    return config as LLMConfig;
  }

  /**
   * Inject API keys from environment to LLM config
   */
  private injectApiKeys(config: Config): void {
    // Check if mode config
    if (this.isModeConfig(config.llm)) {
      const modeConfig = config.llm as LLMModeConfig;
      this.injectApiKeyToLLMConfig(modeConfig.default);
      this.injectApiKeyToLLMConfig(modeConfig.fast);
      this.injectApiKeyToLLMConfig(modeConfig.vision);
    } else {
      this.injectApiKeyToLLMConfig(config.llm as LLMConfig);
    }
  }

  /**
   * Inject API key to single LLM config
   */
  private injectApiKeyToLLMConfig(llmConfig: LLMConfig): void {
    if (!llmConfig.provider) return;

    const apiKey = this.getApiKeyForProvider(llmConfig.provider);
    if (apiKey) {
      llmConfig.apiKey = apiKey;
    }

    // Ollama base URL
    if (llmConfig.provider === 'ollama' && process.env.OLLAMA_BASE_URL) {
      llmConfig.baseUrl = process.env.OLLAMA_BASE_URL;
    }
  }

  /**
   * Check if mode config
   */
  private isModeConfig(llm: LLMConfig | LLMModeConfig): llm is LLMModeConfig {
    return 'default' in llm && 'fast' in llm && 'vision' in llm;
  }

  private getApiKeyForProvider(provider: LLMProvider): string | undefined {
    switch (provider) {
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY;
      case 'openai':
        return process.env.OPENAI_API_KEY;
      case 'google':
        return process.env.GOOGLE_API_KEY;
      case 'ollama':
        return undefined; // Ollama doesn't need API key
      default:
        return undefined;
    }
  }

  private mergeConfigs(...configs: Array<Partial<Config>>): Config {
    let result: Partial<Config> = {};

    for (const config of configs) {
      result = this.deepMerge(result, config);
    }

    return result as Config;
  }

  private deepMerge<T extends Record<string, unknown>>(target: T, source: T): T {
    const output = { ...target };

    for (const key in source) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (this.isObject(sourceValue) && this.isObject(targetValue)) {
        output[key] = this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[Extract<keyof T, string>];
      } else {
        output[key] = sourceValue;
      }
    }

    return output;
  }

  private isObject(item: unknown): item is Record<string, unknown> {
    return item !== null && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Get the loaded configuration
   */
  get(): Config {
    return this.config;
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate LLM config
    if (this.isModeConfig(this.config.llm)) {
      const modeConfig = this.config.llm as LLMModeConfig;
      errors.push(...this.validateLLMConfig(modeConfig.default, 'default'));
      errors.push(...this.validateLLMConfig(modeConfig.fast, 'fast'));
      errors.push(...this.validateLLMConfig(modeConfig.vision, 'vision'));
    } else {
      errors.push(...this.validateLLMConfig(this.config.llm as LLMConfig));
    }

    // Validate Telegram config
    if (this.config.telegram.enabled && !this.config.telegram.botToken) {
      errors.push('Telegram bot token required when Telegram is enabled');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate single LLM config
   */
  private validateLLMConfig(llmConfig: LLMConfig, mode?: string): string[] {
    const errors: string[] = [];
    const label = mode ? `LLM config (${mode})` : 'LLM config';

    if (!llmConfig.provider) {
      errors.push(`${label}: provider not specified`);
      return errors;
    }

    if (llmConfig.provider !== 'ollama' && !llmConfig.apiKey) {
      errors.push(`${label}: API key required for ${llmConfig.provider}`);
    }

    if (llmConfig.provider === 'ollama' && !llmConfig.baseUrl) {
      errors.push(`${label}: baseUrl required for Ollama`);
    }

    if (!llmConfig.model) {
      errors.push(`${label}: model not specified`);
    }

    return errors;
  }
}
