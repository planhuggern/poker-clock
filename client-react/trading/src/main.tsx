import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ensureAuthenticated } from '@shared/auth/authClient.js';

ensureAuthenticated().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
});
