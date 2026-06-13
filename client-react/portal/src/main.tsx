import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ensureAuthenticated } from '@shared/auth/authClient.js';
import './style.css';

ensureAuthenticated().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
});
