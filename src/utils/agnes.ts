/**
 * Agnes API 对接工具 - AI 内容生成引擎
 *
 * 支持文本生成、图片生成、视频生成
 * 兼容 OpenAI 格式：https://apihub.agnes-ai.com/v1
 */

const AGNES_BASE_URL = 'https://apihub.agnes-ai.com/v1';

export interface AgnesMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AgnesTextRequest {
  model: string;
  messages: AgnesMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface AgnesImageRequest {
  model: string;
  prompt: string;
  n?: number;
  size?: string;
}

export interface AgnesVideoRequest {
  model: string;
  prompt: string;
  duration?: number;
}

/**
 * 调用 Agnes 文本模型生成内容
 */
export async function generateText(
  apiKey: string,
  params: { systemPrompt?: string; userPrompt: string; model?: string; maxTokens?: number }
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const messages: AgnesMessage[] = [];
    if (params.systemPrompt) {
      messages.push({ role: 'system', content: params.systemPrompt });
    }
    messages.push({ role: 'user', content: params.userPrompt });

    const response = await fetch(`${AGNES_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model || 'agnes-2.0-flash',
        messages,
        max_tokens: params.maxTokens || 4096,
        temperature: 0.7,
        stream: false,
      } as AgnesTextRequest),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: `Agnes API error (${response.status}): ${err.substring(0, 200)}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { success: false, error: 'No content in Agnes response' };
    }

    return { success: true, content };
  } catch (e: any) {
    return { success: false, error: `Agnes API call failed: ${e.message}` };
  }
}

/**
 * 调用 Agnes 图片模型生成图片
 */
export async function generateImage(
  apiKey: string,
  params: { prompt: string; model?: string; size?: string; n?: number }
): Promise<{ success: boolean; urls?: string[]; error?: string }> {
  try {
    const response = await fetch(`${AGNES_BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model || 'agnes-image-2.1-flash',
        prompt: params.prompt,
        n: params.n || 1,
        size: params.size || '1024x1024',
      } as AgnesImageRequest),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: `Agnes Image API error (${response.status}): ${err.substring(0, 200)}` };
    }

    const data = await response.json();
    const urls = data.data?.map((d: any) => d.url || '').filter(Boolean);
    if (!urls || urls.length === 0) {
      return { success: false, error: 'No image URL in response' };
    }

    return { success: true, urls };
  } catch (e: any) {
    return { success: false, error: `Agnes Image API failed: ${e.message}` };
  }
}

/**
 * 调用 Agnes 视频模型生成视频
 */
export async function generateVideo(
  apiKey: string,
  params: { prompt: string; model?: string; duration?: number }
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const response = await fetch(`${AGNES_BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model || 'agnes-video-v2.0',
        prompt: params.prompt,
        duration: params.duration || 5,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: `Agnes Video API error (${response.status}): ${err.substring(0, 200)}` };
    }

    const data = await response.json();
    const url = data.data?.[0]?.url || data.url || '';
    if (!url) {
      return { success: false, error: 'No video URL in response' };
    }

    return { success: true, url };
  } catch (e: any) {
    return { success: false, error: `Agnes Video API failed: ${e.message}` };
  }
}

/**
 * 构建SEO内容生成的系统提示词
 */
export function buildSeoPrompt(task: {
  keyword: string;
  brandName: string;
  brandWebsite: string;
  contactInfo: string;
}): { system: string; user: string } {
  const system = `你是一位专业的SEO内容写手，擅长为海外市场撰写高质量的SEO优化文章。

## 写作要求：
1. 语言：使用地道的美式/英式英语（根据关键词主题判断）
2. 格式：使用 Markdown 格式，包含 H2/H3 小标题
3. 字数：800-1500 字之间
4. SEO：自然地融入关键词"${task.keyword}"及其相关长尾词
5. 结构：引言 → 2-4个小标题段落 → 结论/CTA
6. 语气：专业但不生硬，对读者有帮助性
7. 品牌：在文章末尾自然地融入品牌信息
   - 品牌名：${task.brandName}
   - 官网：${task.website || task.brandWebsite}
   - 联系方式：${task.contactInfo}

## 输出格式：
请直接输出完整的 Markdown 文章内容，无需额外说明。`;

  const user = `请写一篇针对关键词"${task.keyword}"的SEO优化文章，面向海外读者。`;

  return { system, user };
}

/**
 * 从 Agnes 生成的 Markdown 中提取标题
 */
export function extractTitle(markdown: string): string {
  // 查找第一个 H1 或 H2
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  const h2Match = markdown.match(/^##\s+(.+)$/m);
  if (h2Match) return h2Match[1].trim();
  // 取前100字符作为标题
  return markdown.replace(/[#*`\[\]]/g, '').substring(0, 100).trim();
}
