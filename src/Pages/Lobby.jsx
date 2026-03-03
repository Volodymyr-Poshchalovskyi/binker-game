import { useContext, useState } from 'react';
import { SocketContext } from '../SocketContext';
import { Link } from 'react-router-dom';

export default function Lobby() {
  const { me, setMe, createRoom, joinRoom, roomCode, roomPlayers, isHost } = useContext(SocketContext);
  const [joinCode, setJoinCode] = useState('');
  const [isEditingName, setIsEditingName] = useState(!me.name);
  const [tempName, setTempName] = useState(me.name || '');
  const [copied, setCopied] = useState(false);

  const saveName = () => {
    if (tempName.trim()) {
      setMe({ ...me, name: tempName.trim() });
      setIsEditingName(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isEditingName) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] space-y-6 animate-[fadeIn_0.5s_ease-out]">
        <div className="bg-zinc-900/80 p-10 rounded-2xl border border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center text-center max-w-md w-full">
          <h1 className="text-3xl font-black uppercase text-zinc-100 mb-2 tracking-widest">Bunker OS</h1>
          <p className="text-zinc-500 mb-8 text-sm uppercase">Ідентифікація особи</p>
          <input 
            type="text" 
            placeholder="Ваш позивний" 
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            className="w-full p-4 bg-zinc-950 border border-zinc-700 rounded-lg text-center text-white text-xl outline-none focus:border-red-800 transition-colors mb-4"
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
            autoFocus
          />
          <button onClick={saveName} className="w-full py-4 bg-red-900 hover:bg-red-800 text-white font-bold rounded-lg uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(153,27,27,0.4)]">
            Підтвердити
          </button>
        </div>
      </div>
    );
  }

  if (!roomCode) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] space-y-10 animate-[fadeIn_0.5s_ease-out]">
        <div className="text-center group cursor-pointer" onClick={() => setIsEditingName(true)} title="Натисни, щоб змінити ім'я">
          <p className="text-zinc-500 text-sm uppercase tracking-widest mb-2">Авторизовано як</p>
          <h2 className="text-4xl font-bold text-zinc-200 group-hover:text-white transition-colors border-b border-dashed border-zinc-700 pb-1">{me.name} ✎</h2>
        </div>

        <div className="flex flex-col md:flex-row gap-8 items-center bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800/50">
          <button onClick={createRoom} className="w-full md:w-auto px-8 py-4 bg-red-900/90 hover:bg-red-800 text-white font-bold rounded-xl uppercase tracking-widest transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(153,27,27,0.3)] border border-red-700">
            Створити Бункер
          </button>
          
          <div className="hidden md:block w-px h-16 bg-zinc-800"></div>
          <div className="md:hidden h-px w-full bg-zinc-800"></div>

          <div className="flex flex-col space-y-3 w-full md:w-auto">
            <input 
              type="text" 
              placeholder="КОД КІМНАТИ" 
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={5}
              className="p-3 bg-zinc-950 border border-zinc-700 rounded-xl text-center text-white font-mono tracking-[0.3em] uppercase outline-none focus:border-zinc-500 transition-colors"
            />
            <button onClick={() => joinRoom(joinCode)} className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-bold uppercase tracking-widest transition-colors">
              Приєднатися
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8 text-center animate-[fadeIn_0.5s_ease-out]">
      <div className="bg-zinc-900/80 p-8 rounded-2xl border border-zinc-800">
        <h2 className="text-zinc-500 uppercase tracking-widest text-sm mb-4">Код доступу до бункера</h2>
        <div 
          onClick={copyCode}
          className="text-7xl font-mono font-black text-white tracking-[0.2em] drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] cursor-pointer hover:text-zinc-300 transition-colors"
          title="Натисніть, щоб скопіювати"
        >
          {roomCode}
        </div>
        <p className={`text-xs mt-3 uppercase tracking-widest font-bold transition-colors ${copied ? 'text-green-500' : 'text-zinc-500'}`}>
          {copied ? '✓ КОД СКОПІЙОВАНО' : 'Натисни на код, щоб скопіювати'}
        </p>
      </div>
      
      <div>
        <h3 className="text-xl mb-6 text-zinc-400 uppercase tracking-widest">Очікування виживших ({roomPlayers.length})</h3>
        <div className="flex flex-wrap justify-center gap-3">
          {roomPlayers.map((p, i) => (
            <span key={p.id} className="px-5 py-2.5 bg-zinc-900 border border-zinc-700 rounded-full text-zinc-200 font-medium shadow-sm animate-[fadeIn_0.3s_ease-out]" style={{ animationDelay: `${i * 0.1}s` }}>
              {p.name} {p.id === me.id && <span className="text-zinc-500 ml-1">(Ти)</span>}
              {roomPlayers[0].id === p.id && <span className="text-red-500 ml-2 text-xs uppercase">Ведучий</span>}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-16 text-center">
        {isHost ? (
          <div className="space-y-4 animate-bounce">
            <Link to="/create" className="px-10 py-4 bg-red-900 hover:bg-red-800 text-white font-black rounded-xl uppercase tracking-[0.2em] inline-block transition-all shadow-[0_0_30px_rgba(153,27,27,0.5)] hover:scale-105">
              Почати генерацію
            </Link>
          </div>
        ) : (
          <div className="text-zinc-500 animate-pulse text-lg uppercase tracking-widest mt-12 bg-zinc-900/50 p-4 rounded-xl inline-block border border-zinc-800/50">
            Очікуємо дій ведучого...
          </div>
        )}
      </div>
    </div>
  );
}