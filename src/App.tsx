import { HashRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './lib/store';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import Home from './pages/Home';
import Board from './pages/Board';
import CalendarPage from './pages/CalendarPage';
import DigestPage from './pages/DigestPage';

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="board" element={<Board />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="digest" element={<DigestPage />} />
              <Route path="*" element={<Home />} />
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </StoreProvider>
  );
}
