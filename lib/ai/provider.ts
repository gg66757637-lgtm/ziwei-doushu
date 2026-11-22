/**
 * OpenAI-compatible chat provider resolution.
 * Default is Zhipu's free Flash model (official docs: open.bigmodel.cn / docs.bigmodel.cn).
 */
export type ProviderName = 'zhipu' | 'deepseek' | 'mimo';

export interface AiProviderConfig {
  name: ProviderName;
  baseUrl: string;
  model: string;
  apiKey: string;
  keyEnv: string;
}

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiConfigError';
  }
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

/**
 * Official Zhipu OpenAI-compatible base URL:
 * https://docs.bigmodel.cn/cn/api/introduction
 * Chat completions: POST {base}/chat/completions
 *
 * Official free Flash model id (2026 docs):
 * https://docs.bigmodel.cn/cn/guide/models/free/glm-4-flash-250414
 * API enum uses `glm-4-flash-250414`. The older alias `glm-4-flash` may still work;
 * override with ZHIPU_MODEL if needed.
 */
export const ZHIPU_DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';
export const ZHIPU_DEFAULT_MODEL = 'glm-4-flash-250414';

export const DEEPSEEK_DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
export const DEEPSEEK_DEFAULT_MODEL = 'deepseek-chat';

export function resolveAiProvider(): AiProviderConfig {
  const raw = env('AI_PROVIDER').toLowerCase() || 'zhipu';

  if (raw === 'zhipu' || raw === 'glm' || raw === 'bigmodel') {
    return {
      name: 'zhipu',
      baseUrl: trimSlash(env('ZHIPU_BASE_URL') || ZHIPU_DEFAULT_BASE_URL),
      model: env('ZHIPU_MODEL') || ZHIPU_DEFAULT_MODEL,
      apiKey: env('ZHIPU_API_KEY'),
      keyEnv: 'ZHIPU_API_KEY',
    };
  }

  if (raw === 'deepseek') {
    return {
      name: 'deepseek',
      baseUrl: trimSlash(env('DEEPSEEK_BASE_URL') || DEEPSEEK_DEFAULT_BASE_URL),
      model: env('DEEPSEEK_MODEL') || DEEPSEEK_DEFAULT_MODEL,
      apiKey: env('DEEPSEEK_API_KEY'),
      keyEnv: 'DEEPSEEK_API_KEY',
    };
  }

  if (raw === 'mimo') {
    return {
      name: 'mimo',
      baseUrl: trimSlash(env('MIMO_BASE_URL')),
      model: env('MIMO_MODEL'),
      apiKey: env('MIMO_API_KEY'),
      keyEnv: 'MIMO_API_KEY',
    };
  }

  throw new AiConfigError(
    `不支持的 AI_PROVIDER=${raw}。可选：zhipu（默认，智谱免费 glm-4-flash）、deepseek、mimo。`,
  );
}

export function requireAiProvider(): AiProviderConfig {
  const cfg = resolveAiProvider();
  if (!cfg.apiKey) {
    throw new AiConfigError(
      `未配置 ${cfg.keyEnv}。请在项目根目录的 .env.local 中填写该密钥后重试（当前 AI_PROVIDER=${cfg.name}）。获取智谱免费密钥：https://open.bigmodel.cn/`,
    );
  }
  if (!cfg.baseUrl || !cfg.model) {
    throw new AiConfigError(
      `AI_PROVIDER=${cfg.name} 缺少接口地址或模型名。mimo 需要同时设置 MIMO_BASE_URL、MIMO_MODEL、MIMO_API_KEY。`,
    );
  }
  return cfg;
}
