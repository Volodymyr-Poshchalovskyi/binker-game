import { useContext, useState, useEffect, useRef } from 'react';
import { SocketContext } from '../SocketContext';
import Lobby from './Lobby';
import { TRAITS_DB, getRandom } from '../db';

// --- АУДІО ДВИЖОК (Генерація ретро-звуків без MP3) ---
const playSfx = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    if (type === 'type') {
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
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) { console.log("Audio not supported"); }
};

// Анімація "Декодування" тексту (Термінальний друк)
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
      if (iter < target.length && Math.random() > 0.5) playSfx('type');
      iter += target.length / 20 + 1;
      if (iter >= target.length) {
        clearInterval(interval);
        setDisplay(target);
      }
    }, 40);
    return () => clearInterval(interval);
  }, [text]);
  return <span>{display}<span className="animate-pulse">_</span></span>;
};

// Редактор Хоста (Fallout Style)
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
        <button 
          onClick={() => { playSfx('type'); onReveal(pId, tIdx); }}
          className="shrink-0 text-[10px] bg-green-900/40 hover:bg-green-500 hover:text-black text-green-500 border border-green-500 px-1 py-0.5 font-bold active:scale-95 transition-colors"
          title="Відкрити всім"
        >
          [DEC]
        </button>
      )}
      <textarea
        ref={textareaRef}
        className="flex-1 bg-black/80 border border-green-800 focus:border-green-400 p-1 text-green-400 outline-none text-[12px] resize-none overflow-hidden min-h-[26px] term-text selection:bg-green-500 selection:text-black"
        value={val}
        onChange={(e) => { setVal(e.target.value); adjustHeight(); }}
        onBlur={() => { if(val !== trait.value) onUpdate(pId, tIdx, val); }} 
        spellCheck="false"
      />
      <button 
        onClick={() => onReroll(pId, tIdx, trait.label)} 
        className="shrink-0 text-[10px] bg-green-900/40 hover:bg-green-500 hover:text-black text-green-500 border border-green-500 px-1 py-0.5 active:scale-95 transition-colors font-bold"
        title="Випадкове значення"
      >
        [RND]
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
      addLog(`SYS_MSG: [${player.traits[tIdx].label}] DECRYPTED FOR UNIT_${player.name.substring(0,3).toUpperCase()}`, newData);
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
      addLog(`SYS_MSG: PARAMETER [${label}] REROLLED FOR UNIT_${player.name.substring(0,3).toUpperCase()}`, newData);
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
        addLog(`SYS_OP: DATA SWAP EXECUTED BETWEEN ${p1.name} AND ${p2.name}`, newData);
        updateGameState(newData);
    } else { alert("ERROR: DATA TYPE MISMATCH."); }
  };

  const toggleNomination = (pId) => {
    if (!isHost) return;
    const newData = JSON.parse(JSON.stringify(gameState));
    const player = newData.players.find(p => p.id === pId);
    if (player) {
      player.isNominated = !player.isNominated;
      addLog(`TARGET: UNIT_${player.name.toUpperCase()} ${player.isNominated ? 'MARKED FOR PURGE' : 'CLEARED'}`, newData);
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
    playSfx('slam'); 
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
    addLog(`CRITICAL: UNIT_${target.name.toUpperCase()} HAS BEEN PURGED FROM BUNKER.`, newData);
    updateGameState(newData);
    setKickTarget(null); 
  };

  const myCard = gameState.players.find(p => p.id === me.id);

  return (
    <>
      {/* CSS ДЛЯ ФОЛАУТ-ЕФЕКТІВ */}
      <style>{`
        body { background-color: #020802; }
        .term-text { text-shadow: 0 0 6px rgba(34, 197, 94, 0.6); }
        .term-text-red { text-shadow: 0 0 8px rgba(239, 68, 68, 0.8); }
        .pip-boy-filter { filter: sepia(1) hue-rotate(70deg) saturate(300%) contrast(120%) brightness(90%); }
        .scanlines {
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
          background-size: 100% 4px, 3px 100%;
          pointer-events: none;
        }
      `}</style>

      {/* ГЛОБАЛЬНИЙ CRT-ЕФЕКТ */}
      <div className="fixed inset-0 z-50 scanlines opacity-30 mix-blend-overlay"></div>
      <div className="fixed inset-0 z-40 shadow-[inset_0_0_100px_rgba(0,20,0,1)] pointer-events-none"></div>

      <div className="p-3 md:p-6 w-full mx-auto space-y-6 max-w-[2000px] animate-[fadeIn_0.5s_ease-out] relative z-10 font-mono text-green-500 selection:bg-green-500 selection:text-black">
        
        {/* ХЕДЕР ТЕРМІНАЛУ */}
        <div className="flex justify-between items-center border-b-2 border-green-600 pb-2 mb-4">
          <div>
            <h1 className="font-black uppercase tracking-[0.2em] text-xl term-text flex items-center gap-3">
              <span className="w-4 h-4 bg-green-500 inline-block animate-pulse"></span>
              ROBCO INDUSTRIES UNIFIED OP_SYS
            </h1>
            <p className="text-green-700 text-[10px] tracking-widest uppercase mt-1">v2.4.1 // COPYRIGHT 2077 // SECURE CONNECTION ESTABLISHED</p>
          </div>
          <button 
            onClick={() => setShowSynopsis(!showSynopsis)}
            className="text-xs font-bold uppercase tracking-widest bg-black hover:bg-green-500 hover:text-black text-green-500 py-2 px-4 border-2 border-green-500 transition-colors active:scale-95 term-text"
          >
            {showSynopsis ? '[ HIDE_OVERVIEW ]' : '[ SHOW_OVERVIEW ]'}
          </button>
        </div>

        {/* ПАНЕЛЬ СИНОПСИСУ */}
        {showSynopsis && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-[fadeIn_0.2s_ease-out]">
            <div className="border-2 border-green-600 bg-green-950/10 p-5 relative">
              <div className="absolute top-0 right-0 bg-green-600 text-black font-black px-2 py-0.5 text-xs uppercase">EXT_ENV</div>
              <h2 className="text-green-400 font-bold uppercase text-[10px] tracking-widest mb-2 term-text">&gt; THREAT_DETECTED</h2>
              <h3 className="text-green-500 text-lg font-black mb-2 uppercase term-text">{gameState.macro.name}</h3>
              <p className="text-green-600 text-xs leading-relaxed uppercase">{gameState.macro.desc}</p>
              {gameState.macro.customText && <p className="text-green-400 text-[10px] italic mt-3 pt-2 border-t border-green-900/50">+ {gameState.macro.customText}</p>}
            </div>
            
            <div className="border-2 border-green-600 bg-green-950/10 p-5 relative">
              <div className="absolute top-0 right-0 bg-green-600 text-black font-black px-2 py-0.5 text-xs uppercase">INT_SYS</div>
              <h2 className="text-green-400 font-bold uppercase text-[10px] tracking-widest mb-2 term-text">&gt; FACILITY_ERROR</h2>
              <h3 className="text-green-500 text-lg font-black mb-2 uppercase term-text">{gameState.micro.category}</h3>
              <p className="text-green-600 text-xs leading-relaxed uppercase">{gameState.micro.desc}</p>
              {gameState.micro.customText && <p className="text-green-400 text-[10px] italic mt-3 pt-2 border-t border-green-900/50">+ {gameState.micro.customText}</p>}
            </div>

            {gameState.bunkerData && (
              <div className="border-2 border-green-600 bg-green-950/10 p-5 relative flex flex-col justify-between">
                <div className="absolute top-0 right-0 bg-green-600 text-black font-black px-2 py-0.5 text-xs uppercase">CAPACITY: {gameState.bunkerData.capacity}</div>
                <h2 className="text-green-400 font-bold uppercase text-[10px] tracking-widest mb-4 term-text">&gt; BUNKER_SPECS</h2>
                <ul className="space-y-2 text-xs uppercase text-green-500 flex-1">
                  <li className="flex items-start gap-2 border-b border-green-900 pb-1"><span className="text-green-700 w-12 shrink-0">TIME:</span> <span className="term-text">{gameState.bunkerData.duration}</span></li>
                  <li className="flex items-start gap-2 border-b border-green-900 pb-1"><span className="text-green-700 w-12 shrink-0">GOAL:</span> <span className="term-text">{gameState.bunkerData.mission}</span></li>
                  <li className="flex items-start gap-2 border-b border-green-900 pb-1 text-green-400"><span className="text-green-700 w-12 shrink-0">WARN:</span> <span className="term-text">{gameState.bunkerData.deficit}</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-700 w-12 shrink-0">ASSET:</span> <span className="term-text">{gameState.bunkerData.facility}</span></li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ПАНЕЛЬ ВЛАСНОЇ СПРАВИ */}
        {!isHost && myCard && (
          <div className={`border-2 ${myCard.isDead ? 'border-red-700 bg-red-950/10 text-red-500' : 'border-green-500 bg-green-950/20'} p-5 relative overflow-hidden mt-6`}>
            
            {myCard.isDead && (
              <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <div className="text-red-600 border-4 border-red-600 px-6 py-2 text-6xl font-black uppercase rotate-[-10deg] term-text-red">
                  [ PURGED ]
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 mb-4 border-b-2 border-current pb-3">
              <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${myCard.name}`} className={`w-16 h-16 border-2 border-current ${myCard.isDead ? 'filter grayscale sepia hue-rotate-[0deg] saturate-[500%]' : 'pip-boy-filter'}`} alt="avatar" />
              <div>
                <h2 className="font-black uppercase tracking-[0.2em] text-lg term-text">&gt; PERSONAL_DOSSIER: {myCard.name}</h2>
                <div className="opacity-70 text-xs tracking-widest mt-1">ID: {myCard.id.split('-')[0].toUpperCase()} // CLASSIFIED</div>
              </div>
            </div>
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relative z-10 ${myCard.isDead ? 'opacity-50 pointer-events-none' : ''}`}>
              {myCard.traits.map((t, idx) => (
                 <div key={idx} className={`p-3 border flex flex-col gap-2 ${t.visible ? 'border-current bg-current/10' : 'border-current/30 border-dashed'}`}>
                    <div className="flex justify-between items-start w-full border-b border-current/30 pb-1 mb-1">
                        <span className="font-bold uppercase tracking-widest text-[10px] opacity-80">{t.label}</span>
                        <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 ${t.visible ? 'bg-current text-black' : 'border border-current opacity-60'}`}>{t.visible ? 'PUBLIC' : 'SECURE'}</span>
                    </div>
                   <span className="text-sm font-bold uppercase term-text">{t.value}</span>
                 </div>
              ))}
            </div>
          </div>
        )}

        {/* СПИСОК ГРАВЦІВ */}
        <div className="mt-8">
          <h2 className="text-green-500 font-black uppercase tracking-[0.2em] mb-4 text-xl flex items-center gap-4 term-text">
            &gt; DATABASE_ENTRIES
            <div className="h-px bg-green-700 flex-1"></div>
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            
            {[...gameState.players].sort((a,b) => (a.isDead === b.isDead) ? 0 : a.isDead ? 1 : -1).map((p) => {
              
              let cardStyles = "border-green-700";
              let textStyles = "text-green-500";
              let bgStyles = "bg-black";
              
              if (p.isDead) {
                  cardStyles = "border-red-900 border-dashed";
                  textStyles = "text-red-700";
                  bgStyles = "bg-[#0a0000]";
              }
              else if (p.isNominated) {
                  cardStyles = "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]";
                  textStyles = "text-red-500";
                  bgStyles = "bg-[#100000]";
              }

              return (
              <div key={p.id} className={`flex flex-col border-2 relative overflow-hidden transition-all ${cardStyles} ${bgStyles} ${textStyles}`}>
                
                {/* Вертикальний штрихкод */}
                <div className="absolute right-1 top-10 bottom-10 w-4 opacity-20 text-[8px] leading-none overflow-hidden select-none break-all flex items-center text-center rotate-90">
                  ||| | || |||| | || | |||| || |
                </div>

                {p.isDead && (
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                     <div className="border-4 border-red-700 px-4 py-1 text-4xl font-black uppercase rotate-[-15deg] term-text-red bg-black/80">
                       [PURGED]
                     </div>
                   </div>
                )}

                <div className={`p-2 flex justify-between items-start border-b-2 ${p.isDead ? 'border-red-900' : (p.isNominated ? 'border-red-500' : 'border-green-800')} relative z-20`}>
                  <div className="flex gap-3 items-center">
                    <img src={`https://api.dicebear.com/7.x/${p.isDead?'icons':'bottts'}/svg?seed=${p.name}`} className={`w-10 h-10 border border-current ${p.isDead ? 'filter grayscale sepia hue-rotate-[0deg] saturate-[500%]' : 'pip-boy-filter'}`} alt="av" />
                    <div>
                      <h3 className={`text-base font-black uppercase tracking-widest term-text ${p.isDead ? 'line-through opacity-70' : ''}`}>
                        {p.name} {p.id === me.id && <span className="text-current ml-1 text-xs">*YOU*</span>}
                      </h3>
                      <div className="text-[10px] opacity-60 uppercase">REF: {p.id.substring(0,8)}</div>
                    </div>
                  </div>
                  {isHost && !p.isDead && (
                    <button onClick={() => toggleNomination(p.id)} className={`text-xs px-2 py-1 border transition-colors font-bold uppercase active:scale-95 ${p.isNominated ? 'bg-red-500 text-black border-red-500 term-text-red' : 'border-green-600 hover:bg-red-900 hover:text-red-500 hover:border-red-500 text-green-600'}`}>
                      [TGT]
                    </button>
                  )}
                </div>

                <div className="p-2 flex-1 flex flex-col gap-2 relative z-20">
                  {p.traits.map((t, tIdx) => (
                    <div 
                      key={t.visible ? `v-${tIdx}` : `h-${tIdx}`} 
                      draggable={isHost}
                      onDragStart={(e) => {
                         if(!isHost) return;
                         e.dataTransfer.setData('text/plain', JSON.stringify({ pId: p.id, tIdx }));
                         e.currentTarget.style.opacity = '0.5';
                         e.currentTarget.style.borderStyle = 'dashed';
                      }}
                      onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderStyle = 'solid'; }}
                      onDragOver={(e) => { if(isHost) e.preventDefault(); }}
                      onDrop={(e) => {
                         if(!isHost) return;
                         e.preventDefault();
                         const source = JSON.parse(e.dataTransfer.getData('text/plain'));
                         handleSwapTraits(source.pId, source.tIdx, p.id, tIdx);
                      }}
                      className={`relative w-full flex flex-col px-2 py-1.5 border transition-all duration-300
                        ${isHost ? 'cursor-grab hover:bg-current/10' : ''}
                        ${t.visible ? 'border-current bg-current/5' : 'border-current/30 border-dashed'}`}
                    >
                      {/* WATERMARK TOP SECRET */}
                      {!t.visible && !isHost && (
                         <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 -rotate-3">
                            <span className="font-black text-xl tracking-widest border-2 border-current px-2">[ TOP SECRET ]</span>
                         </div>
                      )}

                      <div className="flex justify-between items-center w-full mb-1">
                         <span className="text-[9px] uppercase font-bold tracking-widest opacity-70">
                           {t.label.replace('Приховано', 'HIDDEN').replace('Прихований Факт', 'HIDDEN_FACT')}
                         </span>
                      </div>
                      
                      <div className="flex-1 w-full text-xs uppercase font-bold">
                        {isHost ? (
                          <HostTraitEditor pId={p.id} tIdx={tIdx} trait={t} onUpdate={handleTraitChange} onReroll={handleTraitReroll} onReveal={revealTraitAsHost} />
                        ) : t.visible ? (
                          <span className="block break-words whitespace-pre-wrap term-text leading-tight">
                             <DecodedText text={t.value} />
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 w-full h-4">
                            <div className="h-2 flex-1 bg-current/20"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`p-2 border-t-2 flex justify-between items-center relative z-20 ${p.isDead ? 'border-red-900' : (p.isNominated ? 'border-red-500' : 'border-green-800')}`}>
                  {isHost ? (
                    <div className="flex items-center border border-current h-8">
                      <button disabled={p.isDead} onClick={() => handleVote(p.id, -1)} className="hover:bg-current hover:text-black px-3 font-black h-full disabled:opacity-30 transition-colors">[ - ]</button>
                      <span className="font-mono font-black min-w-[30px] text-center text-sm leading-8">{p.votes || 0}</span>
                      <button disabled={p.isDead} onClick={() => handleVote(p.id, 1)} className="hover:bg-current hover:text-black px-3 font-black h-full disabled:opacity-30 transition-colors">[ + ]</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">VOTES:</span>
                      <span className="font-black text-lg term-text">{p.votes || 0}</span>
                    </div>
                  )}

                  {isHost && !p.isDead && (
                    <button onClick={() => setKickTarget(p)} className="hover:bg-red-600 bg-black text-red-500 hover:text-black px-3 py-1 border border-red-600 transition-colors active:scale-95 text-[10px] uppercase font-bold tracking-widest">
                      [ EXECUTE ]
                    </button>
                  )}
                </div>
              </div>
            )})}
          </div>
        </div>
      </div>

      {/* ЖУРНАЛ ПОДІЙ (ТЕРМІНАЛ) */}
      {isHost && (
        <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end font-mono">
          {showLog && (
             <div className="bg-black/95 border-2 border-green-500 w-96 max-h-64 overflow-y-auto p-4 mb-2 shadow-[0_0_20px_rgba(34,197,94,0.3)] text-[10px] flex flex-col gap-2">
                <div className="border-b-2 border-green-600 pb-2 mb-2 sticky top-0 bg-black z-10 uppercase tracking-widest font-black text-green-400">
                   &gt; ROOT/SYS_LOGS
                </div>
                {(gameState.logs || []).length === 0 && <span className="opacity-50 italic animate-pulse">Waiting for input... _</span>}
                {(gameState.logs || []).map((l, i) => {
                   let colorClass = "text-green-500";
                   if (l.includes('CRITICAL')) colorClass = "text-red-500 term-text-red";
                   else if (l.includes('TARGET')) colorClass = "text-red-400";
                   else if (l.includes('SYS_OP')) colorClass = "text-green-300";
                   return <div key={i} className={`${colorClass} leading-tight break-words`}>{l}</div>
                })}
             </div>
          )}
          <button onClick={() => setShowLog(!showLog)} className="bg-black hover:bg-green-500 text-green-500 hover:text-black border-2 border-green-500 px-4 py-2 text-xs uppercase font-bold tracking-widest active:scale-95 transition-colors shadow-lg">
             {showLog ? '[ CLOSE_LOGS ]' : '[ OPEN_LOGS ]'}
          </button>
        </div>
      )}

      {/* МОДАЛКА ВИГНАННЯ (CRITICAL ALERT) */}
      {kickTarget && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 font-mono text-red-500 scanlines">
          <div className="bg-[#0a0000] border-4 border-red-600 p-8 shadow-[0_0_50px_rgba(220,38,38,0.4)] max-w-md w-full text-center">
            <h3 className="text-3xl font-black mb-4 uppercase tracking-widest term-text-red animate-pulse">
              ! WARNING !
            </h3>
            <p className="text-red-400 text-sm mb-6 leading-relaxed font-bold uppercase border-y border-red-900/50 py-4">
              INITIATING PURGE PROTOCOL FOR UNIT:<br/>
              <span className="text-xl text-white block mt-2 bg-red-900/50 py-1">[{kickTarget.name}]</span>
              <br/>
              <span className="text-[10px] text-red-600 mt-2 block">Action cannot be undone. Subject will be removed from voting pool. Inventory remains accessible.</span>
            </p>
            <div className="flex gap-4">
              <button onClick={() => setKickTarget(null)} className="flex-1 py-3 bg-black hover:bg-red-950 text-red-500 font-bold border-2 border-red-700 uppercase text-xs tracking-widest transition-colors active:scale-95">
                [ ABORT ]
              </button>
              <button onClick={confirmKick} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-black font-black uppercase text-xs tracking-widest transition-colors active:scale-95 shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                [ CONFIRM ]
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}