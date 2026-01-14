import React from 'react';
import ReactDOM from 'react-dom/client';
import { ReactFlowProvider } from 'reactflow';  // ← Add this import
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ReactFlowProvider>  {/* ← Wrap App with ReactFlowProvider */}
      <App />
    </ReactFlowProvider>
  </React.StrictMode>
);