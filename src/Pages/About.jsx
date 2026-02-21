import { useState, useContext, useEffect } from 'react';
import { GameContext } from './../GameContext';
import { useNavigate } from 'react-router-dom';
import { MACRO_SCENARIOS, MICRO_CRISES, TRAITS_DB, getRandom } from '../db';

const createEmptyPlayer = () => ({
  name: '', isNominated: false,
  traits: Array(11).fill({ label: '', icon: '', value: '', visible: false })
});

export default function CreateGame() {
  const { setGameData } = useContext(GameContext);
  const navigate = useNavigate();
  
  const [macro, setMacro] = useState(MACRO_SCENARIOS[0]);
  const [micro, setMicro] = useState(MICRO_CRISES[0]);
  const [players, setPlayers] = useState([createEmptyPlayer(), createEmptyPlayer()]);

  // Випадкова генерація світу
  const rerollWorld = (type) => {
    if (type === 'macro' || type === 'all') setMacro(getRandom(MACRO_SCENARIOS));
    if (type === 'micro' || type === 'all') setMicro(getRandom(MICRO_CRISES));
  };

  useEffect(() => { rerollWorld('all'); }, []);

  const addPlayer = () => setPlayers([...players, createEmptyPlayer()]);

  // Розумна генерація характеристик
  const generateAllPlayers = () => {
    let hasMale = false; let hasFemale = false;
    const activeTags = [...macro.tags, ...micro.tags];

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
    const unnamed = players.some(p => !p.name);
    if (unnamed) return alert("Дайте імена всім гравцям!");
    setGameData({ players, macro, micro, isStarted: true });
    navigate('/');
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <header className="flex justify-between items-end border-b border-zinc-800 pb-4">
        <h1 className="text-4xl font-black text-zinc-100 uppercase tracking-tighter">Термінал Ініціалізації</h1>
      </header>
      
      {/* Генерація Світу */}
      <section className="grid md:grid-cols-2 gap-6">
        <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-xl space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Макросценарій (Світ)</h2>
            <button onClick={() => rerollWorld('macro')} className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded text-zinc-300 transition">Reroll</button>
          </div>
          <div>
            <h3 className="text-xl font-bold text-red-400 mb-2">{macro.name}</h3>
            <p className="text-sm text-zinc-300 mb-3">{macro.desc}</p>
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/50">
              <span className="text-xs text-zinc-500 block mb-1">Синергійні вимоги:</span>
              <p className="text-sm text-zinc-400">{macro.synergy}</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-xl space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Мікрокриза (Бункер)</h2>
            <button onClick={() => rerollWorld('micro')} className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded text-zinc-300 transition">Reroll</button>
          </div>
          <div>
            <h3 className="text-xl font-bold text-orange-400 mb-2">{micro.category}</h3>
            <p className="text-sm text-zinc-300 mb-3">{micro.desc}</p>
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/50">
              <span className="text-xs text-zinc-500 block mb-1">Критичний виклик:</span>
              <p className="text-sm text-zinc-400">{micro.challenge}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Гравці */}
      <section className="space-y-6">
        <div className="flex justify-between items-center border-b border-zinc-800/50 pb-2">
          <label className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Група виживання ({players.length})</label>
          <div className="flex gap-4">
            <button onClick={addPlayer} className="text-zinc-400 hover:text-white text-sm transition-colors">+ Додати</button>
            <button onClick={generateAllPlayers} className="text-zinc-900 bg-zinc-100 hover:bg-white text-sm font-bold px-4 py-1.5 rounded transition-all">
              Згенерувати характеристики
            </button>
          </div>
        </div>

        <div className="grid gap-6">
          {players.map((p, pIdx) => (
            <div key={pIdx} className="p-5 bg-zinc-900/30 border border-zinc-800/80 rounded-xl flex flex-col gap-4">
              <input 
                className="w-full md:w-1/3 p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 font-bold focus:border-zinc-500 outline-none"
                placeholder={`Ім'я гравця ${pIdx + 1}`}
                value={p.name}
                onChange={(e) => {
                  const n = [...players]; n[pIdx].name = e.target.value; setPlayers(n);
                }}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {p.traits.map((t, tIdx) => (
                  <div key={tIdx} className="flex bg-zinc-950 border border-zinc-800/60 rounded-md overflow-hidden focus-within:border-zinc-600 transition-colors">
                    <span className="bg-zinc-900 flex items-start pt-3 justify-center px-2 text-xs border-r border-zinc-800/60 shrink-0 min-w-[32px]" title={t.label}>
                      {t.icon}
                    </span>
                    <textarea 
                      className="flex-1 p-2 bg-transparent text-xs text-zinc-300 outline-none w-full placeholder:text-zinc-700 resize-y min-h-[45px]"
                      rows={Math.max(2, Math.ceil((t.value?.length || 0) / 30))}
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
      </section>

      <button onClick={startGame} className="w-full py-5 bg-red-900 hover:bg-red-800 text-red-100 font-black text-xl uppercase tracking-widest rounded-lg transition-all shadow-[0_0_20px_rgba(153,27,27,0.4)]">
        Запечатати Бункер
      </button>
    </div>
  );
}