/**
 * 多模型路由 - 根据企业配置选择 AI 生成模型
 *
 * 优先级：
 * 1. 企业自有 Key（ai_model_config 表中配置的）
 * 2. 平台加油包（ai_package_expires_at 未过期）
 * 3. 拒绝生成（返回需购买或配置的提示）
 */
import { generateText as generateWithAgnes } from './agnes';

// 支持的模型供应商列表
export const SUPPORTED_PROVIDERS = [
  { id: 'agnes', name: 'Agnes AI', builtin: true, freeTrial: true },
  { id: 'deepseek', name: 'DeepSeek', builtin: false, freeTrial: false },
  { id: 'chatgpt', name: 'ChatGPT', builtin: false, freeTrial: false },
  { id: 'gemini', name: 'Gemini', builtin: false, freeTrial: false },
  { id: 'grok', name: 'Grok', builtin: false, freeTrial: false },
  { id: 'doubao', name: '豆包', builtin: false, freeTrial: false },
  { id: 'tongyi', name: '通义千问', builtin: false, freeTrial: false },
  { id: 'yuanbao', name: '元宝', builtin: false, freeTrial: false },
] as const;

export type ProviderId = typeof SUPPORTED_PROVIDERS[number]['id'];

/**
 * 检查企业是否可以生成内容
 * @returns { canGenerate: boolean, message: string, provider: string, apiKey: string | null }
 */
export async function checkAiAccess(
  db: D1Database,
  tenantId: string
): Promise<{
  canGenerate: boolean;
  message: string;
  provider: string;
  apiKey: string | null;
  apiBaseUrl: string | null;
  modelName: string | null;
}> {
  // 1. 获取企业信息
  const company = await db.prepare(
    `SELECT ai_package_type, ai_package_expires_at FROM sys_company WHERE tenant_id = ?`
  ).bind(tenantId).first<{ ai_package_type: string | null; ai_package_expires_at: string | null }>();

  if (!company) {
    return { canGenerate: false, message: '企业信息不存在', provider: '', apiKey: null, apiBaseUrl: null, modelName: null };
  }

  const now = new Date();
  const packageExpired = !company.ai_package_expires_at || new Date(company.ai_package_expires_at) < now;
  const hasPackage = company.ai_package_type && company.ai_package_type !== 'none';

  // 2. 检查企业是否配置了自有 Key
  const ownConfig = await db.prepare(
    `SELECT provider, api_key, api_base_url, model_name FROM ai_model_config
     WHERE tenant_id = ? AND status = 'active' AND api_key IS NOT NULL AND api_key != ''
     ORDER BY created_at DESC LIMIT 1`
  ).bind(tenantId).first<{ provider: string; api_key: string; api_base_url: string | null; model_name: string | null }>();

  if (ownConfig && ownConfig.api_key) {
    return {
      canGenerate: true,
      message: `使用企业自有 Key（${ownConfig.provider}）`,
      provider: ownConfig.provider,
      apiKey: ownConfig.api_key,
      apiBaseUrl: ownConfig.api_base_url,
      modelName: ownConfig.model_name,
    };
  }

  // 3. 检查平台加油包
  if (hasPackage && !packageExpired) {
    return {
      canGenerate: true,
      message: `使用平台加油包（${company.ai_package_type === 'daily' ? '日' : '月'}套餐，到期 ${company.ai_package_expires_at}）`,
      provider: 'agnes',
      apiKey: '__PLATFORM_PACKAGE__', // 标记使用平台 Key
      apiBaseUrl: null,
      modelName: null,
    };
  }

  // 4. 无法生成
  return {
    canGenerate: false,
    message: 'AI 套餐已过期。请购买加油包（¥66/天 或 ¥666/月），或在「模型配置」中配置您的私有 API Key。',
    provider: '',
    apiKey: null,
    apiBaseUrl: null,
    modelName: null,
  };
}

/**
 * 通过企业自有 Key 调用对应供应商的文本生成 API
 */
export async function generateWithOwnKey(
  apiKey: string,
  provider: string,
  apiBaseUrl: string | null,
  modelName: string | null,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ success: boolean; content?: string; error?: string }> {
  const baseUrl = apiBaseUrl || getDefaultBaseUrl(provider);
  const model = modelName || getDefaultModel(provider);

  try {
    if (provider === 'agnes') {
      // Agnes 走现有工具
      const { generateText } = await import('./agnes');
      return generateText(apiKey, { systemPrompt, userPrompt, model, maxTokens: 4096 });
    }

    // 兼容 OpenAI 格式的供应商
    const openaiCompatible = ['deepseek', 'chatgpt', 'gemini', 'grok', 'doubao', 'tongyi', 'yuanbao'];
    if (openaiCompatible.includes(provider)) {
      const messages: any[] = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: userPrompt });

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 4096,
          temperature: 0.7,
          stream: false,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return { success: false, error: `${provider} API error (${response.status}): ${err.substring(0, 200)}` };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) return { success: false, error: `${provider} returned empty content` };
      return { success: true, content };
    }

    return { success: false, error: `不支持的模型供应商: ${provider}` };
  } catch (e: any) {
    return { success: false, error: `${provider} API call failed: ${e.message}` };
  }
}

function getDefaultBaseUrl(provider: string): string {
  const urls: Record<string, string> = {
    deepseek: 'https://api.deepseek.com/v1',
    chatgpt: 'https://api.openai.com/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
    grok: 'https://api.x.ai/v1',
    doubao: 'https://ark.cn-beijing.volces.com/api/v3',
    tongyi: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    yuanbao: 'https://api.hunyuan.cloud.tencent.com/v1',
    agnes: 'https://apihub.agnes-ai.com/v1',
  };
  return urls[provider] || 'https://api.openai.com/v1';
}

function getDefaultModel(provider: string): string {
  const models: Record<string, string> = {
    deepseek: 'deepseek-chat',
    chatgpt: 'gpt-4o-mini',
    gemini: 'gemini-2.0-flash',
    grok: 'grok-2',
    doubao: 'doubao-pro-32k',
    tongyi: 'qwen-plus',
    yuanbao: 'hunyuan-lite',
    agnes: 'agnes-2.0-flash',
  };
  return models[provider] || 'gpt-4o-mini';
}
