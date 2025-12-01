/**
 * ImToken Deep Link Provider
 * 
 * 实现 ImToken 钱包的深度链接格式
 * 支持 EVM 和 TRON 链
 * 
 * 参考文档: https://imtoken.gitbook.io/developers/products/deep-linking
 */

import { ChainType } from '../../../core/types'
import { IDeepLinkProvider, DeepLinkSignMessageParams, DeepLinkSignTransactionParams, DeepLinkConnectParams } from './base'

export class ImTokenDeepLinkProvider implements IDeepLinkProvider {
  readonly name = 'ImToken'
  readonly icon = 'https://token.im/static/img/logo.png'
  readonly supportedChainTypes = [ChainType.EVM, ChainType.TRON]

  private callbackUrl?: string
  private callbackSchema?: string

  constructor(options?: {
    callbackUrl?: string
    callbackSchema?: string
  }) {
    this.callbackUrl = options?.callbackUrl
    this.callbackSchema = options?.callbackSchema
  }

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

  /**
   * Generate unique actionId
   */
  private generateActionId(): string {
    return `imtoken-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Get callback configuration
   */
  private getCallbackConfig(): { callbackSchema?: string; callbackUrl?: string } {
    if (this.callbackSchema) {
      return { callbackSchema: this.callbackSchema }
    }
    if (this.callbackUrl) {
      return { callbackUrl: this.callbackUrl }
    }
    // Default: use current page URL as callbackSchema
    if (typeof window !== 'undefined' && window.location) {
      return {
        callbackSchema: `${window.location.protocol}//${window.location.host}${window.location.pathname}`
      }
    }
    return {}
  }

  buildSignMessageLink(params: DeepLinkSignMessageParams): {
    url: string
    actionId: string
    callbackSchema?: string
    callbackUrl?: string
  } {
    const actionId = this.generateActionId()
    const callback = this.getCallbackConfig()

    // ImToken deep link format according to official docs
    // Format: imtokenv2://navigate/DappView?url={dappUrl}
    // For signing, we can open DApp in imToken's in-app browser
    // Note: ImToken doesn't have direct signMessage deep link, so we use DappView
    const dappUrl = `${window.location.origin}${window.location.pathname}?action=signMessage&message=${encodeURIComponent(params.message)}&chainId=${params.chainId}`
    const encodedDappUrl = encodeURIComponent(dappUrl)
    const url = `imtokenv2://navigate/DappView?url=${encodedDappUrl}`

    return {
      url,
      actionId,
      ...callback,
    }
  }

  buildSignTransactionLink(params: DeepLinkSignTransactionParams): {
    url: string
    actionId: string
    callbackSchema?: string
    callbackUrl?: string
  } {
    const actionId = this.generateActionId()
    const callback = this.getCallbackConfig()

    // ImToken deep link format according to official docs
    // Format: imtokenv2://navigate/DappView?url={dappUrl}
    // For signing transaction, we can open DApp in imToken's in-app browser
    const transactionData = typeof params.transaction === 'string'
      ? params.transaction
      : JSON.stringify(params.transaction)
    const dappUrl = `${window.location.origin}${window.location.pathname}?action=signTransaction&transaction=${encodeURIComponent(transactionData)}&chainId=${params.chainId}`
    const encodedDappUrl = encodeURIComponent(dappUrl)
    const url = `imtokenv2://navigate/DappView?url=${encodedDappUrl}`

    return {
      url,
      actionId,
      ...callback,
    }
  }

  buildConnectLink(params: DeepLinkConnectParams): {
    url: string
    actionId?: string
  } {
    // ImToken deep link format according to official docs
    // Format: imtokenv2://navigate/AssetsTab (home page)
    // Or: imtokenv2://navigate/DappView?url={dappUrl} (open DApp)
    const dappUrl = `${window.location.origin}${window.location.pathname}?action=connect&chainId=${params.chainId}`
    const encodedDappUrl = encodeURIComponent(dappUrl)
    const url = `imtokenv2://navigate/DappView?url=${encodedDappUrl}`

    return {
      url,
    }
  }

  parseCallbackResult(urlParams: URLSearchParams): {
    actionId: string | null
    result: any | null
    error: string | null
  } {
    const actionId = urlParams.get('actionId')
    const resultParam = urlParams.get('result')
    const error = urlParams.get('error')

    let result: any = null
    if (resultParam) {
      try {
        result = JSON.parse(decodeURIComponent(resultParam))
      } catch (e) {
        result = resultParam
      }
    }

    return {
      actionId,
      result,
      error,
    }
  }

  getDefaultCallbackSchema(): string {
    if (typeof window !== 'undefined' && window.location) {
      return `${window.location.protocol}//${window.location.host}${window.location.pathname}`
    }
    return ''
  }
}

