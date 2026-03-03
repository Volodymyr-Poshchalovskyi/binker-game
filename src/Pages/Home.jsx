import { useContext, useState, useEffect } from 'react';
import { SocketContext } from '../SocketContext';
import Lobby from './Lobby';

export default function Home() {
  const { gameState, isHost, me, roomCode, socket, updateGameState } = useContext(SocketContext);
  
  const [localTimeLeft, setLocalTimeLeft] = useState(60);

  useEffect(() => {
    if (!gameState?.timer) return;
    let interval;
    if (gameState.timer.isRunning) {
      interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((gameState.timer.endsAt - Date.now()) / 1000));
        setLocalTimeLeft(remaining);
        
        if (remaining === 0 && isHost) {
          clearInterval(interval);
          updateGameState({ ...gameState, timer: { isRunning: false, pausedLeft: 0, endsAt: null } });
        }
      }, 200); 
    } else {
      setLocalTimeLeft(gameState.timer.pausedLeft);
    }
    return () => clearInterval(interval);
  }, [gameState?.timer, isHost]);

  if (!gameState) return <Lobby />;

  const handleTimerAction = (action) => {
    if (!isHost) return;
    const newTimer = { ...gameState.timer };
    
    if (action === 'start') {
      newTimer.isRunning = true;
      newTimer.endsAt = Date.now() + newTimer.pausedLeft * 1000;
    } else if (action === 'pause') {
      newTimer.isRunning = false;
      newTimer.pausedLeft = localTimeLeft;
      newTimer.endsAt = null;
    } else if (action === 'reset') {
      newTimer.isRunning = false;
      newTimer.pausedLeft = 60;
      newTimer.endsAt = null;
    }
    updateGameState({ ...gameState, timer: newTimer });
  };

  const revealTraitAsHost = (targetPlayerId, traitIndex) => {
    if (isHost) {
      socket.emit('reveal_trait', { roomCode, targetPlayerId, traitIndex });
    }
  };

  const toggleNomination = (pIdx) => {
    if (!isHost) return;
    const newData = { ...gameState };
    newData.players = [...newData.players]; // Глибока копія для надійності React
    newData.players[pIdx] = { ...newData.players[pIdx], isNominated: !newData.players[pIdx].isNominated };
    updateGameState(newData);
  };

  const handleVote = (pId, delta) => {
    if (!isHost) return;
    const newData = { ...gameState };
    const pIndex = newData.players.findIndex(p => p.id === pId);
    if (pIndex > -1) {
      newData.players = [...newData.players]; // Глибока копія
      newData.players[pIndex] = { 
        ...newData.players[pIndex], 
        votes: Math.max(0, (newData.players[pIndex].votes || 0) + delta) 
      };
      updateGameState(newData);
    }
  };

  const kickPlayer = (pId) => {
    if (!isHost) return;
    if (window.confirm("Відкрити шлюз і вилучити гравця назавжди?")) {
      // Викликаємо серверну подію кіку!
      socket.emit('kick_player', { roomCode, targetPlayerId: pId });
    }
  };

  const myCard = gameState.players.find(p => p.id === me.id);
  const minutes = Math.floor(localTimeLeft / 60);
  const seconds = (localTimeLeft % 60).toString().padStart(2, '0');

  return (
    <div className="p-4 w-full mx-auto space-y-6 max-w-[2000px] animate-[fadeIn_0.5s_ease-out]">
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-zinc-900/80 border-l-4 border-red-900 p-4 rounded-r-xl shadow-lg hover:bg-zinc-900 transition-colors">
            <h2 className="text-red-500/80 font-bold uppercase text-[10px] tracking-[0.2em] mb-1">Зовнішня загроза</h2>
            <h3 className="text-zinc-100 text-lg font-bold mb-1 leading-tight">{gameState.macro.name}</h3>
            <p className="text-zinc-400 text-xs leading-relaxed">{gameState.macro.desc}</p>
          </div>
          <div className="bg-zinc-900/80 border-l-4 border-orange-700 p-4 rounded-r-xl shadow-lg hover:bg-zinc-900 transition-colors">
            <h2 className="text-orange-500/80 font-bold uppercase text-[10px] tracking-[0.2em] mb-1">Внутрішня криза</h2>
            <h3 className="text-zinc-100 text-lg font-bold mb-1 leading-tight">{gameState.micro.category}</h3>
            <p className="text-zinc-400 text-xs leading-relaxed">{gameState.micro.desc}</p>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl flex flex-col items-center justify-center relative overflow-hidden shadow-lg min-h-[120px]">
          <div className="absolute top-0 left-0 w-full h-1 bg-zinc-900">
            <div className={`h-full transition-all duration-200 ease-linear ${localTimeLeft < 10 ? 'bg-red-600' : 'bg-zinc-500'}`} style={{ width: `${(localTimeLeft / 60) * 100}%` }} />
          </div>
          <div className={`text-4xl lg:text-5xl font-mono font-light tracking-tighter mb-2 z-10 ${localTimeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-zinc-100'}`}>
            {minutes}:{seconds}
          </div>
          {isHost ? (
            <div className="flex gap-2 z-10 items-stretch mt-1">
              {!gameState.timer?.isRunning ? (
                <button onClick={() => handleTimerAction('start')} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-1.5 rounded text-xs uppercase font-bold transition-colors">Start</button>
              ) : (
                <button onClick={() => handleTimerAction('pause')} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-1.5 rounded text-xs uppercase font-bold transition-colors">Pause</button>
              )}
              <button onClick={() => handleTimerAction('reset')} className="bg-zinc-800 hover:bg-red-900 hover:text-white text-zinc-300 px-3 py-1.5 rounded text-sm uppercase font-bold transition-colors" title="Скинути">⟳</button>
            </div>
          ) : (
            <div className="text-zinc-600 text-[10px] uppercase tracking-widest font-bold mt-2 z-10">Таймер обговорення</div>
          )}
        </div>
      </div>

      {!isHost && myCard && (
        <div className="mb-4 bg-zinc-950/50 border border-green-900/40 rounded-xl shadow-[0_0_20px_rgba(20,83,45,0.1)] relative overflow-hidden flex flex-col md:flex-row items-center p-3 gap-4">
          <div className="absolute top-0 right-0 w-32 h-full bg-green-900/10 rounded-bl-full blur-2xl"></div>
          <div className="shrink-0 pl-2">
            <h2 className="text-green-500 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              Особова Справа
            </h2>
          </div>
          <div className="flex-1 flex flex-wrap gap-2 relative z-10">
            {myCard.traits.map((t, idx) => (
               <div key={idx} className="bg-zinc-900/80 px-2.5 py-1.5 rounded-md border border-zinc-800/80 text-xs flex gap-2 items-center hover:border-green-900/50 transition-colors">
                 <span className="text-zinc-500 font-medium" title={t.label}>{t.icon}</span>
                 <span className="text-zinc-200 truncate max-w-[150px]">{t.value}</span>
               </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {gameState.players.map((p, pIdx) => (
          <div key={p.id} className={`flex flex-col bg-zinc-900/90 rounded-xl border transition-all duration-300 ${p.isNominated ? 'border-red-900/60 bg-red-950/20 shadow-[0_0_20px_rgba(153,27,27,0.15)] scale-[1.01]' : 'border-zinc-800 hover:border-zinc-700'}`}>
            <div className="p-2.5 flex justify-between items-center border-b border-zinc-800/50">
              <h3 className="text-sm font-bold text-zinc-100 truncate pr-2">{p.name} {p.id === me.id ? <span className="text-zinc-500 text-[10px] ml-1">(Ти)</span> : ''}</h3>
              {isHost && (
                <button onClick={() => toggleNomination(pIdx)} className={`text-sm transition-transform hover:scale-125 ${p.isNominated ? 'opacity-100 drop-shadow-md' : 'opacity-30 grayscale'}`}>🎯</button>
              )}
            </div>

            <div className="p-2 flex-1 flex flex-col gap-1">
              {p.traits.map((t, tIdx) => (
                <div key={tIdx} className={`w-full flex items-start gap-2 px-2 py-1.5 rounded-md border text-[13px] transition-all duration-300
                    ${t.visible 
                      ? 'bg-zinc-800/80 border-zinc-600 text-zinc-100 shadow-inner' 
                      : 'bg-zinc-950/80 border-transparent text-zinc-600'}`}>
                  
                  <span className="shrink-0">{t.icon}</span>
                  
                  <div className="flex-1 truncate">
                    {t.visible ? (
                      <span className="animate-[fadeIn_0.5s_ease-out]">{t.value}</span>
                    ) : isHost ? (
                      <button 
                        onClick={() => revealTraitAsHost(p.id, tIdx)}
                        className="text-[11px] bg-zinc-800 hover:bg-zinc-700 hover:text-white px-1.5 py-1 rounded text-zinc-400 w-full text-left transition-all truncate"
                      >
                        [ {t.value} ]
                      </button>
                    ) : (
                      <span className="text-[10px] tracking-widest opacity-40 select-none uppercase font-bold">Приховано</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-2 bg-zinc-950 border-t border-zinc-800/80 flex justify-between items-center h-10">
              {isHost ? (
                <div className="flex items-center gap-0.5 bg-zinc-900/80 rounded border border-zinc-800">
                  <button onClick={() => handleVote(p.id, -1)} className="text-zinc-500 hover:text-red-400 px-2.5 py-1 transition-colors text-lg leading-none">-</button>
                  <span className="font-mono text-zinc-300 font-bold min-w-[20px] text-center text-sm">{p.votes || 0}</span>
                  <button onClick={() => handleVote(p.id, 1)} className="text-zinc-500 hover:text-green-400 px-2.5 py-1 transition-colors text-lg leading-none">+</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-1">
                  <span className="text-zinc-600 text-xs font-bold uppercase tracking-wider">Голоси:</span>
                  <span className="font-mono font-bold text-zinc-300 text-sm">{p.votes || 0}</span>
                </div>
              )}

              {isHost && (
                <button onClick={() => kickPlayer(p.id)} title="Вигнати з бункера" className="text-zinc-600 hover:text-red-500 p-1.5 rounded-md transition-colors hover:bg-red-950/30 text-sm">
                  ☠️
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}