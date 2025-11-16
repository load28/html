import React from 'react';
import { createRoot } from 'react-dom/client';
import PDFViewer from './App';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <PDFViewer />
    </React.StrictMode>
  );
}
