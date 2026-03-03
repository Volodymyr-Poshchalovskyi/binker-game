import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { SocketContext } from '../../SocketContext';

export default function Navbar() {
  const { leaveRoom } = useContext(SocketContext);

  const handleReset = () => {
    if(window.confirm("Відключитися від терміналу та вийти в головне меню?")) {
      leaveRoom();
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4 flex justify-between items-center">
      <div className="flex gap-6 items-center">
        {/* Клікабельне лого, яке просто веде на головну */}
        <Link to="/" className="text-zinc-100 font-black text-xl tracking-tighter uppercase flex items-center gap-2">
          <span>Bunker OS</span>
        </Link>
        {/* Прибрали лінки на сторінки, щоб не було плутанини */}
      </div>
      <button 
        onClick={handleReset}
        className="text-zinc-500 border border-zinc-800 px-4 py-1.5 rounded-md hover:bg-zinc-900 hover:text-red-500 transition-all text-xs font-bold uppercase tracking-wider"
      >
        Reset System
      </button>
    </nav>
  );
}