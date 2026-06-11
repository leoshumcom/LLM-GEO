import { Hono } from 'hono';
import type { Env, ApiResponse } from '../../types';

export const apiRouter = new Hono<{ Bindings: Env }>();

// ===== 社媒 OAuth 回调入口 =====
// GET /api/social/callback/:platform
// 社交媒体授权后的回调地址
apiRouter.get('/social/callback/:platform', async (c) => {
  try {
    const platform = c.req.param('platform');
    const code = c.req.query('code');
    const state = c.req.query('state'); // state = tenantId 或临时token
    const error = c.req.query('error');

    if (error || !code) {
      // 授权失败
      return c.html(authErrorHtml(platform, error || 'Unknown error'));
    }

    // 根据平台调用不同 OAuth token 交换逻辑
    let result: { platformUserName: string; platformUserId: string; accessToken: string; expiresIn: number } | null = null;

    // 从state中解析tenantId（格式：tenantId_随机值）
    const tenantId = state?.split('_')[0] || '';

    switch (platform) {
      case 'twitter': {
        // Twitter OAuth 2.0 Code Grant
        const tokenUrl = 'https://api.twitter.com/2/oauth2/token';
        const params = new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: c.env.TWITTER_CLIENT_ID || '',
          redirect_uri: c.env.APP_URL + '/api/social/callback/twitter',
          code_verifier: '', // PKCE - 需要从KV或D1获取之前保存的challenge
        });

        const auth = btoa(
          (c.env.TWITTER_CLIENT_ID || '') + ':' + (c.env.TWITTER_CLIENT_SECRET || '')
        );

        const tokRes = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${auth}`,
          },
          body: params,
        });

        if (!tokRes.ok) {
          const err = await tokRes.text();
          return c.html(authErrorHtml(platform, `Token exchange failed: ${err.substring(0, 100)}`));
        }

        const tokData = await tokRes.json();
        const accessToken = tokData.access_token;

        // 获取用户信息
        const userRes = await fetch('https://api.twitter.com/2/users/me', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (userRes.ok) {
          const userData = await userRes.json();
          result = {
            platformUserName: userData.data?.name || 'Twitter User',
            platformUserId: userData.data?.id || '',
            accessToken,
            expiresIn: tokData.expires_in || 7200,
          };
        }
        break;
      }

      case 'facebook': {
        // Facebook OAuth
        const tokRes = await fetch(
          `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${c.env.FACEBOOK_APP_ID || ''}&redirect_uri=${c.env.APP_URL}/api/social/callback/facebook&client_secret=${c.env.FACEBOOK_APP_SECRET || ''}&code=${code}`
        );

        if (!tokRes.ok) break;

        const tokData = await tokRes.json();
        const accessToken = tokData.access_token;

        // 获取用户信息
        const userRes = await fetch(`https://graph.facebook.com/me?access_token=${accessToken}&fields=name,id`);
        if (userRes.ok) {
          const userData = await userRes.json();
          result = {
            platformUserName: userData.name || 'Facebook User',
            platformUserId: userData.id || '',
            accessToken,
            expiresIn: tokData.expires_in || 5184000, // 60天
          };
        }
        break;
      }

      case 'linkedin': {
        // LinkedIn OAuth
        const tokRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: c.env.APP_URL + '/api/social/callback/linkedin',
            client_id: c.env.LINKEDIN_CLIENT_ID || '',
            client_secret: c.env.LINKEDIN_CLIENT_SECRET || '',
          }),
        });

        if (!tokRes.ok) break;

        const tokData = await tokRes.json();
        const accessToken = tokData.access_token;

        // 获取用户信息
        const userRes = await fetch('https://api.linkedin.com/v2/userinfo', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          result = {
            platformUserName: userData.name || 'LinkedIn User',
            platformUserId: userData.sub || '',
            accessToken,
            expiresIn: tokData.expires_in || 5184000,
          };
        }
        break;
      }

      default: {
        return c.html(authErrorHtml(platform, `Unsupported platform: ${platform}`));
      }
    }

    if (!result) {
      return c.html(authErrorHtml(platform, 'Failed to get access token or user info'));
    }

    // 保存到数据库
    if (tenantId) {
      // 检查是否已存在
      const existing = await c.env.DB.prepare(
        `SELECT id FROM company_social_oauth WHERE tenant_id = ? AND platform = ?`
      ).bind(tenantId, platform).first();

      if (existing) {
        await c.env.DB.prepare(
          `UPDATE company_social_oauth SET
            platform_user_name = ?, platform_user_id = ?,
            access_token = ?, token_expires_at = datetime('now', '+' || ? || ' seconds'),
            status = 'active', updated_at = datetime('now')
           WHERE tenant_id = ? AND platform = ?`
        ).bind(
          result.platformUserName, result.platformUserId,
          result.accessToken, result.expiresIn,
          tenantId, platform
        ).run();
      } else {
        await c.env.DB.prepare(
          `INSERT INTO company_social_oauth
           (id, tenant_id, platform, platform_user_name, platform_user_id,
            access_token, token_expires_at, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+' || ? || ' seconds'), 'active', datetime('now'), datetime('now'))`
        ).bind(
          crypto.randomUUID(), tenantId, platform,
          result.platformUserName, result.platformUserId,
          result.accessToken, result.expiresIn
        ).run();
      }
    }

    // 返回成功页面
    return c.html(authSuccessHtml(platform, result.platformUserName));
  } catch (e: any) {
    console.error(`[Social] ${c.req.param('platform')} callback error:`, e);
    return c.html(authErrorHtml(c.req.param('platform'), e.message));
  }
});

// ===== 支付回调（虎皮椒） =====
apiRouter.post('/payment/callback', async (c) => {
  try {
    const formData = await c.req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    console.log('[Payment] Callback received:', JSON.stringify({ ...params, hash: params.hash?.substring(0, 8) + '...' }));

    // 转发到 payment 模块的 notify 处理
    // 注意：这个端点和 payment/notify 是一回事，只是兼容不同路径
    const response = await fetch(c.env.APP_URL + '/api/payment/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });

    const text = await response.text();
    return c.text(text);
  } catch (e: any) {
    console.error('[Payment] Callback error:', e);
    return c.text('error');
  }
});

// ===== 公开端点 - 已发布的文章列表 =====
// GET /api/articles
apiRouter.get('/articles', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 50);
    const offset = (page - 1) * pageSize;

    // 只返回已发表的内容（status = published）
    const total = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM publish_record WHERE status = 'published'`
    ).first<{ count: number }>();

    const items = await c.env.DB.prepare(
      `SELECT pr.id, pr.platform, pr.platform_url, pr.channel_type,
              pr.published_at, pr.created_at,
              agc.keyword, agc.title
       FROM publish_record pr
       LEFT JOIN ai_generate_content agc ON pr.content_id = agc.id
       WHERE pr.status = 'published'
       ORDER BY pr.published_at DESC LIMIT ? OFFSET ?`
    ).bind(pageSize, offset).all();

    return c.json({
      success: true,
      data: {
        items: items.results || [],
        total: total?.count || 0,
        page, pageSize,
      }
    });
  } catch (e: any) {
    console.error('[API] Articles error:', e);
    return c.json({ success: false, error: '获取文章列表失败' } as ApiResponse, 500);
  }
});

// ===== 公开端点 - 单篇文章详情 =====
apiRouter.get('/articles/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const article = await c.env.DB.prepare(
      `SELECT pr.id, pr.platform, pr.platform_url, pr.channel_type,
              pr.published_at, pr.created_at, pr.content_id,
              agc.keyword, agc.title, agc.content
       FROM publish_record pr
       LEFT JOIN ai_generate_content agc ON pr.content_id = agc.id
       WHERE pr.id = ? AND pr.status = 'published'`
    ).bind(id).first();

    if (!article) {
      return c.json({ success: false, error: '文章不存在' } as ApiResponse, 404);
    }

    return c.json({ success: true, data: article });
  } catch (e: any) {
    return c.json({ success: false, error: '获取文章失败' } as ApiResponse, 500);
  }
});

// ===== 公开端点 - 官网页面 =====
apiRouter.get('/site/:page', async (c) => {
  try {
    const page = c.req.param('page');

    // 返回CMS内容（可以从system_config中读取，或专门的内容表）
    return c.json({
      success: true,
      data: { page, content: '<p>Content coming soon</p>' }
    });
  } catch (e: any) {
    return c.json({ success: false, error: '获取页面失败' }, 500);
  }
});

// ===== 公开端点 - 价格查询 =====
apiRouter.get('/pricing', (c) => {
  return c.json({
    success: true,
    data: {
      enterprise: {
        name: '企业自助版',
        price: 168800, // 分
        period: '年',
        features: ['AI智能内容生成', '多社媒自动发布', '关键词库管理', '数据分析看板'],
      },
      agent: {
        name: '代理商版',
        price: 888800, // 分
        features: ['含企业自助版所有功能', '批量管理名下企业', '余额代付开通', '专属客服'],
      },
      aiDaily: {
        name: 'AI模型包·日',
        price: 6600,
        period: '天',
        features: ['不限AI内容生成次数'],
      },
      aiMonthly: {
        name: 'AI模型包·月',
        price: 66600,
        period: '月',
        features: ['不限AI内容生成次数'],
      },
    },
  });
});

// ===== 社媒发布webhook（供站群框架调用） =====
apiRouter.post('/publish/webhook', async (c) => {
  try {
    const body = await c.req.json();
    // 验证签名
    const signature = c.req.header('X-Webhook-Signature');
    if (!signature || signature !== c.env.JWT_SECRET) {
      return c.json({ success: false, error: 'Invalid signature' }, 403);
    }

    const { contentId, platform, platformUrl, status, tenantId } = body;

    if (!contentId || !platform || !status) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    // 更新发布记录
    if (status === 'published') {
      await c.env.DB.prepare(
        `UPDATE publish_record SET
          status = 'published',
          platform_url = COALESCE(?, platform_url),
          published_at = datetime('now')
         WHERE content_id = ? AND platform = ?`
      ).bind(platformUrl || null, contentId, platform).run();
    } else if (status === 'failed') {
      await c.env.DB.prepare(
        `UPDATE publish_record SET
          status = 'failed',
          error_message = ?
         WHERE content_id = ? AND platform = ?`
      ).bind(body.error || 'Webhook reported failure', contentId, platform).run();
    }

    return c.json({ success: true, message: 'Webhook processed' });
  } catch (e: any) {
    console.error('[Webhook] Publish error:', e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ===== 企业注册默认赠送 AI 试用 =====
apiRouter.post('/signup/free-trial', async (c) => {
  try {
    const { email, companyName } = await c.req.json<{
      email: string; companyName: string;
    }>();

    if (!email || !companyName) {
      return c.json({ success: false, error: '信息不完整' } as ApiResponse, 400);
    }

    return c.json({ success: true, message: '免费试用申请已提交' });
  } catch (e: any) {
    return c.json({ success: false, error: '申请失败' } as ApiResponse, 500);
  }
});

// ===== Helper: OAuth 成功页面 =====
function authSuccessHtml(platform: string, userName: string): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>授权成功 - LLMGEO</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f0fdf4}.card{text-align:center;padding:48px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:400px}.icon{font-size:64px;margin-bottom:16px}h1{color:#16a34a;margin:0 0 8px;font-size:24px}p{color:#666;margin:4px 0 24px}a{display:inline-block;padding:12px 32px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px}</style></head>
<body><div class="card"><div class="icon">✅</div><h1>&#35;{platform} 授权成功</h1><p>账号：${userName}</p><a href="/" onclick="window.close()">关闭页面</a></div></body></html>`;
}

function authErrorHtml(platform: string, error: string): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>授权失败 - LLMGEO</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#fef2f2}.card{text-align:center;padding:48px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:400px}.icon{font-size:64px;margin-bottom:16px}h1{color:#dc2626;margin:0 0 8px;font-size:24px}p{color:#666;margin:4px 0 24px;word-break:break-all}a{display:inline-block;padding:12px 32px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px}</style></head>
<body><div class="card"><div class="icon">❌</div><h1>&#35;{platform} 授权失败</h1><p>${error}</p><a href="/">返回首页</a></div></body></html>`;
}
