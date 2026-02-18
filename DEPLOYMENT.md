# saMacros 激活中心部署指南

## 📋 部署前检查清单

- [ ] 已安装 Node.js (v16+)
- [ ] 已安装 Wrangler CLI
- [ ] 拥有 Cloudflare 账号
- [ ] 已准备好域名 (可选)

---

## 🚀 完整部署流程

### 第 1 步: 安装依赖

```powershell
# 全局安装 Wrangler
npm install -g wrangler

# 安装项目依赖
npm install
```

### 第 2 步: 登录 Cloudflare

```powershell
wrangler login
```

浏览器会自动打开授权页面，点击允许。

### 第 3 步: 创建 KV 命名空间

```powershell
wrangler kv:namespace create ORDER_DB
```

**示例输出**:
```
🌀 Creating namespace with title "samacros-ORDER_DB"
✨ Success!
Add the following to your wrangler.toml:
kv_namespaces = [
  { binding = "ORDER_DB", id = "a1b2c3d4e5f6..." }
]
```

**复制 `id` 值并更新到 `wrangler.toml` 文件**:

```toml
[[kv_namespaces]]
binding = "ORDER_DB"
id = "a1b2c3d4e5f6..."  # 👈 替换这里
```

### 第 4 步: 生成 RSA 密钥对

#### Windows (PowerShell):

```powershell
# 方法 1: 使用 OpenSSL (需先安装)
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# 方法 2: 使用在线工具
# 访问: https://cryptotools.net/rsagen
# 选择 2048 位密钥长度
# 下载私钥保存为 private.pem
```

#### 查看私钥内容:

```powershell
Get-Content private.pem | Out-String | Set-Clipboard
```

私钥已复制到剪贴板。

### 第 5 步: 配置环境变量

#### 方式 A: 通过 Cloudflare Dashboard

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → 选择项目
3. 点击 **Settings** → **Environment variables**
4. 添加新变量:
   - **名称**: `RSA_PRIVATE_KEY`
   - **类型**: `Secret` (加密)
   - **值**: 粘贴完整的 PEM 私钥内容

#### 方式 B: 通过命令行

```powershell
# 为生产环境设置密钥
wrangler pages secret put RSA_PRIVATE_KEY
# 然后粘贴私钥内容，按 Ctrl+D 结束
```

### 第 6 步: 部署到 Cloudflare Pages

#### 首次部署:

```powershell
wrangler pages deploy . --project-name samacros
```

#### 后续更新:

```powershell
wrangler pages deploy .
```

**部署成功后，你会看到**:

```
✨ Deployment complete!
🌎 https://samacros.pages.dev
```

### 第 7 步: 绑定 KV 命名空间到项目

```powershell
wrangler pages deployment create . --kv ORDER_DB=<YOUR_KV_ID>
```

或在 Cloudflare Dashboard 中:
1. 进入项目 → **Settings** → **Functions**
2. **KV Namespace Bindings** → **Add binding**
   - Variable name: `ORDER_DB`
   - KV namespace: 选择刚才创建的

---

## 🧪 测试部署

### 本地测试:

```powershell
npm run dev
```

访问 http://localhost:8788

### 运行测试脚本:

```powershell
# 测试本地环境
node test-activation.js http://localhost:8788/api/activate

# 测试生产环境
node test-activation.js https://samacros.pages.dev/api/activate
```

---

## 🔧 故障排查

### 问题 1: "KV namespace not configured"

**原因**: KV 绑定未生效

**解决**:
```powershell
# 检查绑定
wrangler pages deployment list

# 重新绑定
wrangler pages deployment create . --kv ORDER_DB=<YOUR_KV_ID>
```

### 问题 2: "RSA private key not configured"

**原因**: 环境变量未设置

**解决**:
```powershell
# 检查密钥是否存在
wrangler pages secret list

# 重新设置
wrangler pages secret put RSA_PRIVATE_KEY
```

### 问题 3: 签名失败

**原因**: 私钥格式错误

**解决**:
- 确保私钥是 **PKCS#8** 格式 (以 `-----BEGIN PRIVATE KEY-----` 开头)
- 如果是 `-----BEGIN RSA PRIVATE KEY-----`，需要转换:

```powershell
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in private.pem -out private_pkcs8.pem
```

### 问题 4: 本地开发时 KV 无法使用

**解决**: 创建本地 KV 命名空间

```powershell
wrangler pages dev . --kv ORDER_DB
```

---

## 🌐 自定义域名 (可选)

1. 在 Cloudflare Dashboard 中进入项目
2. **Custom domains** → **Set up a custom domain**
3. 输入你的域名 (如 `activate.samacros.com`)
4. 按照提示更新 DNS 记录

---

## 📊 监控与日志

### 查看实时日志:

```powershell
wrangler pages deployment tail
```

### 查看 KV 存储的订单:

```powershell
wrangler kv:key list --binding=ORDER_DB
```

### 查看特定订单:

```powershell
wrangler kv:key get "ORD-20260218-ABCD1234" --binding=ORDER_DB
```

---

## 🔐 安全建议

1. **定期轮换密钥**: 每季度更新一次 RSA 密钥对
2. **监控异常请求**: 设置 Cloudflare Analytics 告警
3. **限制请求频率**: 考虑添加 Rate Limiting
4. **备份 KV 数据**: 定期导出订单记录

```powershell
# 导出所有订单
wrangler kv:key list --binding=ORDER_DB > orders_backup.json
```

---

## 📞 需要帮助?

- 查看 [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- 查看 [Cloudflare KV 文档](https://developers.cloudflare.com/kv/)
- 查看项目 [README.md](./README.md)

---

**祝部署顺利! 🎉**
