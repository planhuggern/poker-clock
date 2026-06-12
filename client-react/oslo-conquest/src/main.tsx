import ReactDOM from 'react-dom/client';
import { App } from './App.js';

const root = document.getElementById('oslo-conquest-root');
if (root) {
  ReactDOM.createRoot(root).render(<App />);
}
