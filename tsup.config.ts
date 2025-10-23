import { defineConfig } from 'tsup'

export default defineConfig([
  // Main package
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom'],
    treeshake: true,
    minify: false,
  },
  // React package
  {
    entry: ['src/react/index.tsx'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    outDir: 'dist/react',
    external: ['react', 'react-dom'],
    treeshake: true,
    minify: false,
  },
])

