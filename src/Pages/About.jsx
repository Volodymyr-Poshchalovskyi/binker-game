import { useState, useContext, useEffect } from 'react';
import { SocketContext } from '../SocketContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { MACRO_SCENARIOS, MICRO_CRISES, TRAITS_DB, getRandom } from '../db';

export default function About() { 
  const { socket, roomCode, roomPlayers, me, isHost } = useContext(SocketContext);
  const navigate = useNavigate();
  
  const [macro, setMacro] = useState(MACRO_SCENARIOS[0]);
  const [micro, setMicro] = useState(MICRO_CRISES[0]);
  const [players, setPlayers] = useState([]);

  if (!isHost) {
    return <Navigate to="/" />;
  }

  useEffect(() => { 
    rerollWorld('all'); 
    
    const actualPlayers = roomPlayers.filter(p => p.id !== me.id);
    
    if (actualPlayers.length > 0) {
      const initializedPlayers = actualPlayers.map(p => ({
        id: p.id,
        name: p.name,
        isNominated: false,
        votes: 0,
        traits: Array(11).fill({ label: '', icon: '', value: '', visible: false })
      }));
      setPlayers(initializedPlayers);
    }
  }, [roomPlayers, me.id]);

  const rerollWorld = (type) => {
    if (type === 'macro' || type === 'all') setMacro({ ...getRandom(MACRO_SCENARIOS), customText: '' });
    if (type === 'micro' || type === 'all') setMicro({ ...getRandom(MICRO_CRISES), customText: '' });
  };

  const generateAllPlayers = () => {
    let hasMale = false; let hasFemale = false;
    const activeTags = [...(macro.tags || []), ...(micro.tags || [])];

    const newPlayers = players.map((p, idx) => {
      let sex = Math.random() > 0.5 ? "Чоловік" : "Жінка";
      if (idx === players.length - 1 && !hasMale) sex = "Чоловік";
      if (idx === players.length - 2 && !hasFemale) sex = "Жінка";
      if (sex === "Чоловік") hasMale = true;
      if (sex === "Жінка") hasFemale = true;
      const age = Math.floor(Math.random() * 45) + 18;

      let prof = getRandom(TRAITS_DB.professions);
      if (Math.random() > 0.5) {
        const usefulProfs = TRAITS_DB.professions.filter(pr => activeTags.includes(pr.tag));
        if (usefulProfs.length > 0) prof = getRandom(usefulProfs);
      }
      const health = getRandom(TRAITS_DB.health);

      return {
        ...p,
        traits: [
          { label: 'Стать та вік', icon: '🚻', value: `${sex}, ${age} р.`, visible: false },
          { label: 'Професія', icon: '💼', value: prof.name, visible: false },
          { label: 'Здоров\'я', icon: '❤️', value: `${health.val}% (${health.name})`, visible: false },
          { label: 'Хобі', icon: '🎨', value: getRandom(TRAITS_DB.hobbies), visible: false },
          { label: 'Фобія', icon: '😱', value: getRandom(TRAITS_DB.phobias), visible: false },
          { label: 'Багаж', icon: '🎒', value: getRandom(TRAITS_DB.luggage), visible: false },
          { label: 'Великий багаж', icon: '🧳', value: getRandom(TRAITS_DB.large_luggage), visible: false },
          { label: 'Факт', icon: 'ℹ️', value: getRandom(TRAITS_DB.facts), visible: false },
          { label: 'Приховано', icon: '👁️', value: getRandom(TRAITS_DB.facts), visible: false },
          { label: 'Дія 1', icon: '🃏', value: getRandom(TRAITS_DB.actions), visible: false },
          { label: 'Дія 2', icon: '🃏', value: getRandom(TRAITS_DB.actions), visible: false },
        ]
      };
    });
    setPlayers(newPlayers);
  };

  const startGame = () => {
    const timerData = { isRunning: false, pausedLeft: 60, endsAt: null };
    const gameData = { players, macro, micro, isStarted: true, timer: timerData };
    socket.emit('start_game', { roomCode, gameData });
    navigate('/');
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-[fadeIn_0.4s_ease-out]">
      <header className="flex justify-between items-end border-b border-zinc-800 pb-4">
        <h1 className="text-4xl font-black text-zinc-100 uppercase tracking-tighter">Термінал Ініціалізації</h1>
      </header>
      
      <section className="grid md:grid-cols-2 gap-6">
        <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-xl space-y-4 hover:border-zinc-700 transition-colors flex flex-col">
          <div className="flex justify-between items-center">
            <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Макросценарій (Світ)</h2>
            <button onClick={() => rerollWorld('macro')} className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded text-zinc-300 transition">Reroll</button>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-red-400 mb-2">{macro.name}</h3>
            <p className="text-sm text-zinc-300 mb-4">{macro.desc}</p>
          </div>
          <textarea 
            placeholder="Додати свої умови до світу (опційно)..."
            value={macro.customText || ''}
            onChange={(e) => setMacro({...macro, customText: e.target.value})}
            className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 outline-none focus:border-red-900/50 resize-y min-h-[60px] transition-colors"
          />
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-xl space-y-4 hover:border-zinc-700 transition-colors flex flex-col">
          <div className="flex justify-between items-center">
            <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Мікрокриза (Бункер)</h2>
            <button onClick={() => rerollWorld('micro')} className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded text-zinc-300 transition">Reroll</button>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-orange-400 mb-2">{micro.category}</h3>
            <p className="text-sm text-zinc-300 mb-4">{micro.desc}</p>
          </div>
          <textarea 
            placeholder="Додати свої умови до бункера (опційно)..."
            value={micro.customText || ''}
            onChange={(e) => setMicro({...micro, customText: e.target.value})}
            className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 outline-none focus:border-orange-900/50 resize-y min-h-[60px] transition-colors"
          />
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex justify-between items-center border-b border-zinc-800/50 pb-2">
          <label className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Група виживання ({players.length})</label>
          <button onClick={generateAllPlayers} className="text-zinc-900 bg-zinc-100 hover:bg-white text-sm font-bold px-4 py-1.5 rounded-lg transition-all shadow-md">
            Згенерувати характеристики всім
          </button>
        </div>

        {players.length === 0 ? (
          <div className="text-center p-10 bg-zinc-900/30 border border-zinc-800 rounded-xl text-zinc-500 uppercase tracking-widest">
            Немає гравців для генерації. Зачекайте, поки хтось приєднається.
          </div>
        ) : (
          <div className="grid gap-6">
            {players.map((p, pIdx) => (
              <div key={p.id} className="p-5 bg-zinc-900/30 border border-zinc-800/80 rounded-xl flex flex-col gap-4">
                <div className="text-zinc-100 font-bold text-lg bg-zinc-950 p-2 px-4 rounded-lg border border-zinc-800 inline-block w-fit">
                  {p.name}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {p.traits.map((t, tIdx) => (
                    <div key={tIdx} className="flex bg-zinc-950 border border-zinc-800/60 rounded-md overflow-hidden focus-within:border-zinc-500 transition-colors">
                      <span className="bg-zinc-900 flex items-start pt-3 justify-center px-2 text-xs border-r border-zinc-800/60 shrink-0 min-w-[32px]" title={t.label}>
                        {t.icon}
                      </span>
                      <textarea 
                        className="flex-1 p-2 bg-transparent text-xs text-zinc-300 outline-none w-full placeholder:text-zinc-700 resize-y min-h-[45px]"
                        placeholder={t.label} 
                        value={t.value || ''}
                        onChange={(e) => {
                          const n = [...players]; n[pIdx].traits[tIdx].value = e.target.value; setPlayers(n);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {players.length > 0 && (
        <button onClick={startGame} className="w-full py-5 bg-red-900 hover:bg-red-800 text-red-100 font-black text-xl uppercase tracking-widest rounded-xl transition-all shadow-[0_0_30px_rgba(153,27,27,0.4)] hover:scale-[1.01]">
          Запечатати Бункер (Почати Гру)
        </button>
      )}
    </div>
  );
}