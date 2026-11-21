import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './auth/AuthProvider'
import { LangueProvider } from './lib/i18n'
import App from './App'
import './index.css'

const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <LangueProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LangueProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
