Gemini 说
这份文档整合了 Cloudflare Pages (前端)、Cloudflare Workers (后端签名逻辑) 以及 Cloudflare KV (订单数据库) 的完整架构需求。你可以直接将其提供给 VS Code 中的 Gemini Agent，让它为你生成全栈代码。

saMacros 离线激活中心全栈需求文档 (Cloudflare 版)
1. 项目背景与目标
项目名称：saMacros 授权管理系统 (基于 [2026-01-01] 快照开发命名规范)。

核心目标：提供一个全自动、高并发、秒级响应的离线激活码签发平台。

部署平台：Cloudflare Pages + Functions (Workers)。

2. 前端需求 (Cloudflare Pages)
技术栈：纯 HTML5 / Tailwind CSS (或原生 CSS) / JavaScript (ES6+)。

UI 组件：

Header：显示项目名称 saMacros Snapshot Activation Center。

Input Group 1：Label 为 "Payment Order ID"，用于输入发卡平台订单号。

Input Group 2：Label 为 "Machine Code (HWID)"，提示用户从客户端复制。

Action Button：文字为 "Generate Activation Key"。

Result Area：一个只读文本框，用于展示生成的长字符串激活码，并带有一个“Copy”按钮。

交互逻辑：

客户端校验：提交前检查输入框是否为空，校验 HWID 格式（如满足 SAM-XXXX 规律）。

异步提交：使用 fetch POST 请求发送数据至 /api/activate。

3. 后端逻辑需求 (Cloudflare Functions / API)
入口文件：/functions/api/activate.js。

核心业务逻辑：

防重放校验 (KV 集成)：

使用 env.ORDER_DB (Cloudflare KV)。

检查 order_id 是否已存在。若存在，返回错误：This order has already been used.。

数据构造：

将 machine_code 与系统当前日期拼接。

格式示例：v=26w08a;id=${machine_code};exp=2027-02-18。

RSA 数字签名 (Web Crypto API)：

从环境变量 RSA_PRIVATE_KEY (Secret) 加载私钥。

使用 RSASSA-PKCS1-v1_5 算法和 SHA-256 散列函数。

对构造的字符串进行签名。

结果输出：

将 原始字符串 + 签名哈希 进行 Base64 编码，生成最终激活码。

记录状态：

签名成功后，将 order_id 写入 KV，状态设为 activated。

4. 环境变量配置 (Secrets)
RSA_PRIVATE_KEY：PEM 格式的 RSA 私钥（用于加密签名）。

ADMIN_TOKEN：(可选) 用于后台管理接口的校验。

5. 异常处理
HTTP 400：订单号无效或格式错误。

HTTP 403：订单已激活或黑名单硬件。

HTTP 500：签名计算失败。

