// frontend/src/index.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { Buffer } from 'buffer';
import process from 'process';

if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

if (typeof window !== 'undefined') {
  if (!window.global) {
    window.global = window;
  }
  if (!window.process) {
    window.process = process;
  }
  if (!window.process.env) {
    window.process.env = {};
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


