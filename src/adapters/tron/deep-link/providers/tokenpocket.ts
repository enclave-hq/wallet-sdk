/**
 * TokenPocket Deep Link Provider
 * 
 * 实现 TokenPocket 钱包的深度链接格式
 * 参考文档: https://help.tokenpocket.pro/developer-en/wallet/pull-up-wallet-with-deeplink
 */

import { IDeepLinkProvider, DeepLinkSignMessageParams, DeepLinkSignTransactionParams, DeepLinkConnectParams } from './base'

export class TokenPocketDeepLinkProvider implements IDeepLinkProvider {
  readonly name = 'TokenPocket'
  readonly icon = 'https://tokenpocket.pro/icon.png'

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
    // @ts-ignore
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
    return `web-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
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

  /**
   * Get chain ID as string (TokenPocket requires string format)
   */
  private getChainIdString(chainId?: number): string {
    return String(chainId || 195) // Default to TRON Mainnet
  }

  buildSignMessageLink(params: DeepLinkSignMessageParams): {
    url: string
    actionId: string
    callbackSchema?: string
    callbackUrl?: string
  } {
    const actionId = this.generateActionId()
    const chainId = this.getChainIdString(params.chainId)
    const callback = this.getCallbackConfig()

    // Build param object according to TokenPocket docs
    // See: https://help.tokenpocket.pro/developer-en/wallet/pull-up-wallet-with-deeplink
    const param: any = {
      action: 'sign',
      actionId: actionId,
      message: params.message,
      hash: false,
      signType: 'ethPersonalSign', // For TRON, we use ethPersonalSign
      memo: 'TRON message signature',
      blockchains: [{
        chainId: chainId,
        network: 'tron'
      }],
      dappName: 'Enclave Wallet SDK',
      dappIcon: 'https://walletconnect.com/walletconnect-logo.svg',
      protocol: 'TokenPocket',
      version: '1.1.8',
      expired: 0,
      ...callback,
    }

    const encodedParam = encodeURIComponent(JSON.stringify(param))
    const url = `tpoutside://pull.activity?param=${encodedParam}`

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
    const chainId = this.getChainIdString(params.chainId)
    const callback = this.getCallbackConfig()

    // Prepare transaction data
    let transactionData: string
    if (typeof params.transaction === 'string') {
      transactionData = params.transaction
    } else {
      transactionData = JSON.stringify(params.transaction)
    }

    // Build param object according to TokenPocket docs
    const param: any = {
      action: 'pushTransaction',
      actionId: actionId,
      txData: transactionData,
      blockchains: [{
        chainId: chainId,
        network: 'tron'
      }],
      dappName: 'Enclave Wallet SDK',
      dappIcon: 'https://walletconnect.com/walletconnect-logo.svg',
      protocol: 'TokenPocket',
      version: '1.1.8',
      expired: 0,
      ...callback,
    }

    const encodedParam = encodeURIComponent(JSON.stringify(param))
    const url = `tpoutside://pull.activity?param=${encodedParam}`

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
    const actionId = this.generateActionId()
    const chainId = this.getChainIdString(params.chainId)

    const param: any = {
      action: 'login',
      actionId: actionId,
      blockchains: [{
        chainId: chainId,
        network: 'tron'
      }],
      dappName: 'Enclave Wallet SDK',
      dappIcon: 'https://walletconnect.com/walletconnect-logo.svg',
      protocol: 'TokenPocket',
      version: '1.0',
      expired: 1602, // 30 minutes
    }

    const encodedParam = encodeURIComponent(JSON.stringify(param))
    const url = `tpoutside://pull.activity?param=${encodedParam}`

    return {
      url,
      actionId,
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

