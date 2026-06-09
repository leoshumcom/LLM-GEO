# LLMGEO - 海外 GEO 排名优化 SaaS 平台

## 项目概述

多租户 SaaS 平台，依托多厂商大模型 AI 自动生成品牌图文/视频内容，批量分发至全球社媒、海外站群，沉淀外链提升 Google 收录与海外 GEO 搜索排名。

### 技术栈
- **运行环境**: Cloudflare Workers (Hono + TypeScript)
- **数据库**: Cloudflare D1 (SQLite)
- **对象存储**: Cloudflare R2
- **消息队列**: Cloudflare Queues
- **定时任务**: Cloudflare Cron Triggers
- **CI/CD**: GitHub Actions
- **AI 底座**: Agnes API

### 部署架构
```
GitHub 私有仓库 → GitHub Actions → Cloudflare Workers + D1 + R2
                                       ↓
                              全球 CDN (Cloudflare)
                                       ↓
                              用户访问 llmgeo.com
```

## 本地开发

### 前置要求
- Node.js 22+
- npm
- Cloudflare 账户（已配置 Workers、D1、R2）

### 安装和运行

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 创建 D1 数据库（首次）
npm run db:create

# 运行数据库迁移
npm run db:migrate

# 部署到生产
npm run deploy
```

### 环境变量配置

在 Cloudflare Dashboard 中设置以下环境变量：

| 变量名 | 说明 |
|--------|------|
| `JWT_SECRET` | JWT 签名密钥 |
| `AGNES_API_KEY` | Agnes AI API 密钥 |
| `AGNES_API_BASE_URL` | Agnes API Base URL |

## 项目结构

```
llmgeo/
├── src/
│   ├── index.ts                 # 主入口，路由注册
│   ├── types.ts                 # 全局类型定义
│   ├── middleware/
│   │   └── auth.ts              # 认证、角色授权、租户隔离中间件
│   ├── modules/
│   │   ├── auth/                # 认证模块（登录/注册/密码重置）
│   │   ├── admin/               # 总控管理员模块
│   │   ├── agent/               # 代理商模块
│   │   ├── company/             # 企业租户模块
│   │   ├── dashboard/           # 看板模块
│   │   └── api/                 # 公开API（OAuth回调、支付、SEO页面）
│   └── worker/
│       └── queue-consumer.ts    # AI生成任务队列消费者
├── migrations/
│   └── 0001_init.sql            # 数据库初始化迁移
├── .github/workflows/
│   └── deploy.yml               # GitHub Actions 部署配置
├── wrangler.toml                # Cloudflare Workers 配置
├── tsconfig.json
├── package.json
└── .gitignore
```

## 角色权限体系

1. **总控管理员** - 全局看板、财务管控、系统配置、数据导出
2. **代理商**（开户 8888 元）- 代开企业、预存余额、免费增值预约
3. **企业租户**（888/1688 元/年）- 关键词管理、社媒绑定、AI内容生成、自动发布
4. **运营人员**（≤10 人/企业）- 编辑资料、发布记录查看

## 开发阶段

| 阶段 | 内容 | 状态 |
|------|------|------|
| ① | 项目脚手架 + 数据库 + CI/CD | ✅ 完成 |
| ② | RBAC 权限 + 租户隔离 | 🚧 骨架完成 |
| ③ | 企业资料 + 关键词 + 社媒OAuth | 📝 待开发 |
| ④ | AI 生成引擎 + 素材库 | 📝 待开发 |
| ⑤ | 自动发布 + 外链收集 | 📝 待开发 |
| ⑥ | 财务管理 | 📝 待开发 |
| ⑦ | 增值预约工单 | 📝 待开发 |
| ⑧ | 总控后台 + 系统配置 | 📝 待开发 |
| ⑨ | 前端UI打磨 + 测试 | 📝 待开发 |

## 安全规范

- **仓库强制私有**，禁止开源、禁止 Fork
- 所有密钥存放 Cloudflare 环境变量 / GitHub Secrets
- R2 存储桶私有，后端鉴权访问
- 全站强制 HTTPS
- 严格租户隔离，防止跨租户越权
