import type { AiGenerateTask } from '../types';

/**
 * Queue 消费者 Worker 入口
 * 处理 AI 内容生成任务
 */
export default {
  async fetch() {
    return new Response('Queue consumer worker');
  },

  async queue(batch: any, env: any): Promise<void> {
    for (const message of batch.messages) {
      const task = message.body as AiGenerateTask;
      try {
        console.log(`Processing task: ${task.taskId} (${task.keyword})`);
        // TODO: 调用 Agnes API
        message.ack();
      } catch (error) {
        console.error(`Task ${task.taskId} failed:`, error);
        message.retry();
      }
    }
  },
};
