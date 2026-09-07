# 二维码签名：为什么需要后端？

## 问题：为什么二维码签名需要后端？

这是一个很好的问题！让我详细解释一下两种方案的区别。

## 方案对比

### 方案 1：WalletConnect（无需后端）✅

**工作流程：**
```
1. 前端调用 walletManager.connect(WalletType.WALLETCONNECT)
   ↓
2. WalletConnect SDK 自动生成二维码（包含连接信息）
   ↓
3. 用户用钱包扫描二维码
   ↓
4. 钱包通过 WalletConnect 协议与前端建立 WebSocket 连接
   ↓
5. 签名结果直接通过 WebSocket 返回给前端
   ✅ 完成！无需后端
```

**为什么不需要后端？**
- WalletConnect 使用 **WebSocket 协议**，钱包和前端直接通信
- 签名结果通过 WebSocket 实时返回，不需要"中转站"

### 方案 2：自定义二维码（需要后端）⚠️

**工作流程：**
```
1. 前端生成二维码（包含签名请求URL，如：https://example.com/sign?requestId=123）
   ↓
2. 用户用钱包扫描二维码
   ↓
3. 钱包打开 URL（https://example.com/sign?requestId=123）
   ↓
4. 用户在钱包中确认签名
   ↓
5. 钱包将签名结果发送到后端 API（POST /api/sign/result）
   ↓
6. 前端轮询后端 API（GET /api/sign/status?requestId=123）
   ↓
7. 后端返回签名结果
   ✅ 完成！需要后端
```

**为什么需要后端？**
- 钱包扫描二维码后，打开的是一个 **HTTP URL**
- 钱包签名后，需要将结果发送到某个地方
- **前端无法直接接收钱包的签名结果**（因为钱包在移动设备上，前端在浏览器中）
- 后端作为"中转站"：
  - 接收钱包发送的签名结果
  - 存储签名结果
  - 提供轮询接口给前端查询

## 具体例子

### 场景：用户要签名消息 "Hello World"

#### 使用 WalletConnect（方案 1）

```typescript
// 1. 连接 WalletConnect（自动显示二维码）
const account = await walletManager.connect(WalletType.WALLETCONNECT, 1)

// 2. 签名消息（直接返回，无需轮询）
const signature = await walletManager.signMessage('Hello World')
// ✅ 签名结果直接返回：0x1234...
```

**不需要后端！** WalletConnect SDK 已经处理了所有通信。

#### 使用自定义二维码（方案 2）

```typescript
// 1. 创建签名请求（需要后端生成 requestId 和 requestUrl）
const response = await fetch('/api/sign/request', {
  method: 'POST',
  body: JSON.stringify({ message: 'Hello World' })
})
const { requestId, requestUrl } = await response.json()

// 2. 生成二维码
const signer = walletManager.createQRCodeSigner('Hello World', {
  requestId,
  requestUrl, // 例如：https://example.com/sign?requestId=123
  pollUrl: '/api/sign/status' // 前端轮询这个接口
})

// 3. 显示二维码
const qrCodeUrl = await signer.generateQRCode()

// 4. 开始轮询（等待钱包签名并发送到后端）
const signature = await signer.startPolling()
// ✅ 签名结果：0x1234...
```

**需要后端！** 因为：
1. 后端需要生成 `requestId` 和 `requestUrl`
2. 钱包签名后，需要调用后端 API 发送签名结果
3. 前端需要轮询后端 API 获取签名结果

## 后端需要做什么？

如果你选择方案 2，后端需要实现以下接口：

### 1. 创建签名请求

```typescript
POST /api/sign/request
{
  "message": "Hello World"
}

Response:
{
  "requestId": "sign-123",
  "requestUrl": "https://example.com/sign?requestId=sign-123&message=Hello%20World"
}
```

### 2. 接收钱包的签名结果（钱包会调用这个接口）

```typescript
POST /api/sign/result
{
  "requestId": "sign-123",
  "signature": "0x1234...",
  "signer": "0x5678..."
}
```

### 3. 提供轮询接口（前端轮询这个接口）

```typescript
GET /api/sign/status?requestId=sign-123

Response:
{
  "completed": true,
  "signature": "0x1234...",
  "signer": "0x5678..."
}
```

## 推荐方案

**对于大多数场景，推荐使用 WalletConnect（方案 1）：**

✅ 无需后端服务  
✅ 自动生成二维码  
✅ 签名结果直接返回  
✅ 支持 170+ 钱包  
✅ 更简单、更可靠  

**只有在以下情况才考虑方案 2：**
- 需要自定义二维码内容
- 使用非 WalletConnect 协议
- 需要特殊的签名流程

## 总结

| 方案 | 需要后端 | 复杂度 | 推荐度 |
|------|---------|--------|--------|
| WalletConnect | ❌ 不需要 | ⭐ 简单 | ⭐⭐⭐⭐⭐ |
| 自定义二维码 | ✅ 需要 | ⭐⭐⭐ 复杂 | ⭐⭐ |

**建议：优先使用 WalletConnect，除非有特殊需求。**



















