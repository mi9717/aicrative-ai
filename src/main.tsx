import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import SharedAccessGate from './SharedAccessGate';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <SharedAccessGate>
    <App />
  </SharedAccessGate>
);
