import type { Env, AiGenerateTask } from '../types';

/**
 * Queue 消费者：处理 AI 内容生成任务
 * 绑定在 llmgeo-ai-generate 队列上
 */
export default {
  async queue(batch: MessageBatch<AiGenerateTask>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const task = message.body;

      try {
        console.log(`Processing AI generate task: ${task.taskId} (${task.keyword})`);

        // TODO: 调用 Agnes API 生成内容
        // 1. 根据 task.modelType 选择文本/图片/视频模型
        // 2. 调用对应 LLM API
        // 3. 存储结果到 ai_generate_content / ai_media_file
        // 4. 更新 company_keyword 状态为 generated

        // 模拟处理
        await generateContent(task, env);

        message.ack();
      } catch (error) {
        console.error(`Task ${task.taskId} failed:`, error);
        message.retry();
      }
    }
  },
};

async function generateContent(task: AiGenerateTask, env: Env): Promise<void> {
  // 读取 Agnes API 配置
  const apiBaseUrl = env.AGNES_API_BASE_URL;
  const apiKey = env.AGNES_API_KEY;

  if (!apiKey) {
    throw new Error('Agnes API key not configured');
  }

  // TODO: 调用 Agnes API 生成内容
  // const response = await fetch(`${apiBaseUrl}/chat/completions`, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${apiKey}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     model: 'agnes-llm',
  //     messages: [
  //       { role: 'system', content: buildSystemPrompt(task) },
  //       { role: 'user', content: `Generate SEO-optimized content about: ${task.keyword}` },
  //     ],
  //   }),
  // });

  // 模拟延迟
  await new Promise(resolve => setTimeout(resolve, 100));
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
