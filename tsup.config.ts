import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsup'

const rootDir = dirname(fileURLToPath(import.meta.url))
const loaderCjs = resolve(rootDir, 'src/internal/walletconnect-tron-loader.cjs.ts')
const loaderEsm = resolve(rootDir, 'src/internal/walletconnect-tron-loader.esm.ts')
const LOADER_ALIAS = 'wallet-sdk-tron-loader'

export default defineConfig([
  // Main + Tron entry (CJS)：主包不打包 @tronweb3/walletconnect-tron，运行时 require 同级 tron.js
  {
    entry: ['src/index.ts', 'src/tron.ts'],
    format: ['cjs'],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom'],
    treeshake: true,
    minify: false,
    esbuildOptions(options) {
      options.alias = {
        ...options.alias,
        [LOADER_ALIAS]: loaderCjs,
      }
    },
  },
  // Main + Tron entry (ESM)：与 Next 等浏览器打包兼容，Tron WC 仍在主图里
  {
    entry: ['src/index.ts', 'src/tron.ts'],
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    external: ['react', 'react-dom'],
    treeshake: true,
    minify: false,
    esbuildOptions(options) {
      options.alias = {
        ...options.alias,
        [LOADER_ALIAS]: loaderEsm,
      }
    },
  },
  // React 子包
  {
    entry: ['src/react/index.tsx'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    outDir: 'dist/react',
    external: ['react', 'react-dom'],
    treeshake: true,
    minify: false,
  },
])
