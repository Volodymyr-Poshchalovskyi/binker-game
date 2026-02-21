// src/App.jsx
import { BrowserRouter as Router } from 'react-router-dom';
import Layout from './Components/Layout/Layout';
import AppRouter from './Routes/Router';
import { GameProvider } from './GameContext'; // Переконайся, що шлях правильний

export default function App() {
  return (
    <Router>
      <GameProvider>
        <Layout>
          <AppRouter />
        </Layout>
      </GameProvider>
    </Router>
  );
}