// frontend/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactFlowProvider } from 'reactflow';

import App from './App';
import theme from './theme';
import './index.css';
import 'reactflow/dist/style.css';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Render application
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ReactFlowProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <App />
        </ThemeProvider>
      </ReactFlowProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

// Log application start
console.log('🚀 Data Lineage Dashboard started');
console.log('📍 Environment:', import.meta.env.MODE);
console.log('🔗 API URL:', import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1');