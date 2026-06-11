# LLMGEO 完整差距分析 — 2026-06-11

## 数据表 & 功能对照

### 18 张数据表对照

| # | 表名 | 用途 | 后端 API | 前端页面 | 状态 |
|---|------|------|---------|---------|------|
| 1 | `sys_admin` | 管理员账户 | ✅ auth/routes.ts | ✅ admin/ | ✅ |
| 2 | `sys_agent` | 代理商账户 | ✅ agent/routes.ts | ✅ agent/ | ✅ |
| 3 | `sys_company` | 企业租户 | ✅ company/routes.ts | ✅ company/ | ✅ |
| 4 | `sys_company_operator` | 子账号 | ✅ company/routes.ts | ✅ company/operators | ✅ |
| 5 | `sys_role` | 角色管理 | ❌ 无 API | ❌ 无页面 | ❌ |
| 6 | `sys_permission` | 权限码 | ❌ 无 API | ❌ 无页面 | ❌ |
| 7 | `sys_user_role` | 用户角色关联 | ❌ 无 API | ❌ 无页面 | ❌ |
| 8 | `company_keyword` | 关键词管理 | ✅ company/routes.ts | ✅ company/keywords | ✅ |
| 9 | `company_social_oauth` | 社媒授权令牌 | ❌ 无完整OAuth流程 | ❌ 社媒页面有但功能不可用 | ❌ |
| 10 | `ai_model_config` | 大模型配置 | ❌ 无 API | ❌ 无页面 | ❌ |
| 11 | `ai_generate_content` | AI生成内容 | ✅ (部分) company/ai | ✅ company/ai | ⚠️ |
| 12 | `ai_media_file` | 多媒体素材 | ✅ (部分) company/media | ✅ company/media | ⚠️ |
| 13 | `publish_record` | 发布记录 | ✅ company/publish | ✅ company/publish | ✅ |
| 14 | `finance_order` | 付费订单 | ❌ payment/routes.ts 有但未挂载完整 | ❌ | ⚠️ |
| 15 | `agent_balance_log` | 余额流水 | ✅ agent/balance/log | ❌ 前端缺页面 | ⚠️ |
| 16 | `reservation_form` | 增值预约工单 | ❌ 无 API | ❌ 无页面 | ❌ |
| 17 | `system_config` | 系统配置 | ❌ 无完整 API | ❌ admin/config 页面有但不可用 | ❌ |
| 18 | `system_log` | 操作日志 | ❌ 无 API | ❌ admin/logs 页面有但不可用 | ❌ |

## 缺失模块详细清单

### 🔴 优先级高

#### 1. 支付回调处理 + 订单激活
- payment/routes.ts 已有创建订单代码
- ❌ 缺少虎皮椒支付回调 `/payment/callback` — 目前报错 404（payment路由挂在两个前缀下 `/api/payment` 和 `/payment`，但回调端点不存在）
- ❌ 支付成功后没有更新`ai_package_expires_at`和`ai_package_type`
- ❌ 支付成功后没有发送邮箱通知
- 关联：`finance_order` 表、`sys_company` 表

#### 2. 管理员配置页面
- admin/config 页面已渲染但数据为空（调用了不存在的API）
- 需要 `GET /admin/config` 和 `PUT /admin/config` 两个端点
- 需要修改 `system_config` 表

#### 3. 管理员日志页面
- admin/logs 页面已渲染但数据为空
- 需要 `GET /admin/logs` 端点
- 需要关联 `system_log` 表

#### 4. 代理商充值页面
- agent/balance/* 端点已补全
- ❌ 前端缺页面：代理商需要充值入口和流水查看页面

#### 5. 增值预约工单
- reservation_form 表已建但完全没有后端 API 和前端页面
- 8种增值服务类型
- 工单提交 → 付款 → 跟踪

### 🟡 优先级中

#### 6. 角色/权限管理
- sys_role / sys_permission / sys_user_role 三张表已建
- 但没有任何 API 使用它们（目前权限硬编码在 middleware 中）

#### 7. 社媒发布（非OAuth）
- 当前社媒页面只有 OAuth 流程，国内不可用
- 需要替代方案：手动粘贴令牌/用浏览器插件方式
- publish_record 表可用于记录

#### 8. AI 模型配置
- ai_model_config 表已建
- 企业端无任何界面管理自己的 API 密钥

### 🔵 优先级低

#### 9. 企业年费会员续费
- company_fee 订单类型已定义但未实现
- 需要企业端「续费会员」入口

#### 10. Cron 定时任务
- wrangler.toml 已定义 3 个 cron 触发器但 handler 未实现
- 需要：会员到期检测、AI套餐过期检测、日套餐自动过期

## 代码文件汇总

| 文件 | 功能 | 状态 |
|------|------|------|
| src/index.ts | 主入口，路由挂载 | ✅ |
| src/types.ts | 类型定义 | ✅ |
| src/middleware/auth.ts | JWT+RBAC+租户隔离 | ✅ |
| src/modules/auth/routes.ts | 注册/登录/登出 | ✅ |
| src/modules/admin/routes.ts | 管理员API | ⚠️ 缺config/logs |
| src/modules/agent/routes.ts | 代理商API | ⚠️ 缺部分端点 |
| src/modules/company/routes.ts | 企业API | ⚠️ 关键字/AI部分已实现 |
| src/modules/dashboard/routes.ts | 看板API | ❌ 空实现 |
| src/modules/api/routes.ts | 对外API | ⚠️ 仅有 Agnes OAuth |
| src/modules/payment/routes.ts | 支付 | ⚠️ 缺回调 |
| src/modules/publish/routes.ts | 站群发布 | ✅ 全新 |
| src/pages/routes.ts | 页面路由 | ✅ |
| src/pages/company/index.ts | 企业前端页面 | ⚠️ 缺社媒替代/支付回调UI |
| src/pages/admin/index.ts | 管理前端页面 | ⚠️ config/logs不可用 |
| src/pages/agent/index.ts | 代理商前端页面 | ⚠️ 缺充值页面 |
| src/pages/shared/layout.ts | 布局组件 | ✅ |
| src/utils/agnes.ts | Agnes API | ✅ |
| src/utils/email.ts | Resend邮件 | ✅ |
| src/utils/md5.ts | MD5工具 | ✅ |
| src/utils/payment.ts | 虎皮椒支付 | ✅ |
| src/worker/queue-consumer.ts | 队列消费 | ✅ |
| src/worker/queue-worker.ts | 独立Worker(未用) | ✅ |
