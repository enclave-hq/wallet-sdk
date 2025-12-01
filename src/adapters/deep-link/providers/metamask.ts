/**
 * MetaMask Deep Link Provider
 * 
 * 实现 MetaMask 钱包的深度链接格式
 * 支持 EVM 链
 * 
 * 参考文档: https://docs.metamask.io/sdk/guides/use-deeplinks
 */

import { ChainType } from '../../../core/types'
import { IDeepLinkProvider, DeepLinkSignMessageParams, DeepLinkSignTransactionParams, DeepLinkConnectParams } from './base'

export class MetaMaskDeepLinkProvider implements IDeepLinkProvider {
  readonly name = 'MetaMask'
  readonly icon = 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg'
  readonly supportedChainTypes = [ChainType.EVM]

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
    if (params.chainType !== ChainType.EVM) {
      throw new Error('MetaMask only supports EVM chains')
    }

    // MetaMask deep link format: https://link.metamask.io/dapp/{dappUrl}
    // For signing, we open the DApp in MetaMask's in-app browser
    const dappUrl = `${window.location.origin}${window.location.pathname}?action=signMessage&message=${encodeURIComponent(params.message)}&chainId=${params.chainId}`
    const encodedDappUrl = encodeURIComponent(dappUrl)
    const url = `https://link.metamask.io/dapp/${encodedDappUrl}`
    const actionId = `metamask-${Date.now()}`

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
    if (params.chainType !== ChainType.EVM) {
      throw new Error('MetaMask only supports EVM chains')
    }

    // MetaMask supports sending native currency or ERC-20 tokens
    // Format: https://link.metamask.io/send/{recipient}@{chainId}?value={amount}
    // For generic transaction signing, we use DApp link
    const transactionData = typeof params.transaction === 'string'
      ? params.transaction
      : JSON.stringify(params.transaction)
    const dappUrl = `${window.location.origin}${window.location.pathname}?action=signTransaction&transaction=${encodeURIComponent(transactionData)}&chainId=${params.chainId}`
    const encodedDappUrl = encodeURIComponent(dappUrl)
    const url = `https://link.metamask.io/dapp/${encodedDappUrl}`
    const actionId = `metamask-${Date.now()}`

    return {
      url,
      actionId,
    }
  }

  buildConnectLink(params: DeepLinkConnectParams): {
    url: string
    actionId?: string
  } {
    if (params.chainType !== ChainType.EVM) {
      throw new Error('MetaMask only supports EVM chains')
    }

    // MetaMask deep link format: https://link.metamask.io/dapp/{dappUrl}
    const dappUrl = `${window.location.origin}${window.location.pathname}?action=connect&chainId=${params.chainId}`
    const encodedDappUrl = encodeURIComponent(dappUrl)
    const url = `https://link.metamask.io/dapp/${encodedDappUrl}`

    return {
      url,
    }
  }

  parseCallbackResult(urlParams: URLSearchParams): {
    actionId: string | null
    result: any | null
    error: string | null
  } {
    // MetaMask may not support standard callback format
    // This is a placeholder for future implementation
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

