import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build:{ manifest:true,rolldownOptions:{ output:{ codeSplitting:{ groups:[
    { name:'physics',test:/node_modules[\\/]@dimforge[\\/]/ },
    { name:'three',test:/node_modules[\\/]three[\\/]/ },
  ] } } } },
})
