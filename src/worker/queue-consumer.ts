/**
 * Queue 消费者：处理 AI 内容生成任务
 * 绑定在 llmgeo-ai-generate 队列上
 * 
 * 实际调用 Agnes API 生成文本/图片/视频内容
 */
import { generateText, generateImage, buildSeoPrompt, extractTitle } from '../utils/agnes';
import type { Env, AiGenerateTask } from '../types';

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
  async queue(batch: MessageBatch<AiGenerateTask>, env: Env): Promise<void> {
    const apiKey = env.AGNES_API_KEY;
    if (!apiKey) {
      console.error('[Queue] AGNES_API_KEY not configured, skipping batch');
      // 全部标记失败
      for (const msg of batch.messages) {
        await markContentFailed(env, msg.body.taskId, 'AGNES_API_KEY not configured');
        msg.ack();
      }
      return;
    }

    const results: string[] = [];

    for (const message of batch.messages) {
      const task = message.body;
      const startTime = Date.now();

      try {
        console.log(`[Queue] Processing task: ${task.taskId} (${task.keyword})`);

        if (task.modelType === 'text') {
          await handleTextGeneration(task, env, apiKey);
        } else if (task.modelType === 'image') {
          await handleImageGeneration(task, env, apiKey);
        } else if (task.modelType === 'video') {
          await handleVideoGeneration(task, env, apiKey);
        } else {
          await markContentFailed(env, task.taskId, `Unsupported model type: ${task.modelType}`);
        }

        const elapsed = Date.now() - startTime;
        results.push(`√ ${task.keyword} (${elapsed}ms)`);
        console.log(`[Queue] Completed: ${task.taskId} (${task.keyword}) in ${elapsed}ms`);
        message.ack();
      } catch (error: any) {
        const elapsed = Date.now() - startTime;
        console.error(`[Queue] Failed: ${task.taskId} (${task.keyword}) after ${elapsed}ms:`, error);

        try {
          await markContentFailed(env, task.taskId, error.message || 'Unknown error');
        } catch (e2) {
          console.error('[Queue] Failed to mark content as failed:', e2);
        }

        results.push(`× ${task.keyword}: ${error.message?.substring(0, 50)}`);
        message.ack(); // ACK anyway to avoid infinite retry
      }
    }

    console.log(`[Queue] Batch results:\n${results.join('\n')}`);
  },
};

/**
 * 处理文本生成任务
 */
async function handleTextGeneration(task: AiGenerateTask, env: Env, apiKey: string): Promise<void> {
  // 1. 构建提示词
  const { system, user } = buildSeoPrompt({
    keyword: task.keyword,
    brandName: task.brandName,
    brandWebsite: task.brandWebsite,
    contactInfo: task.contactInfo,
  });

  // 2. 调用 Agnes 文本生成
  const result = await generateText(apiKey, {
    systemPrompt: system,
    userPrompt: user,
    model: 'agnes-2.0-flash',
    maxTokens: 4096,
  });

  if (!result.success || !result.content) {
    throw new Error(result.error || 'Text generation returned empty content');
  }

  const content = result.content;
  const title = extractTitle(content);

  // 3. 更新数据库状态
  await env.DB.prepare(
    `UPDATE ai_generate_content SET
      title = ?,
      content = ?,
      status = 'completed',
      completed_at = datetime('now')
     WHERE id = ?`
  ).bind(title, content, task.taskId).run();

  // 4. 更新关键词状态
  await env.DB.prepare(
    `UPDATE company_keyword SET status = 'generated', updated_at = datetime('now') WHERE id = ?`
  ).bind(task.keywordId).run();

  // 5. 可选：记录 token 消耗
  try {
    const tokenCount = Math.ceil(content.length / 4); // 粗略估算
    await env.DB.prepare(
      `INSERT INTO system_log (id, level, module, message, created_at)
       VALUES (?, 'info', 'ai_generate', ?, datetime('now'))`
    ).bind(crypto.randomUUID(),
      `Generated content for "${task.keyword}": ${content.length} chars, ~${tokenCount} tokens`)
      .run();
  } catch (_) {
    // 日志失败不影响主流程
  }
}

/**
 * 处理图片生成任务
 */
async function handleImageGeneration(task: AiGenerateTask, env: Env, apiKey: string): Promise<void> {
  // 构建图片提示词
  const prompt = `Create a high-quality, professional image about "${task.keyword}" for ${task.brandName}. SEO-optimized, clean composition, suitable for business website.`;

  const result = await generateImage(apiKey, {
    prompt,
    model: 'agnes-image-2.1-flash',
    size: '1024x1024',
    n: 1,
  });

  if (!result.success || !result.urls || result.urls.length === 0) {
    throw new Error(result.error || 'Image generation returned no URLs');
  }

  const imageUrl = result.urls[0];

  // 下载图片到 R2
  let r2Path = '';
  try {
    const imageResponse = await fetch(imageUrl);
    if (imageResponse.ok) {
      const imageBlob = await imageResponse.blob();
      r2Path = `media/${task.tenantId}/${task.taskId}.png`;
      await env.R2_MEDIA.put(r2Path, imageBlob, {
        httpMetadata: { contentType: 'image/png' },
      });
    }
  } catch (e: any) {
    console.warn(`[Queue] Failed to upload image to R2: ${e.message}, using original URL`);
  }

  // 更新素材库
  const mediaId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO ai_media_file (id, tenant_id, keyword_id, file_type, r2_path, original_url, mime_type, width, height, file_size, generated_by, created_at)
     VALUES (?, ?, ?, 'image', ?, ?, 'image/png', 1024, 1024, 0, 'agnes', datetime('now'))`
  ).bind(mediaId, task.tenantId, task.keywordId, r2Path, imageUrl).run();

  // 更新关键词状态
  await env.DB.prepare(
    `UPDATE company_keyword SET status = 'generated', updated_at = datetime('now') WHERE id = ?`
  ).bind(task.keywordId).run();
}

/**
 * 处理视频生成任务
 */
async function handleVideoGeneration(task: AiGenerateTask, env: Env, apiKey: string): Promise<void> {
  // Agnes video API - 使用图片生成端点传视频模型
  const videoPrompt = `Create a professional video about "${task.keyword}" for ${task.brandName}.`;

  const response = await fetch('https://apihub.agnes-ai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'agnes-video-v2.0',
      prompt: videoPrompt,
      duration: 5,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Video API error (${response.status}): ${err.substring(0, 200)}`);
  }

  const data = await response.json();
  const videoUrl = data.data?.[0]?.url || data.url || '';

  if (!videoUrl) {
    throw new Error('No video URL in Agnes response');
  }

  // 可选：下载到 R2
  let r2Path = '';
  try {
    const videoResponse = await fetch(videoUrl);
    if (videoResponse.ok) {
      const videoBlob = await videoResponse.blob();
      r2Path = `media/${task.tenantId}/${task.taskId}.mp4`;
      await env.R2_MEDIA.put(r2Path, videoBlob, {
        httpMetadata: { contentType: 'video/mp4' },
      });
    }
  } catch (e: any) {
    console.warn(`[Queue] Failed to upload video to R2: ${e.message}`);
  }

  // 更新素材库
  const mediaId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO ai_media_file (id, tenant_id, keyword_id, file_type, r2_path, original_url, mime_type, generated_by, created_at)
     VALUES (?, ?, ?, 'video', ?, ?, 'video/mp4', 'agnes', datetime('now'))`
  ).bind(mediaId, task.tenantId, task.keywordId, r2Path, videoUrl).run();

  // 更新关键词状态
  await env.DB.prepare(
    `UPDATE company_keyword SET status = 'generated', updated_at = datetime('now') WHERE id = ?`
  ).bind(task.keywordId).run();
}

/**
 * 标记内容生成为失败
 */
async function markContentFailed(env: Env, taskId: string, error: string): Promise<void> {
  try {
    await env.DB.prepare(
      `UPDATE ai_generate_content SET status = 'failed', error_message = ?, completed_at = datetime('now') WHERE id = ?`
    ).bind(error.substring(0, 500), taskId).run();
  } catch (e) {
    console.error(`[Queue] Failed to mark ${taskId} as failed in DB:`, e);
  }
}
