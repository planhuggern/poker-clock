import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { ensureAuthenticated } from '@shared/auth/authClient.js';

const root = document.getElementById('oslo-conquest-root');
if (root) {
  const reactRoot = ReactDOM.createRoot(root);
  ensureAuthenticated().finally(() => {
    reactRoot.render(<App />);
  });
}
