/**
 * Queue 消费者 Worker（独立部署）
 * 
 * 这个 Worker 单独处理 AI 内容生成队列，不处理 HTTP 请求。
 * 部署命令：
 *   wrangler deploy --name llmgeo-queue-worker src/worker/queue-worker.ts
 */
import { generateText, generateImage, buildSeoPrompt, extractTitle } from '../utils/agnes';

interface Env {
  DB: D1Database;
  R2_MEDIA: R2Bucket;
  AGNES_API_KEY: string;
  AGNES_API_BASE_URL: string;
}

interface AiGenerateTask {
  taskId: string;
  tenantId: string;
  keywordId: string;
  keyword: string;
  brandName: string;
  brandWebsite: string;
  contactInfo: string;
  modelType: 'text' | 'image' | 'video';
  provider: string;
}

interface MessageBatch<T> {
  messages: Array<{
    id: string;
    timestamp: Date;
    body: T;
    ack: () => void;
    retry: () => void;
  }>;
  queue: string;
}

export default {
  async fetch() {
    return new Response('LLMGEO Queue Consumer Worker', { status: 200 });
  },

  async queue(batch: MessageBatch<AiGenerateTask>, env: Env): Promise<void> {
    const apiKey = env.AGNES_API_KEY;
    if (!apiKey) {
      console.error('[Queue] No Agnes API key configured');
      for (const msg of batch.messages) {
        await markFailed(env, msg.body.taskId, 'AGNES_API_KEY not configured');
        msg.ack();
      }
      return;
    }

    for (const message of batch.messages) {
      const task = message.body;
      try {
        console.log(`[Queue] Processing ${task.modelType}: ${task.keyword}`);

        if (task.modelType === 'text') {
          await handleText(task, env, apiKey);
        } else if (task.modelType === 'image') {
          await handleImage(task, env, apiKey);
        } else if (task.modelType === 'video') {
          await handleVideo(task, env, apiKey);
        }

        console.log(`[Queue] Completed: ${task.taskId}`);
        message.ack();
      } catch (error: any) {
        console.error(`[Queue] Failed ${task.taskId}:`, error.message);
        await markFailed(env, task.taskId, error.message);
        message.ack();
      }
    }
  },
};

async function handleText(task: AiGenerateTask, env: Env, apiKey: string): Promise<void> {
  const { system, user } = buildSeoPrompt(task);
  const result = await generateText(apiKey, {
    systemPrompt: system,
    userPrompt: user,
    maxTokens: 4096,
  });

  if (!result.success || !result.content) {
    throw new Error(result.error || 'Empty content');
  }

  const title = extractTitle(result.content);

  await env.DB.prepare(
    `UPDATE ai_generate_content SET title = ?, content = ?, status = 'completed', completed_at = datetime('now') WHERE id = ?`
  ).bind(title, result.content, task.taskId).run();

  await env.DB.prepare(
    `UPDATE company_keyword SET status = 'generated', updated_at = datetime('now') WHERE id = ?`
  ).bind(task.keywordId).run();
}

async function handleImage(task: AiGenerateTask, env: Env, apiKey: string): Promise<void> {
  const prompt = `Professional image about "${task.keyword}" for ${task.brandName}. Clean composition, business style.`;

  const result = await generateImage(apiKey, { prompt });
  if (!result.success || !result.urls?.length) throw new Error(result.error || 'No image');

  const imageUrl = result.urls[0];
  let r2Path = '';
  try {
    const imgRes = await fetch(imageUrl);
    if (imgRes.ok) {
      r2Path = `media/${task.tenantId}/${task.taskId}.png`;
      await env.R2_MEDIA.put(r2Path, await imgRes.blob(), {
        httpMetadata: { contentType: 'image/png' },
      });
    }
  } catch (_) {}

  await env.DB.prepare(
    `INSERT INTO ai_media_file (id, tenant_id, keyword_id, file_type, r2_path, original_url, mime_type, generated_by, created_at)
     VALUES (?, ?, ?, 'image', ?, ?, 'image/png', 'agnes', datetime('now'))`
  ).bind(crypto.randomUUID(), task.tenantId, task.keywordId, r2Path, imageUrl).run();

  await env.DB.prepare(
    `UPDATE company_keyword SET status = 'generated', updated_at = datetime('now') WHERE id = ?`
  ).bind(task.keywordId).run();
}

async function handleVideo(task: AiGenerateTask, env: Env, apiKey: string): Promise<void> {
  const prompt = `Professional video about "${task.keyword}" for ${task.brandName}.`;

  const res = await fetch('https://apihub.agnes-ai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'agnes-video-v2.0', prompt, duration: 5 }),
  });

  if (!res.ok) throw new Error(`Video API error: ${await res.text()}`);

  const data: any = await res.json();
  const videoUrl = data.data?.[0]?.url || data.url;
  if (!videoUrl) throw new Error('No video URL');

  let r2Path = '';
  try {
    const vidRes = await fetch(videoUrl);
    if (vidRes.ok) {
      r2Path = `media/${task.tenantId}/${task.taskId}.mp4`;
      await env.R2_MEDIA.put(r2Path, await vidRes.blob(), {
        httpMetadata: { contentType: 'video/mp4' },
      });
    }
  } catch (_) {}

  await env.DB.prepare(
    `INSERT INTO ai_media_file (id, tenant_id, keyword_id, file_type, r2_path, original_url, mime_type, generated_by, created_at)
     VALUES (?, ?, ?, 'video', ?, ?, 'video/mp4', 'agnes', datetime('now'))`
  ).bind(crypto.randomUUID(), task.tenantId, task.keywordId, r2Path, videoUrl).run();

  await env.DB.prepare(
    `UPDATE company_keyword SET status = 'generated', updated_at = datetime('now') WHERE id = ?`
  ).bind(task.keywordId).run();
}

async function markFailed(env: Env, taskId: string, error: string): Promise<void> {
  try {
    await env.DB.prepare(
      `UPDATE ai_generate_content SET status = 'failed', error_message = ?, completed_at = datetime('now') WHERE id = ?`
    ).bind(error.substring(0, 500), taskId).run();
  } catch (_) {}
}
