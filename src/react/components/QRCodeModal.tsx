/**
 * QRCodeModal Component
 * 
 * Modal component for displaying QR code for signing
 */

import React, { useEffect } from 'react'
import { QRCodeSignStatus } from '../../utils/qrcode-signer'

/**
 * QRCodeModal Props
 */
export interface QRCodeModalProps {
  /** 是否显示 */
  isOpen: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 二维码 Data URL */
  qrCodeDataUrl: string | null
  /** 当前状态 */
  status: QRCodeSignStatus
  /** 错误信息 */
  error?: Error | null
  /** 自定义标题 */
  title?: string
  /** 自定义描述 */
  description?: string
}

/**
 * QRCodeModal Component
 * 
 * 用于显示二维码签名的模态框组件
 * 
 * @example
 * ```tsx
 * <QRCodeModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   qrCodeDataUrl={qrCodeDataUrl}
 *   status={status}
 *   error={error}
 * />
 * ```
 */
export function QRCodeModal({
  isOpen,
  onClose,
  qrCodeDataUrl,
  status,
  error,
  title = '扫码签名',
  description,
}: QRCodeModalProps) {
  // 阻止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const getStatusText = () => {
    switch (status) {
      case QRCodeSignStatus.WAITING:
        return '请使用钱包扫描二维码'
      case QRCodeSignStatus.PENDING:
        return '已扫描，请在钱包中确认签名'
      case QRCodeSignStatus.SUCCESS:
        return '签名成功'
      case QRCodeSignStatus.FAILED:
        return '签名失败'
      case QRCodeSignStatus.TIMEOUT:
        return '签名超时'
      case QRCodeSignStatus.CANCELLED:
        return '已取消'
      default:
        return '等待扫描'
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case QRCodeSignStatus.WAITING:
      case QRCodeSignStatus.PENDING:
        return '#3b82f6' // blue
      case QRCodeSignStatus.SUCCESS:
        return '#10b981' // green
      case QRCodeSignStatus.FAILED:
      case QRCodeSignStatus.TIMEOUT:
      case QRCodeSignStatus.CANCELLED:
        return '#ef4444' // red
      default:
        return '#6b7280' // gray
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 600,
              color: '#111827',
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: 0,
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Description */}
        {description && (
          <p
            style={{
              margin: '0 0 20px 0',
              fontSize: '14px',
              color: '#6b7280',
            }}
          >
            {description}
          </p>
        )}

        {/* QR Code */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '20px',
          }}
        >
          {qrCodeDataUrl ? (
            <img
              src={qrCodeDataUrl}
              alt="QR Code"
              style={{
                width: '100%',
                maxWidth: '300px',
                height: 'auto',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
            />
          ) : (
            <div
              style={{
                width: '300px',
                height: '300px',
                backgroundColor: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                color: '#6b7280',
              }}
            >
              生成二维码中...
            </div>
          )}
        </div>

        {/* Status */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '6px',
              backgroundColor: `${getStatusColor()}15`,
              color: getStatusColor(),
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            {status === QRCodeSignStatus.WAITING && (
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(),
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }}
              />
            )}
            {status === QRCodeSignStatus.PENDING && (
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(),
                }}
              />
            )}
            {status === QRCodeSignStatus.SUCCESS && '✓'}
            {status === QRCodeSignStatus.FAILED && '✕'}
            {getStatusText()}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              marginBottom: '20px',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: '14px',
                color: '#dc2626',
              }}
            >
              {error.message}
            </p>
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px 20px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: '#ffffff',
              color: '#374151',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {status === QRCodeSignStatus.SUCCESS ? '关闭' : '取消'}
          </button>
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  )
}



















