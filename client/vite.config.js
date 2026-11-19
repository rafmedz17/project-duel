import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build:{ manifest:true,rolldownOptions:{ input:{ main:resolve(import.meta.dirname,'index.html'),vexPreview:resolve(import.meta.dirname,'vex-preview.html') },output:{ codeSplitting:{ groups:[
    { name:'physics',test:/node_modules[\\/]@dimforge[\\/]/ },
    { name:'three',test:/node_modules[\\/]three[\\/]/ },
  ] } } } },
})

