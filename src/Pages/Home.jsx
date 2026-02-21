import { useContext, useState, useEffect } from 'react';
import { GameContext } from './../GameContext';

export default function Home() {
  const { gameData, setGameData } = useContext(GameContext);
  const [timeLeft, setTimeLeft] = useState(60);
  const [timerActive, setTimerActive] = useState(false);
  const [votes, setVotes] = useState({});

  useEffect(() => {
    let interval;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  if (!gameData?.isStarted) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center text-zinc-600 uppercase tracking-widest">
        <p className="text-2xl animate-pulse font-light">Система офлайн</p>
        <p className="text-xs mt-3 tracking-[0.2em]">Ініціалізуйте протокол через створення гри</p>
      </div>
    );
  }

  const toggleTrait = (pIdx, tIdx) => {
    const newData = { ...gameData };
    newData.players[pIdx].traits[tIdx].visible = !newData.players[pIdx].traits[tIdx].visible;
    setGameData(newData);
  };

  const updateTraitValue = (pIdx, tIdx, newVal) => {
    const newData = { ...gameData };
    newData.players[pIdx].traits[tIdx].value = newVal;
    setGameData(newData);
  };

  const toggleNomination = (pIdx) => {
    const newData = { ...gameData };
    newData.players[pIdx].isNominated = !newData.players[pIdx].isNominated;
    setGameData(newData);
  };

  const handleVote = (name, val) => setVotes(prev => ({ ...prev, [name]: (prev[name] || 0) + val }));

  const kickPlayer = (idx) => {
    if (window.confirm("Відкрити шлюз і вилучити гравця назавжди?")) {
      const newData = { ...gameData };
      newData.players.splice(idx, 1);
      setGameData(newData);
    }
  };

  return (
    // Використовуємо всю ширину екрану для розміщення 7 карток
    <div className="p-2 md:p-4 w-full mx-auto space-y-6 max-w-[2000px]">
      {/* Інформаційна панель Бункера */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Макро і Мікро сценарії */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-zinc-900/80 border-l-4 border-red-900 p-4 rounded-r-xl flex flex-col justify-between">
            <div>
              <h2 className="text-red-500/80 font-bold uppercase text-[10px] tracking-[0.2em] mb-1">Зовнішня загроза</h2>
              <h3 className="text-zinc-100 text-base md:text-lg font-bold mb-2">{gameData.macro.name}</h3>
              <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">{gameData.macro.desc}</p>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-800/50 text-[11px] md:text-xs text-zinc-500">
              <span className="text-red-900 mr-2">▶</span> {gameData.macro.synergy}
            </div>
          </div>

          <div className="bg-zinc-900/80 border-l-4 border-orange-700 p-4 rounded-r-xl flex flex-col justify-between">
            <div>
              <h2 className="text-orange-500/80 font-bold uppercase text-[10px] tracking-[0.2em] mb-1">Внутрішня криза</h2>
              <h3 className="text-zinc-100 text-base md:text-lg font-bold mb-2">{gameData.micro.category}</h3>
              <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">{gameData.micro.desc}</p>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-800/50 text-[11px] md:text-xs text-zinc-500">
              <span className="text-orange-800 mr-2">▶</span> {gameData.micro.challenge}
            </div>
          </div>
        </div>

        {/* Таймер Обговорення */}
        <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-zinc-900">
            <div className="h-full bg-red-900 transition-all duration-1000" style={{ width: `${(timeLeft / 60) * 100}%` }} />
          </div>
          <div className={`text-5xl md:text-6xl font-mono font-light tracking-tighter mb-4 z-10 ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-zinc-100'}`}>
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
          <div className="flex gap-2 z-10 items-stretch">
            {!timerActive ? (
              <button onClick={() => setTimerActive(true)} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-5 py-2 md:py-3 rounded text-sm uppercase font-bold transition-colors">Start</button>
            ) : (
              <button onClick={() => setTimerActive(false)} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-5 py-2 md:py-3 rounded text-sm uppercase font-bold transition-colors">Pause</button>
            )}
            <button 
              onClick={() => { setTimeLeft(60); setTimerActive(false); }} 
              className="bg-zinc-800 hover:bg-red-900 hover:text-white text-zinc-300 px-4 py-2 md:py-3 rounded text-xl uppercase font-bold transition-colors flex items-center justify-center"
              title="Скинути таймер"
            >
              ⟳
            </button>
          </div>
        </div>
      </div>

      {/* Картки Гравців (Адаптивна сітка до 7 в ряд) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7 gap-2 md:gap-3">
        {gameData.players.map((p, pIdx) => (
          <div key={pIdx} className={`flex flex-col bg-zinc-900/90 rounded-xl transition-all duration-300 overflow-hidden border ${p.isNominated ? 'border-red-900/60 shadow-[0_0_40px_rgba(153,27,27,0.15)] bg-red-950/20' : 'border-zinc-800 hover:border-zinc-700'}`}>
            
            <div className={`p-3 flex justify-between items-center border-b ${p.isNominated ? 'border-red-900/30' : 'border-zinc-800/50'}`}>
              <h3 className="text-base font-bold text-zinc-100 truncate pr-2">{p.name}</h3>
              <button onClick={() => toggleNomination(pIdx)} className={`text-lg transition-all ${p.isNominated ? 'scale-110 drop-shadow-md opacity-100 filter-none' : 'opacity-30 hover:opacity-100 grayscale'}`}>
                🎯
              </button>
            </div>

            <div className="p-2 flex-1 flex flex-col gap-1.5">
              {p.traits.map((t, tIdx) => (
                <div 
                  key={tIdx} 
                  className={`w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-md transition-all duration-200 border text-[13px] leading-tight
                    ${t.visible ? 'bg-zinc-800/60 border-zinc-700 text-zinc-200 shadow-inner' : 'bg-zinc-950/80 border-transparent text-zinc-600 hover:bg-zinc-800/50 hover:text-zinc-400'}`}
                >
                  <button 
                    onClick={() => toggleTrait(pIdx, tIdx)}
                    className={`pt-0.5 shrink-0 ${!t.visible && 'opacity-40 grayscale'} hover:scale-125 transition-transform`}
                    title="Показати/Сховати"
                  >
                    {t.icon}
                  </button>

                  {t.visible ? (
                    <textarea
                      value={t.value || ''}
                      onChange={(e) => updateTraitValue(pIdx, tIdx, e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none resize-y min-h-[20px] w-full break-words"
                      rows={Math.max(1, Math.ceil((t.value?.length || 0) / 20))}
                    />
                  ) : (
                    <div 
                      onClick={() => toggleTrait(pIdx, tIdx)} 
                      className="font-medium flex-1 pt-0.5 cursor-pointer select-none text-xs"
                    >
                      ПРИХОВАНО
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-2 bg-zinc-950 border-t border-zinc-800/80 flex justify-between items-center">
              <div className="flex items-center gap-1 bg-zinc-900/80 rounded border border-zinc-800">
                <button onClick={() => handleVote(p.name, -1)} className="text-zinc-600 hover:text-red-400 px-2 py-1 transition-colors">-</button>
                <span className="font-mono text-zinc-300 font-bold min-w-[16px] text-center text-sm">{votes[p.name] || 0}</span>
                <button onClick={() => handleVote(p.name, 1)} className="text-zinc-600 hover:text-green-400 px-2 py-1 transition-colors">+</button>
              </div>
              <button onClick={() => kickPlayer(pIdx)} className="text-zinc-700 hover:text-red-500 p-1.5 rounded-full transition-colors hover:bg-red-950/30 text-sm">
                ☠️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}