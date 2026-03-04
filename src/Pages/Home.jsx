import { useContext, useState, useEffect, useRef } from 'react';
import { SocketContext } from '../SocketContext';
import Lobby from './Lobby';
import { TRAITS_DB, getRandom } from '../db';

// Анімація "Декодування" тексту
const DecodedText = ({ text }) => {
  const [display, setDisplay] = useState('');
  useEffect(() => {
    let iter = 0;
    const target = text || '';
    const interval = setInterval(() => {
      setDisplay(target.split('').map((c, i) => {
        if (i < iter) return target[i];
        return String.fromCharCode(33 + Math.floor(Math.random() * 94));
      }).join(''));
      iter += target.length / 15 + 1;
      if (iter >= target.length) {
        clearInterval(interval);
        setDisplay(target);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [text]);
  return <span>{display}</span>;
};

// Редактор Хоста з авто-розширенням
const HostTraitEditor = ({ pId, tIdx, trait, onUpdate, onReroll, onReveal }) => {
  const [val, setVal] = useState(trait?.value || '');
  const textareaRef = useRef(null);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => { 
    setVal(trait?.value || ''); 
    setTimeout(adjustHeight, 0);
  }, [trait?.value]);

  return (
    <div className="flex items-start gap-1 w-full mt-1">
      {!trait.visible && (
        <button 
          onClick={() => onReveal(pId, tIdx)}
          className="shrink-0 text-[9px] bg-red-900/80 hover:bg-red-600 px-1.5 py-1 rounded text-white font-bold tracking-widest transition-all active:scale-95"
          title="Відкрити всім"
        >
          👁️
        </button>
      )}
      <textarea
        ref={textareaRef}
        className="flex-1 bg-zinc-950/80 border border-zinc-700/50 focus:border-red-900/80 rounded p-1 text-zinc-200 outline-none text-[11px] resize-none overflow-hidden transition-colors leading-tight min-h-[26px]"
        value={val}
        onChange={(e) => { setVal(e.target.value); adjustHeight(); }}
        onBlur={() => { if(val !== trait.value) onUpdate(pId, tIdx, val); }} 
        title="Натисни, щоб змінити текст вручну"
      />
      <button 
        onClick={() => onReroll(pId, tIdx, trait.label)} 
        className="shrink-0 p-1 bg-zinc-800/80 hover:bg-zinc-700 rounded text-[12px] transition-all hover:scale-110 active:scale-95"
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
  const [showSynopsis, setShowSynopsis] = useState(true); 
  const [showLog, setShowLog] = useState(false);

  if (!gameState) return <Lobby />;

  const addLog = (message, stateObj) => {
    const data = stateObj || gameState;
    if (!data.logs) data.logs = [];
    const time = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    data.logs.unshift(`[${time}] ${message}`);
    if (data.logs.length > 50) data.logs.pop(); 
  };

  const revealTraitAsHost = (pId, tIdx) => {
    if (!isHost) return;
    const newData = JSON.parse(JSON.stringify(gameState));
    const player = newData.players.find(p => p.id === pId);
    if (player && player.traits[tIdx]) {
      player.traits[tIdx].visible = true;
      addLog(`👁️ Відкрито [${player.traits[tIdx].label}] у ${player.name}`, newData);
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
    if (label === 'Стать та вік') newValue = `${Math.random() > 0.5 ? "Чоловік" : "Жінка"}, ${Math.floor(Math.random() * 45) + 18} р.`;
    else if (label === 'Професія') newValue = getRandom(TRAITS_DB.professions).name; 
    else if (label === 'Здоров\'я') { const h = getRandom(TRAITS_DB.health); newValue = `${h.val}% (${h.name})`; }
    else if (label === 'Хобі') newValue = getRandom(TRAITS_DB.hobbies);
    else if (label === 'Фобія') newValue = getRandom(TRAITS_DB.phobias);
    else if (label === 'Багаж') newValue = getRandom(TRAITS_DB.luggage);
    else if (label === 'Великий багаж') newValue = getRandom(TRAITS_DB.large_luggage);
    else if (label.includes('Факт') || label === 'Приховано') newValue = getRandom(TRAITS_DB.facts);
    else if (label.startsWith('Дія')) newValue = getRandom(TRAITS_DB.actions);
    else newValue = "Оновлене значення";

    const newData = JSON.parse(JSON.stringify(gameState));
    const player = newData.players.find(p => p.id === pId);
    if (player) {
      player.traits[tIdx].value = newValue;
      addLog(`🎲 Змінено [${label}] для ${player.name}`, newData);
      updateGameState(newData);
    }
  };

  const handleSwapTraits = (pId1, tIdx1, pId2, tIdx2) => {
    if (pId1 === pId2 && tIdx1 === tIdx2) return; 
    const newData = JSON.parse(JSON.stringify(gameState));
    const p1 = newData.players.find(p => p.id === pId1);
    const p2 = newData.players.find(p => p.id === pId2);
    
    if (p1 && p2 && p1.traits[tIdx1].label === p2.traits[tIdx2].label) {
        const tempVal = p1.traits[tIdx1].value;
        const tempVis = p1.traits[tIdx1].visible;
        
        p1.traits[tIdx1].value = p2.traits[tIdx2].value;
        p1.traits[tIdx1].visible = p2.traits[tIdx2].visible;
        
        p2.traits[tIdx2].value = tempVal;
        p2.traits[tIdx2].visible = tempVis;
        
        addLog(`🔄 Обмін [${p1.traits[tIdx1].label}] між ${p1.name} та ${p2.name}`, newData);
        updateGameState(newData);
    } else {
        alert("Не можна міняти різні типи характеристик!");
    }
  };

  const toggleNomination = (pId) => {
    if (!isHost) return;
    const newData = JSON.parse(JSON.stringify(gameState));
    const player = newData.players.find(p => p.id === pId);
    if (player) {
      player.isNominated = !player.isNominated;
      addLog(`🎯 Гравця ${player.name} ${player.isNominated ? 'НОМІНОВАНО' : 'знято з номінації'}`, newData);
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
    
    const target = newData.players.find(p => p.id === pId);
    if (target) {
        target.isDead = true; 
        target.votes = 0;
        target.isNominated = false;
        target.traits.forEach(t => t.visible = true);
    }
    
    newData.players.forEach(p => { p.votes = 0; p.isNominated = false; });
    
    addLog(`☠️ Гравця ${target.name} ВИГНАНО З БУНКЕРА. Голоси скинуто.`, newData);
    updateGameState(newData);
    setKickTarget(null); 
  };

  const myCard = gameState.players.find(p => p.id === me.id);

  return (
    <>
      <div className="p-3 md:p-4 w-full mx-auto space-y-4 max-w-[2000px] animate-[fadeIn_0.5s_ease-out]">
        
        <div className="flex justify-between items-center bg-zinc-900/50 p-2 rounded-lg border border-zinc-800/50">
          <h1 className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] ml-2">Панель Гри</h1>
          <button 
            onClick={() => setShowSynopsis(!showSynopsis)}
            className="text-[10px] font-bold uppercase tracking-widest bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-1.5 px-4 rounded transition-colors active:scale-95 shadow-md border border-zinc-700"
          >
            {showSynopsis ? 'Сховати умови бункера ▲' : 'Показати умови бункера ▼'}
          </button>
        </div>

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
                  <span className="bg-red-900/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-[0_0_10px_rgba(153,27,27,0.5)]">
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

        {/* ПАНЕЛЬ ВЛАСНОЇ СПРАВИ */}
        {!isHost && myCard && (
          <div className={`bg-gradient-to-r ${myCard.isDead ? 'from-zinc-950 to-zinc-900 border-red-900/50' : 'from-zinc-900 to-zinc-950 border-zinc-800'} rounded-xl shadow-lg p-4 flex flex-col gap-3 relative overflow-hidden transition-all duration-500`}>
            
            {myCard.isDead && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 overflow-hidden backdrop-blur-[1px]">
                <div className="text-red-700/80 border-4 border-red-700/80 rounded uppercase font-black text-5xl md:text-7xl tracking-widest px-6 py-2 rotate-[-15deg] shadow-[0_0_30px_rgba(185,28,28,0.5)] bg-zinc-950/60 mix-blend-screen">
                  ВИЄБАНИЙ
                </div>
              </div>
            )}

            <h2 className="text-zinc-300 font-black uppercase tracking-[0.2em] text-xs flex items-center gap-2 relative z-10">
              <span className={`w-1.5 h-1.5 rounded-full ${myCard.isDead ? 'bg-red-500' : 'bg-zinc-500'}`}></span>
              Ваша Особова Справа
            </h2>
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 relative z-10 ${myCard.isDead ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
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

        {/* СПИСОК ГРАВЦІВ */}
        <div className="border-t border-zinc-800/50 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 items-start relative">
            
            {[...gameState.players].sort((a,b) => (a.isDead === b.isDead) ? 0 : a.isDead ? 1 : -1).map((p) => {
              
              let cardStyles = "border-zinc-800 hover:border-zinc-600";
              if (p.isDead) cardStyles = "border-zinc-800/50 grayscale opacity-80 scale-95 pointer-events-auto bg-zinc-950";
              else if (p.isNominated) cardStyles = "border-red-900 shadow-[0_0_20px_rgba(153,27,27,0.4)] -translate-y-1 bg-red-950/10";

              return (
              <div key={p.id} className={`flex flex-col bg-zinc-900/80 backdrop-blur-md rounded-xl border transition-all duration-300 relative overflow-hidden ${cardStyles}`}>
                
                {p.isDead && (
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden backdrop-blur-[1px]">
                     <div className="text-red-700/80 border-4 border-red-700/80 rounded uppercase font-black text-4xl tracking-widest px-4 py-2 rotate-[-20deg] scale-110 shadow-[0_0_20px_rgba(185,28,28,0.5)] bg-zinc-950/40 mix-blend-screen">
                       ВИЄБАНИЙ
                     </div>
                   </div>
                )}

                <div className={`p-2 flex justify-between items-center border-b rounded-t-xl transition-colors ${p.isNominated ? 'bg-red-950/40 border-red-900/50' : 'bg-zinc-950/50 border-zinc-800/50'} relative z-20`}>
                  <h3 className={`text-sm font-black truncate flex items-center gap-2 ${p.isDead ? 'text-zinc-500 line-through' : 'text-white'}`}>
                    {p.name} 
                    {p.id === me.id && <span className="bg-zinc-800 text-zinc-400 text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-widest">Ти</span>}
                  </h3>
                  {isHost && !p.isDead && (
                    <button onClick={() => toggleNomination(p.id)} className={`text-lg transition-all active:scale-90 ${p.isNominated ? 'opacity-100 drop-shadow-[0_0_8px_red]' : 'opacity-30 hover:opacity-100 grayscale hover:grayscale-0'}`}>
                      🎯
                    </button>
                  )}
                </div>

                <div className="p-1.5 flex-1 flex flex-col gap-1 relative z-20">
                  {p.traits.map((t, tIdx) => (
                    <div 
                      key={t.visible ? `v-${tIdx}` : `h-${tIdx}`} 
                      draggable={isHost}
                      onDragStart={(e) => {
                         if(!isHost) return;
                         e.dataTransfer.setData('text/plain', JSON.stringify({ pId: p.id, tIdx }));
                         e.currentTarget.style.opacity = '0.5';
                         e.currentTarget.style.borderColor = 'orange';
                      }}
                      onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = ''; }}
                      onDragOver={(e) => { if(isHost) e.preventDefault(); }}
                      onDrop={(e) => {
                         if(!isHost) return;
                         e.preventDefault();
                         const source = JSON.parse(e.dataTransfer.getData('text/plain'));
                         handleSwapTraits(source.pId, source.tIdx, p.id, tIdx);
                      }}
                      className={`relative w-full flex flex-col gap-1 px-2 py-1.5 rounded-lg border text-[11px] transition-all duration-500
                        ${isHost ? 'cursor-grab active:cursor-grabbing hover:border-zinc-500' : ''}
                        ${t.visible 
                          ? 'bg-green-950/20 border-green-700/50 text-green-50 shadow-[0_0_10px_rgba(20,83,45,0.4)] animate-[pulse_1s_ease-out]' 
                          : 'bg-zinc-950/60 border-transparent text-zinc-500'}`}
                    >
                      <div className="flex justify-between items-center w-full">
                         <div className="flex items-center gap-1.5">
                            <span className="shrink-0 text-xs drop-shadow-sm">{t.icon}</span>
                            <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">{t.label}</span>
                         </div>
                      </div>
                      
                      <div className="flex-1 w-full">
                        {isHost ? (
                          <HostTraitEditor pId={p.id} tIdx={tIdx} trait={t} onUpdate={handleTraitChange} onReroll={handleTraitReroll} onReveal={revealTraitAsHost} />
                        ) : t.visible ? (
                          <span className="block break-words whitespace-pre-wrap leading-tight font-medium w-full">
                             <DecodedText text={t.value} />
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 w-full pt-1 pb-1">
                            <div className="h-1.5 flex-1 bg-zinc-800 rounded-full"></div>
                            <span className="text-[8px] tracking-[0.2em] opacity-40 select-none uppercase font-bold text-zinc-600">Засекречено</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`p-2 border-t flex justify-between items-center rounded-b-xl transition-colors ${p.isNominated ? 'bg-red-950/20 border-red-900/30' : 'bg-zinc-950/80 border-zinc-800/80'} relative z-20`}>
                  {isHost ? (
                    <div className="flex items-center bg-zinc-900 rounded border border-zinc-700 overflow-hidden shadow-inner h-7">
                      <button disabled={p.isDead} onClick={() => handleVote(p.id, -1)} className="text-zinc-400 hover:text-white hover:bg-red-900/80 px-3 transition-colors text-sm font-black active:scale-95 h-full disabled:opacity-30">-</button>
                      <span className={`font-mono font-black min-w-[24px] text-center text-xs bg-zinc-950 leading-7 ${p.isDead ? 'text-zinc-600' : 'text-white'}`}>{p.votes || 0}</span>
                      <button disabled={p.isDead} onClick={() => handleVote(p.id, 1)} className="text-zinc-400 hover:text-white hover:bg-green-900/80 px-3 transition-colors text-sm font-black active:scale-95 h-full disabled:opacity-30">+</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.2em]">Голоси:</span>
                      <span className="font-mono font-black text-white text-sm">{p.votes || 0}</span>
                    </div>
                  )}

                  {isHost && !p.isDead && (
                    <button onClick={() => setKickTarget(p)} title="Вигнати" className="text-zinc-600 hover:text-red-500 hover:bg-red-950/50 p-1.5 rounded-lg transition-all active:scale-90 border border-transparent hover:border-red-900/50 text-xs">
                      ☠️
                    </button>
                  )}
                </div>
              </div>
            )})}
          </div>
        </div>
      </div>

      {isHost && (
        <div className="fixed bottom-4 right-4 z-[90] flex flex-col items-end">
          {showLog && (
             <div className="bg-zinc-950/95 border border-zinc-700 w-80 max-h-64 overflow-y-auto rounded-xl p-3 mb-2 shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-md text-[10px] font-mono flex flex-col gap-1.5 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex justify-between border-b border-zinc-800 pb-1 mb-1 items-center sticky top-0 bg-zinc-950/90 z-10">
                   <h3 className="text-zinc-400 uppercase tracking-widest font-bold">Термінал: Журнал подій</h3>
                </div>
                {(gameState.logs || []).length === 0 && <span className="text-zinc-600 italic">Поки тихо...</span>}
                {(gameState.logs || []).map((l, i) => {
                   let colorClass = "text-zinc-300";
                   if (l.includes('☠️')) colorClass = "text-red-400 font-bold bg-red-950/30 px-1 py-0.5 rounded";
                   else if (l.includes('🔄')) colorClass = "text-blue-300";
                   else if (l.includes('👁️')) colorClass = "text-green-300";
                   else if (l.includes('🎯')) colorClass = "text-orange-300";
                   return <div key={i} className={`${colorClass} leading-tight`}>{l}</div>
                })}
             </div>
          )}
          <button 
             onClick={() => setShowLog(!showLog)} 
             className={`rounded-full px-4 py-3 shadow-[0_0_15px_rgba(0,0,0,0.5)] flex items-center gap-2 text-xs uppercase font-bold tracking-widest transition-colors active:scale-95 border
             ${showLog ? 'bg-red-900 hover:bg-red-800 text-white border-red-700' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-600'}`}
          >
             📝 {showLog ? 'Сховати консоль' : 'Відкрити консоль'}
          </button>
        </div>
      )}

      {kickTarget && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-red-900/80 p-6 rounded-2xl shadow-[0_0_50px_rgba(153,27,27,0.4)] max-w-sm w-full text-center">
            <div className="text-5xl mb-4 animate-bounce drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]">☠️</div>
            <h3 className="text-xl font-black text-zinc-100 mb-2 uppercase tracking-wider">
              Вигнати <span className="text-red-500">{kickTarget.name}</span>?
            </h3>
            <p className="text-zinc-400 text-xs mb-6 leading-relaxed font-medium">Гравець залишиться в грі як спостерігач. Його картки стануть доступні для мародерства. Усі голоси групи будуть скинуті.</p>
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