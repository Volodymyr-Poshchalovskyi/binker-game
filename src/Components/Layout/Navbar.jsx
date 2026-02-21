import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { GameContext } from '../../GameContext';

export default function Navbar() {
  const { clearGame } = useContext(GameContext);

  return (
    <nav className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4 flex justify-between items-center">
      <div className="flex gap-6 items-center">
        <Link to="/" className="text-zinc-100 font-black text-xl tracking-tighter uppercase flex items-center gap-2">
          <span>Bunker OS</span>
        </Link>
        <div className="flex gap-4">
          <Link to="/" className="text-zinc-400 hover:text-white transition-colors text-sm uppercase tracking-widest">Гра</Link>
          <Link to="/create" className="text-zinc-400 hover:text-white transition-colors text-sm uppercase tracking-widest">Нова партія</Link>
        </div>
      </div>
      <button 
        onClick={() => { if(window.confirm("Очистити все?")) clearGame(); }}
        className="text-zinc-500 border border-zinc-800 px-4 py-1.5 rounded-md hover:bg-zinc-900 hover:text-red-500 transition-all text-xs font-bold uppercase tracking-wider"
      >
        Reset System
      </button>
    </nav>
  );
}