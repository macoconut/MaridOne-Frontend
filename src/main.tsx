import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './global.css';
import { initializeUiPreferences } from './lib/utils/uiPreferences';

initializeUiPreferences();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
