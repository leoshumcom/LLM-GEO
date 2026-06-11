/**
 * 站群发布模块 - 将 AI 生成内容发布到自有 WordPress 站点
 * 
 * 支持多个站点的 REST API 发布
 */
import { Hono } from 'hono';
import type { Env, ApiResponse } from '../../types';
import { authMiddleware, requireRole, tenantIsolationMiddleware } from '../../middleware/auth';

export const publishRouter = new Hono<{ Bindings: Env }>();

publishRouter.use('*', authMiddleware);
publishRouter.use('*', requireRole('company', 'operator'));
publishRouter.use('*', tenantIsolationMiddleware);

// ========== 站点管理 ==========

// GET /api/publish/sites - 获取站群站点列表
publishRouter.get('/sites', async (c) => {
  try {
    const user = c.get('user');
    const sites = await c.env.DB.prepare(
      `SELECT id, site_name, site_url, site_type, status, created_at
       FROM publish_site WHERE tenant_id = ? ORDER BY created_at DESC`
    ).bind(user.tenantId).all();
    return c.json({ success: true, data: sites.results || [] });
  } catch (e) {
    return c.json({ success: false, error: '获取站点列表失败' }, 500);
  }
});

// POST /api/publish/sites - 添加站点
publishRouter.post('/sites', async (c) => {
  try {
    const user = c.get('user');
    const { siteName, siteUrl, wpUsername, wpPassword, siteType } = await c.req.json();

    if (!siteName || !siteUrl || !wpUsername || !wpPassword) {
      return c.json({ success: false, error: '站点名称、URL、用户名、密码必填' }, 400);
    }

    // 检查站点数限制
    const cnt = await c.env.DB.prepare(
      `SELECT COUNT(*) as c FROM publish_site WHERE tenant_id = ?`
    ).bind(user.tenantId).first();
    if (cnt && (cnt as any).c >= 20) {
      return c.json({ success: false, error: '最多可添加20个站点' }, 400);
    }

    const id = crypto.randomUUID();
    const apiUrl = siteUrl.replace(/\/+$/, '') + '/wp-json/wp/v2';

    await c.env.DB.prepare(
      `INSERT INTO publish_site (id, tenant_id, site_name, site_url, api_url, wp_username, wp_password, site_type, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`
    ).bind(id, user.tenantId, siteName, siteUrl.replace(/\/+$/, ''), apiUrl, wpUsername, wpPassword, siteType || 'wordpress').run();

    // 测试连接
    const testResult = await testWordPressConnection(apiUrl, wpUsername, wpPassword);
    if (!testResult.ok) {
      await c.env.DB.prepare(
        `UPDATE publish_site SET status = 'error', updated_at = datetime('now') WHERE id = ?`
      ).bind(id).run();
    }

    return c.json({
      success: true,
      data: { id, siteName, testResult },
      message: testResult.ok ? '站点添加成功，连接正常' : '站点已添加，但连接测试失败：' + testResult.error
    });
  } catch (e: any) {
    return c.json({ success: false, error: '添加站点失败: ' + (e.message || '未知错误') }, 500);
  }
});

// PUT /api/publish/sites/:id - 更新站点
publishRouter.put('/sites/:id', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const { siteName, siteUrl, wpUsername, wpPassword, siteType, status } = await c.req.json();

    const updates: string[] = [];
    const params: any[] = [];

    if (siteName !== undefined) { updates.push('site_name = ?'); params.push(siteName); }
    if (siteUrl !== undefined) { updates.push('site_url = ?'); params.push(siteUrl); params.push(siteUrl.replace(/\/+$/, '') + '/wp-json/wp/v2'); updates.push('api_url = ?'); }
    if (wpUsername !== undefined) { updates.push('wp_username = ?'); params.push(wpUsername); }
    if (wpPassword !== undefined) { updates.push('wp_password = ?'); params.push(wpPassword); }
    if (siteType !== undefined) { updates.push('site_type = ?'); params.push(siteType); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }

    if (updates.length === 0) return c.json({ success: false, error: '没有要更新的字段' }, 400);

    updates.push("updated_at = datetime('now')");
    params.push(id, user.tenantId);

    await c.env.DB.prepare(
      `UPDATE publish_site SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`
    ).bind(...params).run();

    return c.json({ success: true, message: '站点已更新' });
  } catch (e) {
    return c.json({ success: false, error: '更新站点失败' }, 500);
  }
});

// DELETE /api/publish/sites/:id - 删除站点
publishRouter.delete('/sites/:id', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const result = await c.env.DB.prepare(
      `DELETE FROM publish_site WHERE id = ? AND tenant_id = ?`
    ).bind(id, user.tenantId).run();
    if (result.meta.changes === 0) return c.json({ success: false, error: '站点不存在' }, 404);
    return c.json({ success: true, message: '站点已删除' });
  } catch (e) {
    return c.json({ success: false, error: '删除失败' }, 500);
  }
});

// GET /api/publish/sites/:id/test - 测试站点连接
publishRouter.get('/sites/:id/test', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const site = await c.env.DB.prepare(
      `SELECT api_url, wp_username, wp_password FROM publish_site WHERE id = ? AND tenant_id = ?`
    ).bind(id, user.tenantId).first<any>();

    if (!site) return c.json({ success: false, error: '站点不存在' }, 404);

    const result = await testWordPressConnection(site.api_url, site.wp_username, site.wp_password);
    if (result.ok) {
      await c.env.DB.prepare(
        `UPDATE publish_site SET status = 'active', updated_at = datetime('now') WHERE id = ?`
      ).bind(id).run();
    } else {
      await c.env.DB.prepare(
        `UPDATE publish_site SET status = 'error', updated_at = datetime('now') WHERE id = ?`
      ).bind(id).run();
    }

    return c.json({ success: true, data: result });
  } catch (e) {
    return c.json({ success: false, error: '测试连接失败' }, 500);
  }
});

// ========== 发布 ==========

// POST /api/publish/now - 直接发布单篇内容到指定站点
// Body: { contentId: string, siteIds: string[] }
publishRouter.post('/now', async (c) => {
  try {
    const user = c.get('user');
    const { contentId, siteIds } = await c.req.json<{
      contentId: string; siteIds: string[];
    }>();

    if (!contentId || !siteIds || siteIds.length === 0) {
      return c.json({ success: false, error: '请选择内容和站点' } as ApiResponse, 400);
    }

    // 获取内容
    const content = await c.env.DB.prepare(
      `SELECT id, keyword, title, content, status FROM ai_generate_content WHERE id = ? AND tenant_id = ?`
    ).bind(contentId, user.tenantId).first<{
      id: string; keyword: string; title: string; content: string; status: string;
    }>();

    if (!content) return c.json({ success: false, error: '内容不存在' } as ApiResponse, 404);
    if (content.status !== 'completed') return c.json({ success: false, error: '内容尚未完成生成' } as ApiResponse, 400);

    // 获取站点并逐个发布
    const results: { siteId: string; siteName: string; success: boolean; url?: string; error?: string }[] = [];

    for (const siteId of siteIds) {
      const site = await c.env.DB.prepare(
        `SELECT * FROM publish_site WHERE id = ? AND tenant_id = ? AND status = 'active'`
      ).bind(siteId, user.tenantId).first<any>();

      if (!site) {
        results.push({ siteId, siteName: '未知', success: false, error: '站点不存在或未激活' });
        continue;
      }

      // 执行 WordPress 发布
      const pubResult = await publishToWordPress({
        apiUrl: site.api_url,
        username: site.wp_username,
        password: site.wp_password,
        title: content.title || content.keyword,
        content: content.content,
        keyword: content.keyword,
      });

      // 记录发布结果
      const recordId = crypto.randomUUID();
      if (pubResult.success) {
        await c.env.DB.prepare(
          `INSERT INTO publish_record (id, tenant_id, content_id, platform, platform_url, channel_type, status, published_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'wordpress', 'published', datetime('now'), datetime('now'), datetime('now'))`
        ).bind(recordId, user.tenantId, contentId, site.site_name, pubResult.url || '').run();

        results.push({ siteId, siteName: site.site_name, success: true, url: pubResult.url });
      } else {
        await c.env.DB.prepare(
          `INSERT INTO publish_record (id, tenant_id, content_id, platform, error_message, channel_type, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'wordpress', 'failed', datetime('now'), datetime('now'))`
        ).bind(recordId, user.tenantId, contentId, site.site_name, pubResult.error || '发布失败').run();

        results.push({ siteId, siteName: site.site_name, success: false, error: pubResult.error });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return c.json({
      success: true,
      data: { results },
      message: `发布完成：${successCount}/${results.length} 成功`
    });
  } catch (e: any) {
    console.error('[Publish] Error:', e);
    return c.json({ success: false, error: '发布失败: ' + (e.message || '未知错误') } as ApiResponse, 500);
  }
});

// POST /api/publish/batch - 批量发布待发布内容到指定站点
// Body: { contentIds: string[], siteIds: string[] }
publishRouter.post('/batch', async (c) => {
  try {
    const user = c.get('user');
    const { contentIds, siteIds } = await c.req.json<{
      contentIds: string[]; siteIds: string[];
    }>();

    if (!contentIds || contentIds.length === 0 || !siteIds || siteIds.length === 0) {
      return c.json({ success: false, error: '请选择内容和站点' } as ApiResponse, 400);
    }

    // 获取站点列表
    const sites = await c.env.DB.prepare(
      `SELECT id, site_name, api_url, wp_username, wp_password FROM publish_site
       WHERE tenant_id = ? AND status = 'active'`
    ).bind(user.tenantId).all();

    const activeSites = (sites.results || []).filter((s: any) => siteIds.includes(s.id));
    if (activeSites.length === 0) {
      return c.json({ success: false, error: '没有可用的活跃站点' } as ApiResponse, 400);
    }

    // 逐个内容逐站点发布
    let totalSuccess = 0;
    let totalFail = 0;
    const details: any[] = [];

    for (const contentId of contentIds) {
      const content = await c.env.DB.prepare(
        `SELECT id, keyword, title, content, status FROM ai_generate_content WHERE id = ? AND tenant_id = ?`
      ).bind(contentId, user.tenantId).first<any>();

      if (!content || content.status !== 'completed') {
        totalFail++;
        continue;
      }

      for (const site of activeSites) {
        const pubResult = await publishToWordPress({
          apiUrl: site.api_url,
          username: site.wp_username,
          password: site.wp_password,
          title: content.title || content.keyword,
          content: content.content,
          keyword: content.keyword,
        });

        const recordId = crypto.randomUUID();
        if (pubResult.success) {
          await c.env.DB.prepare(
            `INSERT INTO publish_record (id, tenant_id, content_id, platform, platform_url, channel_type, status, published_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'wordpress', 'published', datetime('now'), datetime('now'), datetime('now'))`
          ).bind(recordId, user.tenantId, contentId, site.site_name, pubResult.url || '').run();
          totalSuccess++;
          details.push({ contentId, siteId: site.id, success: true, url: pubResult.url });
        } else {
          await c.env.DB.prepare(
            `INSERT INTO publish_record (id, tenant_id, content_id, platform, error_message, channel_type, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'wordpress', 'failed', datetime('now'), datetime('now'))`
          ).bind(recordId, user.tenantId, contentId, site.site_name, pubResult.error || '发布失败').run();
          totalFail++;
          details.push({ contentId, siteId: site.id, success: false, error: pubResult.error });
        }
      }
    }

    return c.json({
      success: true,
      data: { totalSuccess, totalFail, details },
      message: `批量发布完成：${totalSuccess} 成功，${totalFail} 失败`
    });
  } catch (e: any) {
    console.error('[Publish] Batch error:', e);
    return c.json({ success: false, error: '批量发布失败: ' + (e.message || '未知错误') } as ApiResponse, 500);
  }
});

// ========== WordPress REST API 发布 ==========

interface WpPublishParams {
  apiUrl: string;
  username: string;
  password: string;
  title: string;
  content: string;
  keyword: string;
  slug?: string;
  status?: string; // publish / draft
  categories?: number[];
  tags?: number[];
}

async function publishToWordPress(params: WpPublishParams): Promise<{
  success: boolean;
  url?: string;
  postId?: number;
  error?: string;
}> {
  const { apiUrl, username, password, title, content, keyword, status = 'publish' } = params;

  try {
    const auth = btoa(`${username}:${password}`);

    // 构建文章内容 - 添加 SEO 友好的 HTML
    const htmlContent = `
<!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading">${escapeHtml(title)}</h1>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>${escapeHtml(stripHtml(content).substring(0, 160))}</p>
<!-- /wp:paragraph -->

<!-- wp:html -->
${content}
<!-- /wp:html -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:paragraph -->
<p><em>This article was automatically generated by <a href="https://llmgeo.com">LLMGEO</a> - AI-Powered GEO Content Platform.</em></p>
<!-- /wp:paragraph -->
`;

    const postData: any = {
      title,
      content: htmlContent,
      status,
      slug: params.slug || slugify(keyword),
      meta: {
        _llmgeo_generated: '1',
        _llmgeo_keyword: keyword,
      },
    };

    // 如果有关联分类和标签
    if (params.categories && params.categories.length > 0) {
      postData.categories = params.categories;
    }
    if (params.tags && params.tags.length > 0) {
      postData.tags = params.tags;
    }

    const response = await fetch(`${apiUrl}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'User-Agent': 'LLMGEO/1.0',
      },
      body: JSON.stringify(postData),
    });

    const result = await response.json();

    if (response.ok || response.status === 201) {
      return {
        success: true,
        url: result.link || '',
        postId: result.id,
      };
    } else {
      const errMsg = result.message || result.code || 'Unknown error';
      // 如果重复，尝试使用 slug+随机后缀
      if (result.code === 'term_exists' || errMsg.includes('duplicate') || errMsg.includes('exist')) {
        postData.slug = slugify(keyword) + '-' + Date.now().toString(36);
        const retryRes = await fetch(`${apiUrl}/posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
            'User-Agent': 'LLMGEO/1.0',
          },
          body: JSON.stringify(postData),
        });
        const retryResult = await retryRes.json();
        if (retryRes.ok || retryRes.status === 201) {
          return { success: true, url: retryResult.link || '', postId: retryResult.id };
        }
        return { success: false, error: `WordPress 发布失败(重试): ${retryResult.message || JSON.stringify(retryResult).substring(0, 200)}` };
      }
      return { success: false, error: `WordPress 发布失败: ${errMsg}` };
    }
  } catch (e: any) {
    return { success: false, error: `网络错误: ${e.message || '连接失败'}` };
  }
}

// ========== 测试 WordPress 连接 ==========
async function testWordPressConnection(apiUrl: string, username: string, password: string): Promise<{
  ok: boolean;
  siteName?: string;
  siteUrl?: string;
  apiVersion?: string;
  error?: string;
}> {
  try {
    const auth = btoa(`${username}:${password}`);
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'User-Agent': 'LLMGEO/1.0',
      },
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data: any = await response.json();
    return {
      ok: true,
      siteName: data.name || '',
      siteUrl: data.url || '',
      apiVersion: data.gmc?.version || '',
    };
  } catch (e: any) {
    return { ok: false, error: `连接失败: ${e.message || '无法访问'}` };
  }
}

// ========== 工具函数 ==========

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 200) || 'post-' + Date.now().toString(36);
}
