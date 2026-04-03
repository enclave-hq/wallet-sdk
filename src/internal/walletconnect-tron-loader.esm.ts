/**
 * ESM / 浏览器打包：与历史行为一致，顶层绑定 wallet-connect（供 Next 等打成一个 client chunk）。
 */
import type * as WcTronNS from '../adapters/tron/wallet-connect'
import * as mod from '../adapters/tron/wallet-connect'

export function loadWalletConnectTronModule(): typeof WcTronNS {
  return mod
}
