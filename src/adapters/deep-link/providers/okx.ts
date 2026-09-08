/**
 * OKX Deep Link Provider
 * 
 * 实现 OKX 钱包的深度链接格式
 * 支持 EVM 和 TRON 链
 * 
 * 参考文档: https://web3.okx.com/zh-hans/build/docs/waas/app-universal-link
 */

import { ChainType } from '../../../core/types'
import type { IDeepLinkProvider, DeepLinkSignMessageParams, DeepLinkSignTransactionParams, DeepLinkConnectParams } from './base'

export class OKXDeepLinkProvider implements IDeepLinkProvider {
  readonly name = 'OKX'
  readonly icon = 'https://www.okx.com/favicon.ico'
  readonly supportedChainTypes = [ChainType.EVM, ChainType.TRON]

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
    // OKX deep link format: okx://wallet/dapp/url?dappUrl={dappUrl}
    // For signing, we open the DApp in OKX's in-app browser
    const dappUrl = `${window.location.origin}${window.location.pathname}?action=signMessage&message=${encodeURIComponent(params.message)}&chainId=${params.chainId}`
    const encodedDappUrl = encodeURIComponent(dappUrl)
    const url = `okx://wallet/dapp/url?dappUrl=${encodedDappUrl}`
    const actionId = `okx-${Date.now()}`

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
    // OKX deep link format: okx://wallet/dapp/url?dappUrl={dappUrl}
    const transactionData = typeof params.transaction === 'string'
      ? params.transaction
      : JSON.stringify(params.transaction)
    const dappUrl = `${window.location.origin}${window.location.pathname}?action=signTransaction&transaction=${encodeURIComponent(transactionData)}&chainId=${params.chainId}`
    const encodedDappUrl = encodeURIComponent(dappUrl)
    const url = `okx://wallet/dapp/url?dappUrl=${encodedDappUrl}`
    const actionId = `okx-${Date.now()}`

    return {
      url,
      actionId,
    }
  }

  buildConnectLink(params: DeepLinkConnectParams): {
    url: string
    actionId?: string
  } {
    // OKX deep link format: okx://wallet/dapp/url?dappUrl={dappUrl}
    const dappUrl = `${window.location.origin}${window.location.pathname}?action=connect&chainId=${params.chainId}`
    const encodedDappUrl = encodeURIComponent(dappUrl)
    const url = `okx://wallet/dapp/url?dappUrl=${encodedDappUrl}`

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

