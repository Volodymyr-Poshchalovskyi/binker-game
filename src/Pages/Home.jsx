import { useContext, useState, useEffect, useRef } from 'react';
import { SocketContext } from '../SocketContext';
import Lobby from './Lobby';
import { TRAITS_DB, getRandom } from '../db';

// --- АУДІО ДВИЖОК (Генерація ретро-звуків без MP3) ---
// --- АУДІО ДВИЖОК (Генерація ретро-звуків без MP3) ---
const playSfx = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    if (type === 'type') {
      // Звук друкарської машинки (дуже короткий, 0.05 сек)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(600 + Math.random() * 400, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === 'slam') {
      // Швидкий звук вигнання ("піу" вниз, всього 0.25 сек)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      // Різко спадає вниз
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.25);
      
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      // Різко затухає
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) { console.log("Audio not supported"); }
};

// Анімація "Декодування" тексту + Звук
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
      
      // Відтворюємо звук під час друку
      if (iter < target.length && Math.random() > 0.5) playSfx('type');
      
      iter += target.length / 20 + 1;
      if (iter >= target.length) {
        clearInterval(interval);
        setDisplay(target);
      }
    }, 40);
    return () => clearInterval(interval);
  }, [text]);
  return <span>{display}</span>;
};

// Редактор Хоста
const HostTraitEditor = ({ pId, tIdx, trait, onUpdate, onReroll, onReveal }) => {
  const [val, setVal] = useState(trait?.value || '');
  const textareaRef = useRef(null);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => { setVal(trait?.value || ''); setTimeout(adjustHeight, 0); }, [trait?.value]);

  return (
    <div className="flex items-start gap-1 w-full mt-1 relative z-20">
      {!trait.visible && (
        <button onClick={() => { playSfx('type'); onReveal(pId, tIdx); }} className="shrink-0 text-[9px] bg-red-900/80 hover:bg-red-600 px-1.5 py-1 rounded text-white font-bold tracking-widest active:scale-95">👁️</button>
      )}
      <textarea
        ref={textareaRef}
        className="flex-1 bg-zinc-950/80 border border-zinc-700/50 focus:border-red-900/80 rounded p-1 text-zinc-200 outline-none text-[11px] resize-none overflow-hidden min-h-[26px]"
        value={val}
        onChange={(e) => { setVal(e.target.value); adjustHeight(); }}
        onBlur={() => { if(val !== trait.value) onUpdate(pId, tIdx, val); }} 
      />
      <button onClick={() => onReroll(pId, tIdx, trait.label)} className="shrink-0 p-1 bg-zinc-800/80 hover:bg-zinc-700 rounded text-[12px] active:scale-95">🎲</button>
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
    } else { alert("Не можна міняти різні типи характеристик!"); }
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
    playSfx('slam'); // Епічний звук вигнання
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
    addLog(`☠️ Гравця ${target.name} ВИГНАНО З БУНКЕРА.`, newData);
    updateGameState(newData);
    setKickTarget(null); 
  };

  const myCard = gameState.players.find(p => p.id === me.id);

  return (
    <>
      {/* ГЛОБАЛЬНИЙ CRT-ЕФЕКТ (Смуги монітора) */}
      <div className="pointer-events-none fixed inset-0 z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-10 pointer-events-none mix-blend-overlay"></div>

      <div className="p-3 md:p-4 w-full mx-auto space-y-4 max-w-[2000px] animate-[fadeIn_0.5s_ease-out] relative z-10">
        
        <div className="flex justify-between items-center bg-zinc-900/80 p-2 rounded-lg border border-zinc-700/50 shadow-lg">
          <h1 className="text-zinc-500 font-bold uppercase tracking-[0.3em] text-[10px] ml-2 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            BUNKER_OS v2.4
          </h1>
          <button onClick={() => setShowSynopsis(!showSynopsis)} className="text-[10px] font-bold uppercase tracking-widest bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-1.5 px-4 rounded active:scale-95 border border-zinc-600">
            {showSynopsis ? 'Сховати умови ▲' : 'Показати умови ▼'}
          </button>
        </div>

        {showSynopsis && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-zinc-900/80 border-l-4 border-l-red-800 border-zinc-700/50 p-4 rounded-r-xl shadow-lg relative overflow-hidden">
              <div className="absolute top-2 right-2 text-zinc-800/30 text-5xl font-black">01</div>
              <h2 className="text-red-500 font-black uppercase text-[10px] tracking-[0.2em] mb-1">Зовнішній Світ</h2>
              <h3 className="text-zinc-100 text-base font-bold mb-1 relative z-10">{gameState.macro.name}</h3>
              <p className="text-zinc-400 text-xs leading-relaxed relative z-10">{gameState.macro.desc}</p>
            </div>
            
            <div className="bg-zinc-900/80 border-l-4 border-l-orange-600 border-zinc-700/50 p-4 rounded-r-xl shadow-lg relative overflow-hidden">
              <div className="absolute top-2 right-2 text-zinc-800/30 text-5xl font-black">02</div>
              <h2 className="text-orange-500 font-black uppercase text-[10px] tracking-[0.2em] mb-1">Внутрішня Криза</h2>
              <h3 className="text-zinc-100 text-base font-bold mb-1 relative z-10">{gameState.micro.category}</h3>
              <p className="text-zinc-400 text-xs leading-relaxed relative z-10">{gameState.micro.desc}</p>
            </div>

            {gameState.bunkerData && (
              <div className="bg-zinc-900/80 border border-zinc-700/50 p-4 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-2 border-b border-zinc-800 pb-1">
                  <h2 className="text-blue-400 font-black uppercase tracking-[0.2em] text-[10px]">Параметри</h2>
                  <span className="bg-red-900/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider font-mono">
                    МІСЦЬ: {gameState.bunkerData.capacity}
                  </span>
                </div>
                <ul className="space-y-1.5 text-[11px] font-mono text-zinc-300">
                  <li className="flex items-start gap-2"><span className="text-zinc-500">TME&gt;</span>{gameState.bunkerData.duration}</li>
                  <li className="flex items-start gap-2"><span className="text-zinc-500">MIS&gt;</span>{gameState.bunkerData.mission}</li>
                  <li className="flex items-start gap-2 text-red-300"><span className="text-red-500">ERR&gt;</span>{gameState.bunkerData.deficit}</li>
                  <li className="flex items-start gap-2 text-green-300"><span className="text-green-500">SYS&gt;</span>{gameState.bunkerData.facility}</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ПАНЕЛЬ ВЛАСНОЇ СПРАВИ */}
        {!isHost && myCard && (
          <div className={`bg-gradient-to-r ${myCard.isDead ? 'from-zinc-950 to-zinc-900 border-red-900/50' : 'from-zinc-900 to-zinc-950 border-zinc-700/50'} rounded-xl shadow-lg p-4 relative overflow-hidden transition-all`}>
            {myCard.isDead && (
              <div className="absolute inset-0 flex items-center justify-center z-20 overflow-hidden">
                <div className="text-red-700/80 border-4 border-red-700/80 rounded uppercase font-black text-5xl md:text-7xl tracking-widest px-6 py-2 rotate-[-15deg] shadow-[0_0_30px_rgba(185,28,28,0.5)] bg-zinc-950/60">ВИГНАНО</div>
              </div>
            )}
            <div className="flex items-center gap-4 mb-3">
              <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${myCard.name}`} className={`w-12 h-12 rounded bg-zinc-800 p-1 border border-zinc-600 ${myCard.isDead ? 'grayscale opacity-50' : ''}`} alt="avatar" />
              <div>
                <h2 className="text-zinc-300 font-black uppercase tracking-[0.2em] text-xs flex items-center gap-2">ОСОБОВА СПРАВА: {myCard.name}</h2>
                <div className="text-zinc-600 font-mono text-[10px] tracking-widest">ID: {myCard.id.split('-')[0]}</div>
              </div>
            </div>
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 relative z-10 ${myCard.isDead ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
              {myCard.traits.map((t, idx) => (
                 <div key={idx} className={`px-2.5 py-1.5 rounded bg-zinc-950/50 border flex flex-col gap-1 transition-all ${t.visible ? 'border-green-500/50' : 'border-zinc-800'}`}>
                    <div className="flex justify-between items-center w-full border-b border-zinc-800/40 pb-1">
                        <span className="text-zinc-400 font-bold uppercase tracking-wider text-[10px]">{t.icon} {t.label}</span>
                        <span className={`text-[8px] uppercase font-black tracking-widest px-1.5 py-0.5 rounded ${t.visible ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>{t.visible ? 'Відкрито' : 'Приховано'}</span>
                    </div>
                   <span className="text-zinc-100 text-xs font-mono tracking-wide whitespace-pre-wrap">{t.value}</span>
                 </div>
              ))}
            </div>
          </div>
        )}

        {/* СПИСОК ГРАВЦІВ (ID Картки) */}
        <div className="border-t border-zinc-800/50 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 items-start relative">
            
            {[...gameState.players].sort((a,b) => (a.isDead === b.isDead) ? 0 : a.isDead ? 1 : -1).map((p) => {
              let cardStyles = "border-zinc-700/50 hover:border-zinc-500";
              if (p.isDead) cardStyles = "border-zinc-900 grayscale opacity-80 scale-95 bg-zinc-950";
              else if (p.isNominated) cardStyles = "border-red-900 shadow-[0_0_20px_rgba(153,27,27,0.4)] -translate-y-1 bg-red-950/10";

              return (
              <div key={p.id} className={`flex flex-col bg-zinc-900/90 rounded border transition-all duration-300 relative overflow-hidden ${cardStyles}`}>
                
                {/* Фейковий штрихкод збоку картки */}
                <div className="absolute right-2 top-10 bottom-10 w-4 opacity-10 font-mono text-[8px] leading-none overflow-hidden select-none break-all text-zinc-100 flex items-center text-center rotate-90">
                  ||| | || |||| | || | |||| || |
                </div>

                {p.isDead && (
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                     <div className="text-red-700/80 border-4 border-red-700/80 rounded uppercase font-black text-4xl tracking-widest px-4 py-2 rotate-[-20deg] scale-110 shadow-[0_0_20px_rgba(185,28,28,0.5)] bg-zinc-950/80">ВИГНАНО</div>
                   </div>
                )}

                <div className={`p-2 flex justify-between items-start border-b transition-colors ${p.isNominated ? 'bg-red-950/40 border-red-900/50' : 'bg-zinc-950/80 border-zinc-800'} relative z-20`}>
                  <div className="flex gap-2 items-center">
                    <img src={`https://api.dicebear.com/7.x/${p.isDead?'icons':'bottts'}/svg?seed=${p.name}`} className="w-8 h-8 rounded bg-zinc-800 p-0.5 border border-zinc-600" alt="av" />
                    <div>
                      <h3 className={`text-sm font-black uppercase tracking-wider ${p.isDead ? 'text-zinc-600 line-through' : 'text-white'}`}>
                        {p.name} {p.id === me.id && <span className="text-red-500 ml-1 text-[10px]">*</span>}
                      </h3>
                      <div className="text-[8px] font-mono text-zinc-500">DOSSIER #{p.id.substring(0,6).toUpperCase()}</div>
                    </div>
                  </div>
                  {isHost && !p.isDead && (
                    <button onClick={() => toggleNomination(p.id)} className={`text-lg transition-all active:scale-90 ${p.isNominated ? 'opacity-100 drop-shadow-[0_0_8px_red]' : 'opacity-30 hover:opacity-100 grayscale hover:grayscale-0'}`}>🎯</button>
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
                      }}
                      onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; }}
                      onDragOver={(e) => { if(isHost) e.preventDefault(); }}
                      onDrop={(e) => {
                         if(!isHost) return;
                         e.preventDefault();
                         const source = JSON.parse(e.dataTransfer.getData('text/plain'));
                         handleSwapTraits(source.pId, source.tIdx, p.id, tIdx);
                      }}
                      className={`relative w-full flex flex-col gap-0.5 px-2 py-1.5 rounded border text-[11px] transition-all duration-500 overflow-hidden
                        ${isHost ? 'cursor-grab hover:border-zinc-500' : ''}
                        ${t.visible ? 'bg-zinc-800/40 border-zinc-600/50' : 'bg-zinc-950/80 border-zinc-800/40'}`}
                    >
                      {/* ВОДЯНИЙ ЗНАК TOP SECRET ДЛЯ ЗАКРИТИХ */}
                      {!t.visible && !isHost && (
                         <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 -rotate-6">
                            <span className="font-black text-lg tracking-widest text-zinc-400">TOP SECRET</span>
                         </div>
                      )}

                      <div className="flex justify-between items-center w-full relative z-10">
                         <div className="flex items-center gap-1.5">
                            <span className="shrink-0 text-[10px]">{t.icon}</span>
                            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">{t.label}</span>
                         </div>
                      </div>
                      
                      <div className="flex-1 w-full relative z-10">
                        {isHost ? (
                          <HostTraitEditor pId={p.id} tIdx={tIdx} trait={t} onUpdate={handleTraitChange} onReroll={handleTraitReroll} onReveal={revealTraitAsHost} />
                        ) : t.visible ? (
                          <span className="block break-words whitespace-pre-wrap leading-tight font-mono text-zinc-200">
                             <DecodedText text={t.value} />
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 w-full pt-1 pb-1">
                            <div className="h-1.5 flex-1 bg-zinc-800 rounded-sm"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`p-2 border-t flex justify-between items-center transition-colors ${p.isNominated ? 'bg-red-950/20 border-red-900/30' : 'bg-zinc-950 border-zinc-800/80'} relative z-20`}>
                  {isHost ? (
                    <div className="flex items-center bg-zinc-900 rounded border border-zinc-700 h-7">
                      <button disabled={p.isDead} onClick={() => handleVote(p.id, -1)} className="text-zinc-400 hover:text-white hover:bg-red-900/80 px-3 font-black active:scale-95 h-full">-</button>
                      <span className={`font-mono font-black min-w-[24px] text-center text-xs bg-zinc-950 leading-7 ${p.isDead ? 'text-zinc-600' : 'text-white'}`}>{p.votes || 0}</span>
                      <button disabled={p.isDead} onClick={() => handleVote(p.id, 1)} className="text-zinc-400 hover:text-white hover:bg-green-900/80 px-3 font-black active:scale-95 h-full">+</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.2em]">Вироки:</span>
                      <span className="font-mono font-black text-red-500 text-sm">{p.votes || 0}</span>
                    </div>
                  )}

                  {isHost && !p.isDead && (
                    <button onClick={() => setKickTarget(p)} className="text-zinc-600 hover:text-red-500 bg-zinc-900 hover:bg-red-950/50 px-2 py-1 rounded border border-zinc-700 transition-all active:scale-90 text-[10px] uppercase font-bold tracking-widest">
                      Усунути
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
             <div className="bg-zinc-950/95 border border-zinc-700 w-80 max-h-64 overflow-y-auto rounded p-3 mb-2 shadow-[0_0_30px_rgba(0,0,0,0.8)] text-[10px] font-mono flex flex-col gap-1.5">
                <div className="flex justify-between border-b border-zinc-800 pb-1 mb-1 items-center sticky top-0 bg-zinc-950/90 z-10">
                   <h3 className="text-zinc-400 uppercase tracking-widest font-bold">LOGS.SYS</h3>
                </div>
                {(gameState.logs || []).length === 0 && <span className="text-zinc-600 italic">No events recorded.</span>}
                {(gameState.logs || []).map((l, i) => {
                   let colorClass = "text-green-500";
                   if (l.includes('☠️')) colorClass = "text-red-500";
                   else if (l.includes('🔄')) colorClass = "text-blue-400";
                   else if (l.includes('🎯')) colorClass = "text-orange-400";
                   return <div key={i} className={`${colorClass} leading-tight`}>{l}</div>
                })}
             </div>
          )}
          <button onClick={() => setShowLog(!showLog)} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-600 px-4 py-2 text-[10px] uppercase font-mono font-bold tracking-widest active:scale-95 shadow-lg">
             {showLog ? '[ CLOSE_TERMINAL ]' : '[ OPEN_TERMINAL ]'}
          </button>
        </div>
      )}

      {kickTarget && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-red-900 p-8 rounded shadow-[0_0_50px_rgba(153,27,27,0.4)] max-w-sm w-full text-center border-t-4 border-t-red-600">
            <h3 className="text-xl font-black text-red-500 mb-2 uppercase tracking-widest font-mono">
              ПІДТВЕРДЖЕННЯ УСУНЕННЯ
            </h3>
            <p className="text-zinc-300 text-sm mb-8 font-mono">Об'єкт: [{kickTarget.name}].<br/>Статус: Буде переведено в ізолятор.</p>
            <div className="flex gap-4">
              <button onClick={() => setKickTarget(null)} className="flex-1 py-3 bg-zinc-800 text-zinc-400 font-mono font-bold uppercase text-xs hover:bg-zinc-700">Відміна</button>
              <button onClick={confirmKick} className="flex-1 py-3 bg-red-900 text-white font-mono font-bold uppercase text-xs hover:bg-red-800">EXECUTE()</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}