# saMacros 离线激活中心

基于 Cloudflare Pages + Functions + KV 构建的高性能离线激活系统。

## ✨ 功能特性

- 🔐 **RSA-SHA256 数字签名** - 使用 Web Crypto API 进行加密签名
- 🛡️ **防重放攻击** - 基于 Cloudflare KV 的订单去重机制
- ⚡ **秒级响应** - Cloudflare 全球边缘网络加速
- � **灵活订阅类型** - 支持1个月/3个月/6个月/12个月/永久
- 📦 **机器码绑定** - 每个激活码锁定特定机器
- 🎨 **现代化 UI** - 渐变色设计 + 动画效果

## 📁 项目结构

```
.
├── index.html                    # 前端激活页面
├── functions/
│   └── api/
│       └── activate.js          # 后端激活 API
├── wrangler.toml                # Cloudflare 配置文件
├── .env.example                 # 环境变量示例
└── README.md                    # 本文件
```

## 🚀 部署步骤

### 1. 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare

```bash
wrangler login
```

### 3. 创建 KV 命名空间

```bash
wrangler kv:namespace create ORDER_DB
```

记录返回的 `id`，并更新到 `wrangler.toml` 中。

### 4. 生成 RSA 密钥对

```bash
# 生成私钥
openssl genrsa -out private.pem 2048

# 生成公钥 (供客户端验证使用)
openssl rsa -in private.pem -pubout -out public.pem
```

### 5. 配置环境变量

在 Cloudflare Pages 项目设置中添加 Secret:

```
RSA_PRIVATE_KEY=<private.pem 的完整内容>
```

### 6. 部署项目

#### 方式 A: 通过 Git 自动部署

1. 将项目推送到 GitHub
2. 在 Cloudflare Dashboard 创建 Pages 项目
3. 连接 GitHub 仓库
4. 设置构建配置:
   - **框架预设**: None
   - **构建命令**: (留空)
   - **构建输出目录**: /
5. 添加环境变量绑定 `ORDER_DB`

#### 方式 B: 使用 Wrangler 直接部署

```bash
wrangler pages deploy .
```

## 🔧 环境变量配置

| 变量名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| `RSA_PRIVATE_KEY` | Secret | ✅ | PEM 格式的 RSA 私钥 |
| `ORDER_DB` | KV Namespace | ✅ | 订单数据库绑定 |
| `ADMIN_TOKEN` | Secret | ❌ | 管理接口认证 (未来扩展) |
| `PAYPAL_CLIENT_ID` | Secret | ✅ | PayPal Client ID |
| `PAYPAL_CLIENT_SECRET` | Secret | ✅ | PayPal Client Secret |
| `PAYPAL_BASE_URL` | Variable | ❌ | PayPal API 地址 (默认生产) |

## 📖 API 文档

### POST /api/activate

**请求体**:
```json
{
  "order_id": "ORD-20260218-ABCD1234",
  "machine_code": "SAM-A1B2C3D4E5F6",
  "paypal_order_id": "5O190127TN364715T"
}
```

**权益分配** (根据 PayPal 金额):
- `>= 19.99` -> `lifetime` (Expiry: 2099-12-31)
- `>= 9.99`  -> `1 year` (Expiry: now + 365 days)
- `>= 3.99`  -> `3 months` (Expiry: now + 90 days)
- `>= 0.99`  -> `1 month` (Expiry: now + 30 days)

**成功响应** (200):
```json
{
  "success": true,
  "activation_key": "dHlwZT0xWTtpZD1TQU0tQTFDMkQzRDRFNUY2O2V4cD0yMDI3LTAyLTE4fDEyMzQ1Njc4OTA=",
  "price_paid": 9.99,
  "entitlement": "1 year",
  "expiration_date": "2027-02-18",
  "activated_at": "2026-02-18T10:30:00.000Z"
}
```

**错误响应**:
- `400` - 参数错误或格式无效
- `403` - 订单已被使用
- `500` - 服务器内部错误

## 🔑 激活码结构

```
Base64( 原始数据 | RSA签名 )
```

原始数据格式:
```
type=1Y;id=SAM-XXXXXXXXXXXX;exp=2027-02-18
```

### 字段说明:
- `type`: 权益类型 (LIFETIME/1Y/3M/1M)
- `id`: 机器码 (SAM-XXXX 格式)
- `exp`: 过期日期 (YYYY-MM-DD)

## 🧪 本地测试

```bash
# 启动本地开发服务器
wrangler pages dev .

# 访问
http://localhost:8788
```

## 📝 License

Copyright © 2026 saMacros Team. All rights reserved.

---

**Generated on**: 2026-02-18
