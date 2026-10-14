import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@m/App';
import '@/app/globals.css';
import '@m/fonts.css';

// Dentro de un marco ajeno no se pinta nada: GitHub Pages no deja enviar la
// cabecera que lo prohíbe, así que se comprueba aquí (contra el «clickjacking»).
if (window.top === window.self) {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
