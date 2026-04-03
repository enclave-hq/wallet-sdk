/**
 * Node CJS：从 dist/tron.js 再加载，避免主包 index.js 顶层拉取 @tronweb3/walletconnect-tron。
 */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type * as WcTronNS from '../adapters/tron/wallet-connect'

export function loadWalletConnectTronModule(): typeof WcTronNS {
  const here =
    typeof __filename !== 'undefined'
      ? __filename
      : fileURLToPath(import.meta.url)
  const req = createRequire(here)
  const tronBundle = here.endsWith('.mjs') ? 'tron.mjs' : 'tron.js'
  return req(join(dirname(here), tronBundle)) as typeof WcTronNS
}
