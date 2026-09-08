/**
 * TronLink Deep Link Provider
 * 
 * 实现 TronLink 钱包的深度链接格式
 * 主要支持 TRON 链
 * 
 * 参考文档: https://docs.tronlink.org/zh/mobile/deeplink
 */

import { ChainType } from '../../../core/types'
import type { IDeepLinkProvider, DeepLinkSignMessageParams, DeepLinkSignTransactionParams, DeepLinkConnectParams } from './base'

export class TronLinkDeepLinkProvider implements IDeepLinkProvider {
  readonly name = 'TronLink'
  readonly icon = 'https://www.tronlink.org/static/logoIcon.svg'
  readonly supportedChainTypes = [ChainType.TRON]

  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false
    }

    // Check if in Telegram Mini App
    // @ts-expect-error - Telegram WebApp is not in standard types
    const isTelegramMiniApp = !!(window.Telegram && window.Telegram.WebApp)
    if (isTelegramMiniApp) {
      return true
    }

    // Check if mobile device
    const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )

    return isMobile
  }

  buildSignMessageLink(params: DeepLinkSignMessageParams): {
    url: string
    actionId: string
    callbackSchema?: string
    callbackUrl?: string
  } {
    if (params.chainType !== ChainType.TRON) {
      throw new Error('TronLink only supports TRON chain')
    }

    const encodedMessage = encodeURIComponent(params.message)
    const url = `tronlink://signMessage?message=${encodedMessage}`
    
    // TronLink may not support callback, so we use a simple actionId for tracking
    const actionId = `tronlink-${Date.now()}`

    return {
      url,
      actionId,
    }
  }

  buildSignTransactionLink(params: DeepLinkSignTransactionParams): {
    url: string
    actionId: string
    callbackSchema?: string
    callbackUrl?: string
  } {
    if (params.chainType !== ChainType.TRON) {
      throw new Error('TronLink only supports TRON chain')
    }

    const transactionData = typeof params.transaction === 'string'
      ? params.transaction
      : JSON.stringify(params.transaction)
    const encodedData = encodeURIComponent(transactionData)
    const url = `tronlink://signTransaction?transaction=${encodedData}`
    
    // TronLink may not support callback, so we use a simple actionId for tracking
    const actionId = `tronlink-${Date.now()}`

    return {
      url,
      actionId,
    }
  }

  buildConnectLink(params: DeepLinkConnectParams): {
    url: string
    actionId?: string
  } {
    if (params.chainType !== ChainType.TRON) {
      throw new Error('TronLink only supports TRON chain')
    }

    const url = `tronlink://open?action=connect&network=tron`
    
    return {
      url,
    }
  }

  parseCallbackResult(_urlParams: URLSearchParams): {
    actionId: string | null
    result: any | null
    error: string | null
  } {
    // TronLink may not support standard callback format
    // This is a placeholder for future implementation
    return {
      actionId: null,
      result: null,
      error: null,
    }
  }
}

