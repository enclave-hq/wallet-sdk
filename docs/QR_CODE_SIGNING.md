# 二维码签名功能

## 概述

二维码签名功能允许用户通过扫描二维码使用移动钱包进行签名，无需在浏览器中安装钱包扩展。

## 两种方案

### 方案 1：使用 WalletConnect（推荐，无需后端）✅

**WalletConnect 已经内置二维码功能，不需要后端服务！**

**支持 EVM 和 TRON 链！**

#### EVM 链示例

```typescript
import { WalletManager, WalletType } from '@enclave-hq/wallet-sdk'

const walletManager = new WalletManager({
  walletConnectProjectId: 'your-project-id' // 从 https://cloud.walletconnect.com 获取
})

// 连接 WalletConnect EVM（会自动显示二维码）
const account = await walletManager.connect(WalletType.WALLETCONNECT, 1)

// 签名消息（直接返回签名，无需轮询）
const signature = await walletManager.signMessage('Hello World')
```

#### TRON 链示例

```typescript
import { WalletManager, WalletType } from '@enclave-hq/wallet-sdk'

const walletManager = new WalletManager({
  walletConnectProjectId: 'your-project-id'
})

// 连接 WalletConnect Tron（会自动显示二维码）
const account = await walletManager.connect(WalletType.WALLETCONNECT_TRON, 195) // 195 = TRON 主网

// 签名消息（直接返回签名，无需轮询）
const signature = await walletManager.signMessage('Hello TRON')
```

**优点：**
- ✅ 无需后端服务
- ✅ 自动生成二维码
- ✅ 签名结果直接返回
- ✅ 支持 170+ 钱包

### 方案 2：自定义二维码签名（需要后端）

如果你需要自定义二维码内容或使用非 WalletConnect 协议，可以使用此方案。

**工作流程：**
1. 前端生成二维码（包含签名请求URL）
2. 用户扫描二维码，钱包打开URL
3. **钱包将签名结果发送到后端API** ← 这里需要后端
4. 前端轮询后端获取签名结果

**为什么需要后端？**
- 钱包扫描二维码后，需要将签名结果发送到某个地方
- 前端无法直接接收钱包的签名结果（因为钱包在移动设备上）
- 后端作为"中转站"，接收钱包的签名结果，前端再轮询获取

## 功能特性

- ✅ 生成二维码图片（Data URL）
- ✅ 自动轮询签名结果
- ✅ 支持自定义轮询函数
- ✅ React Hook 支持
- ✅ 模态框组件
- ✅ 状态管理（等待、已扫描、成功、失败等）

## 快速开始

### 方案 1：使用 WalletConnect（推荐）

```typescript
import { WalletManager, WalletType } from '@enclave-hq/wallet-sdk'

const walletManager = new WalletManager({
  walletConnectProjectId: 'your-project-id'
})

// 连接时会自动显示二维码
const account = await walletManager.connect(WalletType.WALLETCONNECT, 1)

// 签名消息（直接返回，无需轮询）
const signature = await walletManager.signMessage('Hello World')
console.log('Signature:', signature)
```

### 方案 2：自定义二维码签名（需要后端）

#### 基础用法（Vanilla JS/TS）

```typescript
import { WalletManager } from '@enclave-hq/wallet-sdk'

const walletManager = new WalletManager()

// 创建二维码签名器
const signer = walletManager.createQRCodeSigner('Hello World', {
  requestId: 'sign-123',
  requestUrl: 'https://example.com/sign?requestId=sign-123',
  pollUrl: 'https://api.example.com/sign/status',
  pollInterval: 2000, // 2秒轮询一次
  timeout: 300000, // 5分钟超时
})

// 生成二维码
const qrCodeDataUrl = await signer.generateQRCode()

// 显示二维码（例如在 <img> 标签中）
const img = document.createElement('img')
img.src = qrCodeDataUrl
document.body.appendChild(img)

// 开始轮询签名结果
try {
  const signature = await signer.startPolling(
    (status) => {
      console.log('Status changed:', status)
    },
    (result) => {
      console.log('Signature result:', result)
    }
  )
  console.log('Signature:', signature)
} catch (error) {
  console.error('Sign failed:', error)
}
```

### React Hook 用法

```tsx
import React, { useState } from 'react'
import { useQRCodeSigner, QRCodeModal } from '@enclave-hq/wallet-sdk/react'

function SignButton() {
  const [showModal, setShowModal] = useState(false)
  
  const { qrCodeDataUrl, status, startSign, cancel, error } = useQRCodeSigner({
    requestId: `sign-${Date.now()}`,
    requestUrl: `https://example.com/sign?requestId=sign-${Date.now()}`,
    pollUrl: 'https://api.example.com/sign/status',
  })

  const handleSign = async () => {
    setShowModal(true)
    try {
      const signature = await startSign()
      console.log('Signature:', signature)
      setShowModal(false)
    } catch (error) {
      console.error('Sign failed:', error)
    }
  }

  return (
    <>
      <button onClick={handleSign}>扫码签名</button>
      
      <QRCodeModal
        isOpen={showModal}
        onClose={() => {
          cancel()
          setShowModal(false)
        }}
        qrCodeDataUrl={qrCodeDataUrl}
        status={status}
        error={error}
        title="使用钱包扫码签名"
        description="请使用您的移动钱包扫描二维码完成签名"
      />
    </>
  )
}
```

## API 参考

### QRCodeSigner

二维码签名器类。

#### 构造函数

```typescript
new QRCodeSigner(config: QRCodeSignerConfig)
```

#### 配置选项

```typescript
interface QRCodeSignerConfig {
  /** 签名请求 ID（用于轮询结果） */
  requestId: string
  /** 签名请求 URL（二维码内容） */
  requestUrl: string
  /** 轮询结果的后端 API URL */
  pollUrl?: string
  /** 轮询间隔（毫秒），默认 2000ms */
  pollInterval?: number
  /** 超时时间（毫秒），默认 300000ms (5分钟) */
  timeout?: number
  /** 自定义轮询函数 */
  pollFn?: (requestId: string) => Promise<QRCodeSignResult | null>
}
```

#### 方法

##### `generateQRCode(options?)`

生成二维码图片（Data URL）。

```typescript
const qrCodeDataUrl = await signer.generateQRCode({
  width: 300,
  margin: 2,
  color: {
    dark: '#000000',
    light: '#FFFFFF',
  },
})
```

##### `startPolling(onStatusChange?, onResult?)`

开始轮询签名结果。

```typescript
const signature = await signer.startPolling(
  (status) => {
    console.log('Status:', status)
  },
  (result) => {
    console.log('Result:', result)
  }
)
```

##### `stopPolling()`

停止轮询。

```typescript
signer.stopPolling()
```

##### `cancel()`

取消签名请求。

```typescript
signer.cancel()
```

##### `getStatus()`

获取当前状态。

```typescript
const status = signer.getStatus()
```

##### `getQRCodeUrl()`

获取二维码 URL。

```typescript
const url = signer.getQRCodeUrl()
```

##### `getResult()`

获取签名结果。

```typescript
const result = signer.getResult()
```

##### `cleanup()`

清理资源。

```typescript
signer.cleanup()
```

### useQRCodeSigner Hook

React Hook 用于二维码签名。

```typescript
const {
  qrCodeDataUrl,  // 二维码 Data URL
  status,          // 当前状态
  result,          // 签名结果
  isPolling,      // 是否正在轮询
  startSign,      // 开始签名
  stopPolling,    // 停止轮询
  cancel,         // 取消签名
  error,          // 错误信息
} = useQRCodeSigner(config)
```

### QRCodeModal 组件

用于显示二维码的模态框组件。

```typescript
<QRCodeModal
  isOpen={boolean}
  onClose={() => void}
  qrCodeDataUrl={string | null}
  status={QRCodeSignStatus}
  error={Error | null}
  title?: string
  description?: string
/>
```

## 状态说明

### QRCodeSignStatus

```typescript
enum QRCodeSignStatus {
  WAITING = 'waiting',      // 等待扫描
  PENDING = 'pending',      // 已扫描，等待确认
  SUCCESS = 'success',      // 签名成功
  FAILED = 'failed',        // 签名失败
  TIMEOUT = 'timeout',      // 超时
  CANCELLED = 'cancelled',  // 已取消
}
```

## 后端集成（仅方案 2 需要）

**注意：如果你使用 WalletConnect（方案 1），则不需要后端！**

如果你使用自定义二维码签名（方案 2），则需要后端服务支持。后端需要：

1. **处理签名请求**：接收签名请求并生成唯一的 `requestId`
2. **提供签名 URL**：生成包含签名请求信息的 URL（用于二维码）
3. **处理签名结果**：接收钱包返回的签名结果（这是关键！钱包会调用这个接口）
4. **提供轮询接口**：返回签名状态和结果（前端轮询这个接口）

### 示例后端 API

#### 1. 创建签名请求

```typescript
POST /api/sign/request
{
  "message": "Hello World",
  "chainId": 1
}

Response:
{
  "requestId": "sign-123",
  "requestUrl": "https://example.com/sign?requestId=sign-123&message=Hello%20World"
}
```

#### 2. 轮询签名状态

```typescript
GET /api/sign/status?requestId=sign-123

Response:
{
  "completed": true,
  "signature": "0x...",
  "signer": "0x1234..."
}
```

#### 3. 钱包回调（可选）

```typescript
POST /api/sign/callback
{
  "requestId": "sign-123",
  "signature": "0x...",
  "signer": "0x1234..."
}
```

## 自定义轮询函数

如果后端 API 格式不同，可以使用自定义轮询函数：

```typescript
const signer = walletManager.createQRCodeSigner('Hello World', {
  requestId: 'sign-123',
  requestUrl: 'https://example.com/sign?requestId=sign-123',
  pollFn: async (requestId) => {
    const response = await fetch(`/api/custom/sign/${requestId}`)
    if (response.status === 404) {
      return null // 继续轮询
    }
    const data = await response.json()
    return {
      completed: data.status === 'completed',
      signature: data.signature,
      error: data.error,
      signer: data.signer,
    }
  },
})
```

## 完整示例

查看 `example/` 目录中的完整示例代码。

## 注意事项

1. **安全性**：确保签名请求 URL 使用 HTTPS
2. **超时设置**：根据实际需求设置合理的超时时间
3. **轮询频率**：避免过于频繁的轮询，建议 2-5 秒
4. **错误处理**：妥善处理网络错误和用户取消的情况
5. **资源清理**：组件卸载时记得调用 `cleanup()` 或 `cancel()`

