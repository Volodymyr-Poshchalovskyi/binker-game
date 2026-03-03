import { useContext, useState, useEffect } from 'react';
import { SocketContext } from '../SocketContext';
import Lobby from './Lobby';
import { TRAITS_DB, getRandom } from '../db'; // Імпортуємо БД для реролу

// Компонент редактора характеристик (тільки для Хоста)
const HostTraitEditor = ({ pId, tIdx, trait, onUpdate, onReroll, onReveal }) => {
  const [val, setVal] = useState(trait.value);
  
  // Оновлюємо локальний стейт, якщо дані прийшли з сервера
  useEffect(() => { setVal(trait.value); }, [trait.value]);

  return (
    <div className="flex flex-col gap-1 w-full animate-[fadeIn_0.3s_ease-out]">
      {!trait.visible && (
        <button 
          onClick={() => onReveal(pId, tIdx)}
          className="text-[10px] bg-red-900/80 hover:bg-red-700 px-2 py-0.5 rounded text-white font-bold tracking-wider self-start transition-colors"
        >
          ВІДКРИТИ ВСІМ
        </button>
      )}
      <div className="flex items-start gap-1 w-full mt-0.5">
        <textarea
          className="flex-1 bg-zinc-950/80 border border-zinc-700/50 focus:border-red-900/80 rounded p-1.5 text-zinc-200 outline-none text-[12px] resize-y min-h-[32px] w-full transition-colors leading-tight"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => { if(val !== trait.value) onUpdate(pId, tIdx, val); }} // Зберігаємо на сервер тільки коли прибрали фокус (щоб не лагало)
          title="Натисни, щоб змінити текст вручну"
        />
        <button 
          onClick={() => onReroll(pId, tIdx, trait.label)} 
          className="shrink-0 p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-[14px] transition-all hover:scale-110"
          title="Випадкове значення (Рандом)"
        >
          🎲
        </button>
      </div>
    </div>
  );
};

export default function Home() {
  const { gameState, isHost, me, roomCode, socket, updateGameState } = useContext(SocketContext);
  
  const [localTimeLeft, setLocalTimeLeft] = useState(60);
  const [kickTarget, setKickTarget] = useState(null); 

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

  // Збереження ручного редагування тексту характеристики
  const handleTraitChange = (pId, tIdx, newVal) => {
    if (!isHost) return;
    const newData = { ...gameState };
    const pIndex = newData.players.findIndex(p => p.id === pId);
    if (pIndex > -1) {
      newData.players = [...newData.players]; 
      newData.players[pIndex] = { ...newData.players[pIndex] };
      newData.players[pIndex].traits = [...newData.players[pIndex].traits];
      newData.players[pIndex].traits[tIdx] = { ...newData.players[pIndex].traits[tIdx], value: newVal };
      updateGameState(newData);
    }
  };

  // Логіка рандомного реролу конкретної характеристики
  const handleTraitReroll = (pId, tIdx, label) => {
    if (!isHost) return;
    let newValue = '';
    
    if (label === 'Стать та вік') {
      const sex = Math.random() > 0.5 ? "Чоловік" : "Жінка";
      const age = Math.floor(Math.random() * 45) + 18;
      newValue = `${sex}, ${age} р.`;
    } else if (label === 'Професія') {
      newValue = getRandom(TRAITS_DB.professions).name; 
    } else if (label === 'Здоров\'я') {
      const h = getRandom(TRAITS_DB.health);
      newValue = `${h.val}% (${h.name})`;
    } else if (label === 'Хобі') {
      newValue = getRandom(TRAITS_DB.hobbies);
    } else if (label === 'Фобія') {
      newValue = getRandom(TRAITS_DB.phobias);
    } else if (label === 'Багаж') {
      newValue = getRandom(TRAITS_DB.luggage);
    } else if (label === 'Великий багаж') {
      newValue = getRandom(TRAITS_DB.large_luggage);
    } else if (label === 'Факт' || label === 'Приховано') {
      newValue = getRandom(TRAITS_DB.facts);
    } else if (label.startsWith('Дія')) {
      newValue = getRandom(TRAITS_DB.actions);
    } else {
      newValue = "Оновлене значення";
    }

    handleTraitChange(pId, tIdx, newValue);
  };

  const toggleNomination = (pIdx) => {
    if (!isHost) return;
    const newData = { ...gameState };
    newData.players = [...newData.players]; 
    newData.players[pIdx] = { ...newData.players[pIdx], isNominated: !newData.players[pIdx].isNominated };
    updateGameState(newData);
  };

  const handleVote = (pId, delta) => {
    if (!isHost) return;
    const newData = { ...gameState };
    const pIndex = newData.players.findIndex(p => p.id === pId);
    if (pIndex > -1) {
      newData.players = [...newData.players]; 
      newData.players[pIndex] = { 
        ...newData.players[pIndex], 
        votes: Math.max(0, (newData.players[pIndex].votes || 0) + delta) 
      };
      updateGameState(newData);
    }
  };

  const confirmKick = () => {
    if (!kickTarget) return;
    const pId = kickTarget.id;
    
    const remainingPlayers = gameState.players.filter(p => p.id !== pId);
    const resetPlayers = remainingPlayers.map(p => ({
      ...p,
      votes: 0,
      isNominated: false
    }));

    updateGameState({ ...gameState, players: resetPlayers });
    socket.emit('kick_player', { roomCode, targetPlayerId: pId });
    setKickTarget(null); 
  };

  const myCard = gameState.players.find(p => p.id === me.id);
  const minutes = Math.floor(localTimeLeft / 60);
  const seconds = (localTimeLeft % 60).toString().padStart(2, '0');

  return (
    <>
      <div className="p-4 w-full mx-auto space-y-6 max-w-[2000px] animate-[fadeIn_0.5s_ease-out]">
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-900/80 border-l-4 border-red-900 p-4 rounded-r-xl shadow-lg hover:bg-zinc-900 transition-colors flex flex-col">
              <h2 className="text-red-500/80 font-bold uppercase text-[10px] tracking-[0.2em] mb-1">Зовнішня загроза</h2>
              <h3 className="text-zinc-100 text-lg font-bold mb-1 leading-tight">{gameState.macro.name}</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">{gameState.macro.desc}</p>
              {gameState.macro.customText && (
                <div className="mt-3 pt-3 border-t border-zinc-800/50">
                  <p className="text-red-300 text-xs italic whitespace-pre-wrap leading-relaxed opacity-90">+ {gameState.macro.customText}</p>
                </div>
              )}
            </div>
            <div className="bg-zinc-900/80 border-l-4 border-orange-700 p-4 rounded-r-xl shadow-lg hover:bg-zinc-900 transition-colors flex flex-col">
              <h2 className="text-orange-500/80 font-bold uppercase text-[10px] tracking-[0.2em] mb-1">Внутрішня криза</h2>
              <h3 className="text-zinc-100 text-lg font-bold mb-1 leading-tight">{gameState.micro.category}</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">{gameState.micro.desc}</p>
              {gameState.micro.customText && (
                <div className="mt-3 pt-3 border-t border-zinc-800/50">
                  <p className="text-orange-300 text-xs italic whitespace-pre-wrap leading-relaxed opacity-90">+ {gameState.micro.customText}</p>
                </div>
              )}
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
          <div className="mb-4 bg-zinc-950/50 border border-green-900/40 rounded-xl shadow-[0_0_20px_rgba(20,83,45,0.1)] relative overflow-hidden flex flex-col items-start p-4 gap-4">
            <div className="absolute top-0 right-0 w-48 h-full bg-green-900/10 rounded-bl-full blur-3xl"></div>
            <h2 className="text-green-500 font-bold uppercase tracking-widest text-xs flex items-center gap-2 relative z-10">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              Твоя Особова Справа
            </h2>
            <div className="flex flex-wrap gap-2.5 relative z-10">
              {myCard.traits.map((t, idx) => (
                 <div key={idx} className="bg-zinc-900/80 px-3 py-2 rounded-md border border-zinc-800/80 text-xs flex gap-2 items-start hover:border-green-900/50 transition-colors max-w-sm">
                   <span className="text-zinc-500 font-medium shrink-0 mt-0.5" title={t.label}>{t.icon}</span>
                   <span className="text-zinc-200 break-words leading-relaxed whitespace-pre-wrap">{t.value}</span>
                 </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 items-start">
          {gameState.players.map((p, pIdx) => (
            <div key={p.id} className={`flex flex-col bg-zinc-900/90 rounded-xl border transition-all duration-300 ${p.isNominated ? 'border-red-900/60 bg-red-950/20 shadow-[0_0_20px_rgba(153,27,27,0.15)] scale-[1.01]' : 'border-zinc-800 hover:border-zinc-700'}`}>
              <div className="p-2.5 flex justify-between items-center border-b border-zinc-800/50 bg-zinc-950/30 rounded-t-xl">
                <h3 className="text-sm font-bold text-zinc-100 truncate pr-2">{p.name} {p.id === me.id ? <span className="text-zinc-500 text-[10px] ml-1">(Ти)</span> : ''}</h3>
                {isHost && (
                  <button onClick={() => toggleNomination(pIdx)} className={`text-sm transition-transform hover:scale-125 ${p.isNominated ? 'opacity-100 drop-shadow-md' : 'opacity-30 grayscale'}`}>🎯</button>
                )}
              </div>

              <div className="p-2 flex-1 flex flex-col gap-1.5">
                {p.traits.map((t, tIdx) => (
                  <div key={tIdx} className={`w-full flex items-start gap-2 px-2 py-2 rounded-md border text-[13px] transition-all duration-300
                      ${t.visible 
                        ? 'bg-zinc-800/80 border-zinc-600 text-zinc-100 shadow-inner' 
                        : 'bg-zinc-950/80 border-transparent text-zinc-600'}`}>
                    
                    <span className="shrink-0 mt-0.5">{t.icon}</span>
                    
                    <div className="flex-1 min-w-0 flex items-center">
                      {isHost ? (
                        <HostTraitEditor 
                          pId={p.id} 
                          tIdx={tIdx} 
                          trait={t} 
                          onUpdate={handleTraitChange} 
                          onReroll={handleTraitReroll} 
                          onReveal={revealTraitAsHost} 
                        />
                      ) : t.visible ? (
                        <span className="animate-[fadeIn_0.5s_ease-out] block break-words whitespace-pre-wrap leading-tight text-zinc-200">{t.value}</span>
                      ) : (
                        <span className="text-[10px] tracking-widest opacity-40 select-none uppercase font-bold block pt-0.5 text-zinc-500">Приховано</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-2 bg-zinc-950 border-t border-zinc-800/80 flex justify-between items-center rounded-b-xl">
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
                  <button onClick={() => setKickTarget(p)} title="Вигнати з бункера" className="text-zinc-600 hover:text-red-500 p-1.5 rounded-md transition-colors hover:bg-red-950/30 text-sm">
                    ☠️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {kickTarget && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-zinc-950 border border-red-900/50 p-6 rounded-2xl shadow-[0_0_50px_rgba(153,27,27,0.2)] max-w-sm w-full text-center">
            <div className="text-5xl mb-4 animate-bounce">☠️</div>
            <h3 className="text-lg font-bold text-zinc-100 mb-2">Вигнати <span className="text-red-500">{kickTarget.name}</span>?</h3>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">Шлюз буде відкрито назавжди. Це також скине всі поточні голоси.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setKickTarget(null)} 
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-lg uppercase tracking-wider transition-colors"
              >
                Скасувати
              </button>
              <button 
                onClick={confirmKick} 
                className="flex-1 py-3 bg-red-900 hover:bg-red-800 text-white font-bold rounded-lg uppercase tracking-wider transition-colors shadow-[0_0_15px_rgba(153,27,27,0.4)]"
              >
                Вигнати
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}