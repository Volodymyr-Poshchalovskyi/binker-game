import { useContext, useState, useEffect, useRef } from 'react';
import { SocketContext } from '../SocketContext';
import Lobby from './Lobby';
import { TRAITS_DB, getRandom } from '../db';

// Максимально компактний редактор для Хоста з авто-розширенням висоти
const HostTraitEditor = ({ pId, tIdx, trait, onUpdate, onReroll, onReveal }) => {
  const [val, setVal] = useState(trait?.value || '');
  const textareaRef = useRef(null);

  // Функція для автоматичного підлаштування висоти textarea
  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Скидаємо висоту
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; // Встановлюємо по контенту
    }
  };

  useEffect(() => { 
    setVal(trait?.value || ''); 
    // Викликаємо adjustHeight після оновлення стейту (з невеликою затримкою для рендеру)
    setTimeout(adjustHeight, 0);
  }, [trait?.value]);

  return (
    <div className="flex items-start gap-1 w-full animate-[fadeIn_0.3s_ease-out]">
      {!trait.visible && (
        <button 
          onClick={() => onReveal(pId, tIdx)}
          className="shrink-0 text-[9px] bg-red-900/80 hover:bg-red-600 px-1.5 py-1 rounded text-white font-bold tracking-widest transition-all active:scale-95 mt-0.5"
          title="Відкрити всім"
        >
          👁️
        </button>
      )}
      <textarea
        ref={textareaRef}
        className="flex-1 bg-zinc-950/80 border border-zinc-700/50 focus:border-red-900/80 rounded p-1 text-zinc-200 outline-none text-[11px] resize-none overflow-hidden transition-colors leading-tight min-h-[26px]"
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          adjustHeight();
        }}
        onBlur={() => { if(val !== trait.value) onUpdate(pId, tIdx, val); }} 
        title="Натисни, щоб змінити текст вручну"
      />
      <button 
        onClick={() => onReroll(pId, tIdx, trait.label)} 
        className="shrink-0 p-1 bg-zinc-800/80 hover:bg-zinc-700 rounded text-[12px] transition-all hover:scale-110 active:scale-95 mt-0.5"
        title="Випадкове значення"
      >
        🎲
      </button>
    </div>
  );
};

export default function Home() {
  const { gameState, isHost, me, roomCode, socket, updateGameState } = useContext(SocketContext);
  const [kickTarget, setKickTarget] = useState(null); 
  const [showSynopsis, setShowSynopsis] = useState(true); // Стан для згортання синопсису

  if (!gameState) return <Lobby />;

  const revealTraitAsHost = (pId, tIdx) => {
    if (!isHost) return;
    const newData = JSON.parse(JSON.stringify(gameState));
    const player = newData.players.find(p => p.id === pId);
    if (player && player.traits[tIdx]) {
      player.traits[tIdx].visible = true;
      updateGameState(newData);
    }
  };

  const handleTraitChange = (pId, tIdx, newVal) => {
    if (!isHost) return;
    const newData = JSON.parse(JSON.stringify(gameState));
    const player = newData.players.find(p => p.id === pId);
    if (player && player.traits[tIdx]) {
      player.traits[tIdx].value = newVal;
      updateGameState(newData);
    }
  };

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
    } else if (label.includes('Факт') || label === 'Прихований Факт' || label === 'Приховано') {
      newValue = getRandom(TRAITS_DB.facts);
    } else if (label.startsWith('Дія')) {
      newValue = getRandom(TRAITS_DB.actions);
    } else {
      newValue = "Оновлене значення";
    }

    handleTraitChange(pId, tIdx, newValue);
  };

  const toggleNomination = (pId) => {
    if (!isHost) return;
    const newData = JSON.parse(JSON.stringify(gameState));
    const player = newData.players.find(p => p.id === pId);
    if (player) {
      player.isNominated = !player.isNominated;
      updateGameState(newData);
    }
  };

  const handleVote = (pId, delta) => {
    if (!isHost) return;
    const newData = JSON.parse(JSON.stringify(gameState));
    const player = newData.players.find(p => p.id === pId);
    if (player) {
      player.votes = Math.max(0, (player.votes || 0) + delta);
      updateGameState(newData);
    }
  };

  const confirmKick = () => {
    if (!kickTarget) return;
    const pId = kickTarget.id;
    
    const newData = JSON.parse(JSON.stringify(gameState));
    newData.players = newData.players.filter(p => p.id !== pId);
    newData.players = newData.players.map(p => ({
      ...p,
      votes: 0,
      isNominated: false
    }));

    updateGameState(newData);
    socket.emit('kick_player', { roomCode, targetPlayerId: pId });
    setKickTarget(null); 
  };

  const myCard = gameState.players.find(p => p.id === me.id);

  return (
    <>
      <div className="p-3 md:p-4 w-full mx-auto space-y-4 max-w-[2000px] animate-[fadeIn_0.5s_ease-out]">
        
        {/* КНОПКА ЗГОРТАННЯ/РОЗГОРТАННЯ СИНОПСИСУ */}
        <div className="flex justify-between items-center bg-zinc-900/50 p-2 rounded-lg border border-zinc-800/50">
          <h1 className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] ml-2">Панель Гри</h1>
          <button 
            onClick={() => setShowSynopsis(!showSynopsis)}
            className="text-[10px] font-bold uppercase tracking-widest bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-1.5 px-4 rounded transition-colors active:scale-95"
          >
            {showSynopsis ? 'Сховати умови бункера ▲' : 'Показати умови бункера ▼'}
          </button>
        </div>

        {/* ВЕРХНІЙ БЛОК: Загрози та Бункер (Згортається) */}
        {showSynopsis && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 backdrop-blur-sm border-l-4 border-l-red-800 border-zinc-800/50 p-4 rounded-r-xl shadow-lg flex flex-col justify-center">
              <h2 className="text-red-500 font-black uppercase text-[10px] tracking-[0.2em] mb-1">Зовнішній Світ</h2>
              <h3 className="text-zinc-100 text-base font-bold mb-1 leading-tight">{gameState.macro.name}</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">{gameState.macro.desc}</p>
              {gameState.macro.customText && <p className="text-red-300/80 text-[10px] italic mt-2 pt-2 border-t border-zinc-800/80">+ {gameState.macro.customText}</p>}
            </div>
            
            <div className="bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 backdrop-blur-sm border-l-4 border-l-orange-600 border-zinc-800/50 p-4 rounded-r-xl shadow-lg flex flex-col justify-center">
              <h2 className="text-orange-500 font-black uppercase text-[10px] tracking-[0.2em] mb-1">Внутрішня Криза</h2>
              <h3 className="text-zinc-100 text-base font-bold mb-1 leading-tight">{gameState.micro.category}</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">{gameState.micro.desc}</p>
              {gameState.micro.customText && <p className="text-orange-300/80 text-[10px] italic mt-2 pt-2 border-t border-zinc-800/80">+ {gameState.micro.customText}</p>}
            </div>

            {gameState.bunkerData && (
              <div className="bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 backdrop-blur-sm border border-zinc-700/50 p-4 rounded-xl shadow-lg flex flex-col justify-between">
                <div className="flex justify-between items-center mb-2 border-b border-zinc-800 pb-1">
                  <h2 className="text-blue-400 font-black uppercase tracking-[0.2em] text-[10px]">Умови Бункера</h2>
                  <span className="bg-red-900/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Місць: {gameState.bunkerData.capacity}
                  </span>
                </div>
                <ul className="space-y-1.5 flex-1 text-[11px]">
                  <li className="flex items-start gap-2"><span className="text-zinc-500">🕒</span><p className="text-zinc-200"><strong className="text-zinc-400">Час:</strong> {gameState.bunkerData.duration}</p></li>
                  <li className="flex items-start gap-2"><span className="text-zinc-500">🎯</span><p className="text-zinc-200"><strong className="text-zinc-400">Місія:</strong> {gameState.bunkerData.mission}</p></li>
                  <li className="flex items-start gap-2 bg-red-950/30 px-1.5 py-1 rounded border border-red-900/20"><span className="text-red-500">⚠️</span><p className="text-red-200"><strong className="text-red-400">Дефіцит:</strong> {gameState.bunkerData.deficit}</p></li>
                  <li className="flex items-start gap-2 bg-green-950/30 px-1.5 py-1 rounded border border-green-900/20"><span className="text-green-500">🏗️</span><p className="text-green-200"><strong className="text-green-400">Бонус:</strong> {gameState.bunkerData.facility}</p></li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ПАНЕЛЬ ВЛАСНОЇ СПРАВИ (Із зеленим/червоним виділенням) */}
        {!isHost && myCard && (
          <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl shadow-lg p-4 flex flex-col gap-3">
            <h2 className="text-zinc-300 font-black uppercase tracking-[0.2em] text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
              Ваша Особова Справа
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {myCard.traits.map((t, idx) => (
                 <div key={idx} className={`px-2.5 py-1.5 rounded-lg border flex flex-col gap-1 transition-all group shadow-sm 
                    ${t.visible ? 'border-green-500/60 bg-green-950/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'border-red-900/60 bg-red-950/20'}`}>
                    <div className="flex justify-between items-center w-full border-b border-zinc-800/40 pb-1">
                        <span className="text-zinc-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                          <span className="text-sm">{t.icon}</span> {t.label}
                        </span>
                        <span className={`text-[8px] uppercase font-black tracking-widest px-1.5 py-0.5 rounded 
                          ${t.visible ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                            {t.visible ? 'Відкрито' : 'Приховано'}
                        </span>
                    </div>
                   <span className="text-zinc-100 text-xs font-medium tracking-wide whitespace-pre-wrap">{t.value}</span>
                 </div>
              ))}
            </div>
          </div>
        )}

        {/* СПИСОК ГРАВЦІВ (Компактний) */}
        <div className="border-t border-zinc-800/50 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 items-start">
            {gameState.players.map((p) => (
              <div key={p.id} className={`flex flex-col bg-zinc-900/80 backdrop-blur-md rounded-xl border transition-all duration-300 
                ${p.isNominated ? 'border-red-900 shadow-[0_0_15px_rgba(153,27,27,0.3)] -translate-y-1' : 'border-zinc-800 hover:border-zinc-600'}`}>
                
                <div className={`p-2 flex justify-between items-center border-b rounded-t-xl transition-colors ${p.isNominated ? 'bg-red-950/40 border-red-900/50' : 'bg-zinc-950/50 border-zinc-800/50'}`}>
                  <h3 className="text-sm font-black text-white truncate flex items-center gap-2">
                    {p.name} 
                    {p.id === me.id && <span className="bg-zinc-800 text-zinc-400 text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-widest">Ти</span>}
                  </h3>
                  {isHost && (
                    <button onClick={() => toggleNomination(p.id)} className={`text-lg transition-all active:scale-90 ${p.isNominated ? 'opacity-100 drop-shadow-[0_0_8px_red]' : 'opacity-30 hover:opacity-100 grayscale hover:grayscale-0'}`}>
                      🎯
                    </button>
                  )}
                </div>

                <div className="p-1.5 flex-1 flex flex-col gap-1">
                  {p.traits.map((t, tIdx) => (
                    <div key={t.visible ? `v-${tIdx}` : `h-${tIdx}`} className={`w-full flex items-start gap-2 px-2 py-1.5 rounded-lg border text-[11px] transition-all duration-500
                        ${t.visible 
                          ? 'bg-green-950/20 border-green-700/50 text-green-50 shadow-[0_0_10px_rgba(20,83,45,0.4)] animate-[pulse_1s_ease-out]' 
                          : 'bg-zinc-950/60 border-transparent text-zinc-500'}`}>
                      
                      <span className="shrink-0 text-sm drop-shadow-sm mt-0.5">{t.icon}</span>
                      
                      <div className="flex-1 min-w-0 flex items-center">
                        {isHost ? (
                          <HostTraitEditor pId={p.id} tIdx={tIdx} trait={t} onUpdate={handleTraitChange} onReroll={handleTraitReroll} onReveal={revealTraitAsHost} />
                        ) : t.visible ? (
                          <span className="block break-words whitespace-pre-wrap leading-tight font-medium w-full">{t.value}</span>
                        ) : (
                          <div className="flex flex-col items-start gap-0.5 w-full">
                            <div className="h-1.5 w-8 bg-zinc-800 rounded-full mt-0.5"></div>
                            <span className="text-[8px] tracking-[0.2em] opacity-40 select-none uppercase font-bold text-zinc-600">Засекречено</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`p-2 border-t flex justify-between items-center rounded-b-xl transition-colors ${p.isNominated ? 'bg-red-950/20 border-red-900/30' : 'bg-zinc-950/80 border-zinc-800/80'}`}>
                  {isHost ? (
                    <div className="flex items-center bg-zinc-900 rounded border border-zinc-700 overflow-hidden shadow-inner h-7">
                      <button onClick={() => handleVote(p.id, -1)} className="text-zinc-400 hover:text-white hover:bg-red-900/80 px-3 transition-colors text-sm font-black active:scale-95 h-full">-</button>
                      <span className="font-mono text-white font-black min-w-[24px] text-center text-xs bg-zinc-950 leading-7">{p.votes || 0}</span>
                      <button onClick={() => handleVote(p.id, 1)} className="text-zinc-400 hover:text-white hover:bg-green-900/80 px-3 transition-colors text-sm font-black active:scale-95 h-full">+</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.2em]">Голоси:</span>
                      <span className="font-mono font-black text-white text-sm">{p.votes || 0}</span>
                    </div>
                  )}

                  {isHost && (
                    <button onClick={() => setKickTarget(p)} title="Вигнати" className="text-zinc-600 hover:text-red-500 hover:bg-red-950/50 p-1.5 rounded-lg transition-all active:scale-90 border border-transparent hover:border-red-900/50 text-xs">
                      ☠️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* МОДАЛКА ВИГНАННЯ ГРАВЦЯ */}
      {kickTarget && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-red-900/80 p-6 rounded-2xl shadow-[0_0_50px_rgba(153,27,27,0.4)] max-w-sm w-full text-center">
            <div className="text-5xl mb-4 animate-bounce drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]">☠️</div>
            <h3 className="text-xl font-black text-zinc-100 mb-2 uppercase tracking-wider">
              Вигнати <span className="text-red-500">{kickTarget.name}</span>?
            </h3>
            <p className="text-zinc-400 text-xs mb-6 leading-relaxed font-medium">Шлюз відкриється назавжди. Голоси групи будуть скинуті.</p>
            <div className="flex gap-3">
              <button onClick={() => setKickTarget(null)} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-lg uppercase text-xs tracking-wider transition-all active:scale-95">Скасувати</button>
              <button onClick={confirmKick} className="flex-1 py-3 bg-red-900 hover:bg-red-700 text-white font-black rounded-lg uppercase text-xs tracking-wider transition-all active:scale-95 shadow-[0_0_15px_rgba(153,27,27,0.5)]">Підтвердити</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}