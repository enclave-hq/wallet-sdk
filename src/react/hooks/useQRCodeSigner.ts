/**
 * useQRCodeSigner Hook
 * 
 * React hook for QR code signing functionality
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { QRCodeSigner, QRCodeSignStatus, QRCodeSignResult, QRCodeSignerConfig } from '../../utils/qrcode-signer'
import { SignatureRejectedError } from '../../core/errors'

/**
 * useQRCodeSigner 返回值
 */
export interface UseQRCodeSignerResult {
  /** 二维码 Data URL */
  qrCodeDataUrl: string | null
  /** 当前状态 */
  status: QRCodeSignStatus
  /** 签名结果 */
  result: QRCodeSignResult | null
  /** 是否正在轮询 */
  isPolling: boolean
  /** 开始签名（生成二维码并开始轮询） */
  startSign: () => Promise<string>
  /** 停止轮询 */
  stopPolling: () => void
  /** 取消签名 */
  cancel: () => void
  /** 错误信息 */
  error: Error | null
}

/**
 * useQRCodeSigner Hook
 * 
 * 用于二维码签名的 React Hook
 * 
 * @example
 * ```tsx
 * const { qrCodeDataUrl, status, startSign, cancel } = useQRCodeSigner({
 *   requestId: 'sign-123',
 *   requestUrl: 'https://example.com/sign?requestId=sign-123',
 *   pollUrl: 'https://api.example.com/sign/status',
 * })
 * 
 * const handleSign = async () => {
 *   try {
 *     const signature = await startSign()
 *     console.log('Signature:', signature)
 *   } catch (error) {
 *     console.error('Sign failed:', error)
 *   }
 * }
 * ```
 */
export function useQRCodeSigner(config: QRCodeSignerConfig): UseQRCodeSignerResult {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<QRCodeSignStatus>(QRCodeSignStatus.WAITING)
  const [result, setResult] = useState<QRCodeSignResult | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const signerRef = useRef<QRCodeSigner | null>(null)

  // 初始化 QRCodeSigner
  useEffect(() => {
    signerRef.current = new QRCodeSigner(config)
    return () => {
      signerRef.current?.cleanup()
    }
  }, [config.requestId, config.requestUrl, config.pollUrl])

  // 生成二维码
  const generateQRCode = useCallback(async () => {
    if (!signerRef.current) return

    try {
      const dataUrl = await signerRef.current.generateQRCode()
      setQrCodeDataUrl(dataUrl)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
    }
  }, [])

  // 开始签名
  const startSign = useCallback(async (): Promise<string> => {
    if (!signerRef.current) {
      throw new Error('QRCodeSigner not initialized')
    }

    setError(null)
    setStatus(QRCodeSignStatus.WAITING)
    setIsPolling(true)

    try {
      // 生成二维码
      await generateQRCode()

      // 开始轮询
      const signature = await signerRef.current.startPolling(
        (newStatus) => {
          setStatus(newStatus)
        },
        (signResult) => {
          setResult(signResult)
        }
      )

      setIsPolling(false)
      return signature
    } catch (err) {
      setIsPolling(false)
      const error = err instanceof Error ? err : new SignatureRejectedError(err instanceof Error ? err.message : String(err))
      setError(error)
      throw error
    }
  }, [generateQRCode])

  // 停止轮询
  const stopPolling = useCallback(() => {
    signerRef.current?.stopPolling()
    setIsPolling(false)
  }, [])

  // 取消签名
  const cancel = useCallback(() => {
    signerRef.current?.cancel()
    setStatus(QRCodeSignStatus.CANCELLED)
    setIsPolling(false)
  }, [])

  return {
    qrCodeDataUrl,
    status,
    result,
    isPolling,
    startSign,
    stopPolling,
    cancel,
    error,
  }
}

