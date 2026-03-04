import { Link } from 'react-router-dom';
import { useContext, useState } from 'react';
import { SocketContext } from '../../SocketContext';

export default function Navbar() {
  const { leaveRoom, isHost } = useContext(SocketContext);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirmReset = () => {
    leaveRoom();
    window.location.href = '/'; 
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4 flex justify-between items-center">
        <div className="flex gap-6 items-center">
          <Link to="/" className="text-zinc-100 font-black text-xl tracking-tighter uppercase flex items-center gap-2">
            <span>Zalupa OS</span>
          </Link>
        </div>
        <button 
          onClick={() => setConfirmOpen(true)}
          className="text-zinc-500 border border-zinc-800 px-4 py-1.5 rounded-md hover:bg-zinc-900 hover:text-red-500 transition-all text-xs font-bold uppercase tracking-wider"
        >
          Reset System
        </button>
      </nav>

      {/* КАСТОМНА МОДАЛКА ПІДТВЕРДЖЕННЯ */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-md w-full">
            <h3 className="text-lg font-bold text-zinc-100 mb-6 text-center leading-relaxed">
              {isHost 
                ? "УВАГА: Ви ведучий. Скидання системи знищить бункер і викине всіх гравців. Продовжити?" 
                : "Відключитися від терміналу та вийти в головне меню?"}
            </h3>
            <div className="flex gap-4">
              <button 
                onClick={() => setConfirmOpen(false)} 
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-lg uppercase tracking-wider transition-colors"
              >
                Скасувати
              </button>
              <button 
                onClick={handleConfirmReset} 
                className="flex-1 py-3 bg-red-900 hover:bg-red-800 text-white font-bold rounded-lg uppercase tracking-wider transition-colors shadow-[0_0_15px_rgba(153,27,27,0.3)]"
              >
                Продовжити
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}