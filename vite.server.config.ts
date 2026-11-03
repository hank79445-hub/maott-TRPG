import { defineConfig } from 'vite'
export default defineConfig({
  ssr: { noExternal: true, external: ['sharp'] },
  build: {
    ssr: 'src/server/main.ts',
    outDir: '.local/server',
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'main.mjs' } },
  },
})
