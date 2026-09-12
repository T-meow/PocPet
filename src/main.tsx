import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';
import './styles/index.css';
import { appearancePalette, readAppearance } from './ui/appearance';

Object.entries(appearancePalette(readAppearance())).forEach(([key, value]) => document.documentElement.style.setProperty(key, value));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
