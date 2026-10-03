import { useState, useRef, useCallback } from 'react';

type Screen = 'budget' | 'allocate' | 'shopping' | 'complete' | 'summary';

interface Recipient {
  id: string;
  name: string;
  emoji: string;
  budget: number;
  purchases: number[];
  completed: boolean;
}

const COINS = [
  { value: 10,  label: '10',   color: 'from-orange-400 to-orange-600',  size: 40 },
  { value: 50,  label: '50',   color: 'from-yellow-400 to-yellow-500',  size: 44 },
  { value: 100, label: '100',  color: 'from-slate-300 to-slate-500',    size: 48 },
  { value: 500, label: '500',  color: 'from-yellow-500 to-amber-600',   size: 52 },
];

const BILL = { value: 1000, label: '1000円札', color: 'from-green-400 to-green-600' };

const INIT_RECIPIENTS: Omit<Recipient, 'budget' | 'purchases' | 'completed'>[] = [
  { id: '1', name: '自分',       emoji: '😊' },
  { id: '2', name: 'お母さん', emoji: '👩' },
  { id: '3', name: 'お父さん', emoji: '👨' },
  { id: '4', name: '友達',     emoji: '👫' },
];

function PurseIcon({ size = 64, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 80 80" fill="none"
      className={animated ? 'animate-bounce' : ''}
    >
      <ellipse cx="40" cy="52" rx="30" ry="24" fill="#FF8FA3" />
      <ellipse cx="40" cy="52" rx="27" ry="21" fill="#FFB3C6" />
      <rect x="26" y="22" width="28" height="14" rx="7" fill="#FF8FA3" />
      <circle cx="40" cy="28" r="4" fill="#E05070" />
      <circle cx="31" cy="51" r="4.5" fill="white" />
      <circle cx="49" cy="51" r="4.5" fill="white" />
      <circle cx="32.5" cy="51" r="2.5" fill="#333" />
      <circle cx="50.5" cy="51" r="2.5" fill="#333" />
      <circle cx="33.5" cy="50" r="1" fill="white" />
      <circle cx="51.5" cy="50" r="1" fill="white" />
      <path d="M33 60 Q40 66 47 60" stroke="#E05070" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <ellipse cx="27" cy="55" rx="4" ry="2.5" fill="#FF6B8A" opacity="0.4" />
      <ellipse cx="53" cy="55" rx="4" ry="2.5" fill="#FF6B8A" opacity="0.4" />
    </svg>
  );
}

function StarBurst() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {['⭐','🌟','✨','🎊','🎉'].map((s, i) => (
        <span key={i} className="absolute text-2xl animate-ping" style={{
          top: `${10 + i * 18}%`, left: `${5 + i * 22}%`,
          animationDelay: `${i * 0.2}s`, animationDuration: '1.5s'
        }}>{s}</span>
      ))}
    </div>
  );
}

export default function App() {
  const [screen, setScreen]                     = useState<Screen>('budget');
  const [totalBudget, setTotalBudget]           = useState(0);
  const [budgetHistory, setBudgetHistory]       = useState<number[]>([]);
  const [recipients, setRecipients]             = useState<Recipient[]>(
    INIT_RECIPIENTS.map(r => ({ ...r, budget: 0, purchases: [], completed: false }))
  );
  const [selectedId, setSelectedId]             = useState<string>('1');
  const [currentId, setCurrentId]               = useState<string | null>(null);
  const [priceInput, setPriceInput]             = useState('');
  const [newName, setNewName]                   = useState('');
  const [showAddForm, setShowAddForm]           = useState(false);
  const [justAdded, setJustAdded]               = useState(false);

  // Drag state for budget screen
  const [drag, setDrag] = useState<{
    value: number; label: string; color: string; size: number; isBill: boolean;
    x: number; y: number;
  } | null>(null);
  const [overPurse, setOverPurse] = useState(false);
  const [dropFlash, setDropFlash] = useState(false);
  const purseRef = useRef<HTMLDivElement>(null);

  const onCoinDown = useCallback((
    e: React.PointerEvent,
    value: number, label: string, color: string, size: number, isBill: boolean
  ) => {
    e.preventDefault();
    setDrag({ value, label, color, size, isBill, x: e.clientX, y: e.clientY });
  }, []);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!drag) return;
    const x = e.clientX, y = e.clientY;
    setDrag(d => d ? { ...d, x, y } : null);
    if (purseRef.current) {
      const r = purseRef.current.getBoundingClientRect();
      setOverPurse(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
    }
  }, [drag]);

  const onDragEnd = useCallback(() => {
    if (!drag) return;
    if (overPurse) {
      setTotalBudget(p => p + drag.value);
      setBudgetHistory(p => [...p, drag.value]);
      setDropFlash(true);
      setTimeout(() => setDropFlash(false), 400);
    }
    setDrag(null);
    setOverPurse(false);
  }, [drag, overPurse]);

  const current        = recipients.find(r => r.id === currentId) ?? null;
  const selected       = recipients.find(r => r.id === selectedId);
  const pendingPrice   = Math.max(0, parseInt(priceInput, 10) || 0);
  const totalSpent     = (current?.purchases.reduce((a, b) => a + b, 0) ?? 0)
    + (screen === 'shopping' ? pendingPrice : 0);
  const remaining      = (current?.budget ?? 0) - totalSpent;
  const isOver         = remaining < 0;
  const totalCommitted = recipients.reduce((sum, recipient) => {
    const spent = recipient.purchases.reduce((purchaseSum, price) => purchaseSum + price, 0);
    return sum + (recipient.completed ? spent : recipient.budget);
  }, 0);
  const unallocated = totalBudget - totalCommitted;

  function addDenom(v: number) {
    setTotalBudget(p => p + v);
    setBudgetHistory(p => [...p, v]);
  }

  function removeLast() {
    if (!budgetHistory.length) return;
    const last = budgetHistory[budgetHistory.length - 1];
    setTotalBudget(p => p - last);
    setBudgetHistory(p => p.slice(0, -1));
  }

  function allocate(v: number) {
    if (unallocated < v) return;
    setRecipients(p => p.map(r => r.id === selectedId ? { ...r, budget: r.budget + v } : r));
  }

  function deallocate(v: number) {
    const r = recipients.find(r => r.id === selectedId);
    if (!r || r.budget < v) return;
    setRecipients(p => p.map(r => r.id === selectedId ? { ...r, budget: r.budget - v } : r));
  }

  function startShopping(id: string) {
    setCurrentId(id);
    setPriceInput('');
    setScreen('shopping');
  }

  function addPurchase() {
    const price = pendingPrice;
    if (price <= 0 || !currentId) return;
    setRecipients(p => p.map(r => r.id === currentId ? { ...r, purchases: [...r.purchases, price] } : r));
    setPriceInput('');
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 600);
  }

  function deletePurchase(i: number) {
    if (!currentId) return;
    setRecipients(p => p.map(r => r.id === currentId ? { ...r, purchases: r.purchases.filter((_, j) => j !== i) } : r));
  }

  function numpad(key: string) {
    if (key === '⌫') { setPriceInput(p => p.slice(0, -1)); return; }
    setPriceInput(p => {
      const next = p + key;
      return parseInt(next, 10) > 99999 ? p : next;
    });
  }

  function addRecipient() {
    if (!newName.trim()) return;
    const id = Date.now().toString();
    setRecipients(p => [...p, { id, name: newName.trim(), emoji: '😄', budget: 0, purchases: [], completed: false }]);
    setSelectedId(id);
    setNewName('');
    setShowAddForm(false);
  }

  function finishShopping() {
    addPurchase();
    if (currentId) {
      setRecipients(p => p.map(r => r.id === currentId ? { ...r, completed: true } : r));
    }
    setScreen('complete');
  }

  function resetAll() {
    setTotalBudget(0);
    setBudgetHistory([]);
    setRecipients(INIT_RECIPIENTS.map(r => ({ ...r, budget: 0, purchases: [], completed: false })));
    setCurrentId(null);
    setPriceInput('');
    setSelectedId('1');
    setScreen('budget');
  }

  // ── BUDGET SCREEN ──────────────────────────────────────────────────────────
  if (screen === 'budget') {
    const ALL_DENOMS = [
      { value: 10,   label: '10',   color: 'from-orange-400 to-orange-600', size: 70,  isBill: false },
      { value: 50,   label: '50',   color: 'from-yellow-300 to-yellow-500', size: 78,  isBill: false },
      { value: 100,  label: '100',  color: 'from-slate-300 to-slate-500',   size: 88,  isBill: false },
      { value: 500,  label: '500',  color: 'from-yellow-500 to-amber-600',  size: 96,  isBill: false },
      { value: 1000, label: '1000', color: 'from-green-400 to-green-600',   size: 110, isBill: true  },
    ];

    return (
      <div
        className="h-dvh w-full max-w-full bg-gradient-to-b from-sky-400 to-sky-200 flex flex-col select-none overflow-x-hidden overflow-y-auto overscroll-y-contain"
        style={{ touchAction: 'pan-y' }}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerLeave={onDragEnd}
      >
        {/* Title */}
        <div className="shrink-0 text-center pt-4 pb-1 px-4">
          <h1 className="text-4xl font-black text-white drop-shadow-md">あといくら？</h1>
          <p className="text-sky-100 text-sm font-bold">お買い物サポートアプリ</p>
        </div>

        {/* Purse drop zone */}
        <div className="shrink-0 flex flex-col items-center justify-center px-4 py-2">
          <div
            ref={purseRef}
            className={`relative mt-8 w-72 max-w-full min-h-52 rounded-t-xl rounded-b-3xl border-4 border-rose-400 px-4 pt-7 pb-5 text-center transition-all duration-150 ${
              overPurse
                ? 'bg-yellow-100 scale-105 shadow-2xl ring-4 ring-yellow-400'
                : dropFlash
                ? 'bg-rose-50 scale-105 shadow-xl'
                : 'bg-gradient-to-b from-rose-100 to-pink-200 shadow-xl'
            }`}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-3 -inset-x-1 h-4 rounded-full border-2 border-rose-300 bg-rose-500 before:absolute before:-top-6 before:left-1/2 before:h-7 before:w-7 before:-translate-x-full before:rounded-full before:border-4 before:border-amber-200 before:bg-amber-400 before:content-[''] after:absolute after:-top-6 after:left-1/2 after:h-7 after:w-7 after:rounded-full after:border-4 after:border-amber-200 after:bg-amber-400 after:content-['']"
            />
            <p className="text-rose-800 text-lg font-black mt-1">
              {overPurse ? 'ここで離してね！' : '使えるお金'}
            </p>
            <div className="flex items-baseline justify-center gap-1 mt-2">
              <span className={`text-5xl font-black tabular-nums transition-all ${
                dropFlash ? 'text-rose-600 scale-110' : 'text-rose-950'
              }`}>
                {totalBudget.toLocaleString()}
              </span>
              <span className="text-2xl font-bold text-rose-800">円</span>
            </div>
            {budgetHistory.length > 0 && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={removeLast}
                className="mt-3 text-sm text-rose-800 bg-white/70 border border-rose-300 rounded-full px-4 py-1 font-bold active:scale-95"
              >
                ⌫ 戻す
              </button>
            )}
          </div>

          <p className="text-sky-950 bg-white/90 rounded-2xl px-4 py-3 text-lg sm:text-xl font-black mt-4 text-center max-w-sm shadow-sm">
            {overPurse ? 'お財布の上で離してね！' : drag ? 'お財布まで動かしてね！' : 'お金を動かしてお財布に入れてね'}
          </p>
        </div>

        {/* Coin tray */}
        <div className="shrink-0 bg-white/20 rounded-t-3xl px-3 pt-3 pb-2">
          <div className="flex items-end justify-around mb-2">
            {ALL_DENOMS.filter(d => !d.isBill).map(d => (
              <div
                key={d.value}
                onPointerDown={e => onCoinDown(e, d.value, d.label, d.color, d.size, false)}
                className={`bg-gradient-to-b ${d.color} rounded-full flex flex-col items-center justify-center shadow-lg cursor-grab active:cursor-grabbing active:scale-95 transition-transform`}
                style={{ width: d.size, height: d.size, touchAction: 'none' }}
              >
                <span className="text-white font-black text-xl leading-none">{d.label}</span>
                <span className="text-white text-sm opacity-80">円</span>
              </div>
            ))}
          </div>
          {/* Bill */}
          <div
            onPointerDown={e => onCoinDown(e, 1000, '1000', 'from-green-400 to-green-600', 110, true)}
            className="w-full bg-gradient-to-r from-green-400 to-green-600 rounded-2xl py-4 flex items-center justify-center gap-3 shadow-lg cursor-grab active:cursor-grabbing active:scale-95 transition-transform mb-1"
            style={{ touchAction: 'none' }}
          >
            <span className="text-3xl">💴</span>
            <span className="text-white font-black text-2xl">1000円札</span>
          </div>
        </div>

        {/* Confirm button */}
        <div className="shrink-0 bg-white/20 px-4 pb-5 pt-8">
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={() => totalBudget > 0 && setScreen('allocate')}
            disabled={totalBudget === 0}
            className="w-full bg-gradient-to-b from-green-400 to-green-600 text-white text-2xl font-black py-4 rounded-3xl shadow-xl disabled:opacity-40 active:scale-95 transition-transform"
          >
            この金額で決める ✓
          </button>
        </div>

        {/* Dragged coin ghost */}
        {drag && (
          <div
            className="fixed pointer-events-none z-50 transition-transform"
            style={{
              left: drag.x - (drag.isBill ? 80 : drag.size / 2),
              top:  drag.y - (drag.isBill ? 24 : drag.size / 2),
              transform: 'scale(1.25)',
            }}
          >
            {drag.isBill ? (
              <div className={`bg-gradient-to-r ${drag.color} rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-2`}
                style={{ width: 160 }}>
                <span className="text-xl">💴</span>
                <span className="text-white font-black text-lg">1000円</span>
              </div>
            ) : (
              <div
                className={`bg-gradient-to-b ${drag.color} rounded-full flex flex-col items-center justify-center shadow-2xl`}
                style={{ width: drag.size, height: drag.size }}
              >
                <span className="text-white font-black text-base leading-none">{drag.label}</span>
                <span className="text-white text-xs opacity-80">円</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── ALLOCATE SCREEN ────────────────────────────────────────────────────────
  if (screen === 'allocate') return (
    <div className="h-dvh overflow-hidden bg-gradient-to-b from-pink-400 to-pink-200 flex flex-col p-4 pt-5">
      <div className="w-full max-w-md h-full min-h-0 mx-auto flex flex-col">

        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 mb-4">
          <button
            onClick={() => setScreen('budget')}
            className="bg-white/30 text-white font-black text-lg w-10 h-10 rounded-full flex items-center justify-center"
          >←</button>
          <h2 className="text-2xl font-black text-white drop-shadow">誰に、いくら使う？</h2>
        </div>

        {/* Budget summary */}
        <div className="shrink-0 bg-white rounded-2xl p-4 mb-4 flex flex-wrap gap-3 items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <PurseIcon size={48} />
            <div>
              <p className="text-base text-gray-500 font-bold">全体の予算</p>
              <p className="font-black text-2xl tabular-nums">{totalBudget.toLocaleString()}円</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-base text-gray-500 font-bold">残り</p>
            <p className={`font-black text-3xl tabular-nums ${
              unallocated === 0 ? 'text-green-500' : unallocated > 0 ? 'text-orange-500' : 'text-red-500'
            }`}>{unallocated.toLocaleString()}円</p>
          </div>
        </div>

        {/* Recipient cards */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar space-y-3 mb-2">
          {recipients.map(r => {
            const isSel = r.id === selectedId;
            return (
              <div
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`rounded-2xl p-4 shadow-sm cursor-pointer transition-all select-none ${
                  isSel ? 'bg-pink-500 ring-4 ring-white/60 scale-[1.02]' : 'bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="text-4xl">{r.emoji}</span>
                  <span className={`font-black text-xl flex-1 min-w-24 break-words ${isSel ? 'text-white' : 'text-gray-800'}`}>{r.name}</span>
                  <span className={`font-black text-2xl tabular-nums shrink-0 ${isSel ? 'text-white' : 'text-gray-800'}`}>
                    {r.budget.toLocaleString()}円
                  </span>
                  {r.budget > 0 && (r.completed ? (
                    <span className={`text-base font-black px-4 py-2 rounded-xl ml-auto shrink-0 ${
                      isSel ? 'bg-white/20 text-white' : 'bg-green-100 text-green-600'
                    }`}>
                      ✓ おわり
                    </span>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); startShopping(r.id); }}
                      className={`text-base font-black px-4 py-2 rounded-xl ml-auto shrink-0 ${
                        isSel ? 'bg-white text-pink-500' : 'bg-sky-400 text-white'
                      }`}
                    >
                      買い物へ →
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {showAddForm ? (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRecipient()}
                placeholder="名前を入れてね"
                className="w-full border-2 border-pink-300 rounded-xl p-3 text-lg font-bold mb-2 outline-none focus:border-pink-500"
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={addRecipient} className="flex-1 bg-pink-500 text-white font-black py-2 rounded-xl">追加</button>
                <button onClick={() => setShowAddForm(false)} className="flex-1 bg-gray-100 text-gray-500 font-bold py-2 rounded-xl">やめる</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full border-2 border-pink-600 bg-white text-pink-700 text-xl font-black py-4 rounded-2xl shadow-md hover:bg-pink-50 active:scale-95 transition-transform"
            >
              ＋ 新しく追加する
            </button>
          )}
        </div>

        {/* Coin allocation panel */}
        {selected && (
          <div className="shrink-0 bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xl text-gray-800 font-black text-center leading-relaxed mb-4">
              <span className="text-pink-600">{selected.name}</span> にお金を渡そう
              <br />お金をタップしてね
            </p>
            {/* Add coins */}
            <div className="grid grid-cols-4 gap-3 items-center mb-3">
              {[...COINS].reverse().map(c => (
                <button
                  key={c.value}
                  onClick={() => allocate(c.value)}
                  disabled={unallocated < c.value}
                  className={`bg-gradient-to-b ${c.color} ${c.value === 500 ? 'w-16 h-16' : c.value === 100 ? 'w-15 h-15' : c.value === 50 ? 'w-14 h-14' : 'w-13 h-13'} mx-auto text-white rounded-full shadow-md flex flex-col items-center justify-center cursor-pointer select-none touch-manipulation disabled:opacity-30 active:scale-90 transition-transform`}
                >
                  <span className="font-black text-lg leading-tight">{c.label}</span>
                  <span className="text-sm opacity-90 leading-tight">円</span>
                </button>
              ))}
              <button
                onClick={() => allocate(BILL.value)}
                disabled={unallocated < BILL.value}
                className={`bg-gradient-to-r ${BILL.color} col-span-4 w-full h-14 text-white rounded-xl shadow-md text-xl font-black cursor-pointer select-none touch-manipulation disabled:opacity-30 active:scale-90 transition-transform`}
              >1000円</button>
            </div>
            {/* Remove coins */}
            <div className="flex flex-wrap gap-2 justify-center">
              {[...COINS].reverse().map(c => (
                <button
                  key={c.value}
                  onClick={() => deallocate(c.value)}
                  disabled={!selected || selected.budget < c.value}
                  className="text-base text-red-500 border border-red-200 px-3 py-2 rounded-full disabled:opacity-30 active:scale-95 transition-transform font-bold"
                >
                  −{c.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── SHOPPING SCREEN ────────────────────────────────────────────────────────
  if (screen === 'shopping' && current) {
    const NUMPAD = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
    return (
      <div className="min-h-screen bg-sky-50 flex flex-col max-w-sm mx-auto">

        {/* Header */}
        <div className="bg-gradient-to-b from-sky-500 to-sky-400 pt-5 pb-8 px-4 text-center relative">
          <div className="flex items-center mb-3">
            <button onClick={() => { addPurchase(); setScreen('allocate'); }} className="text-white/80 font-bold text-sm">← 戻る</button>
            <h2 className="flex-1 text-lg font-black text-white">{current.emoji} {current.name}の買い物</h2>
          </div>
          <div className="bg-white/20 rounded-3xl px-4 py-3">
            <p className="text-sky-100 text-sm font-bold">残り</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className={`text-6xl font-black tabular-nums ${isOver ? 'text-red-300' : 'text-white'}`}>
                {isOver ? '-' : ''}{Math.abs(remaining).toLocaleString()}
              </span>
              <span className="text-2xl text-white/70 font-bold">円</span>
            </div>
          </div>
        </div>

        {/* Budget / Spent summary pill */}
        <div className="mx-4 -mt-4 bg-white rounded-2xl shadow p-3 grid grid-cols-2 gap-2 mb-3 z-10">
          <div className="bg-sky-50 rounded-xl p-2 text-center">
            <p className="text-xs text-gray-400 font-bold">予算</p>
            <p className="font-black text-lg tabular-nums">{current.budget.toLocaleString()}円</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-2 text-center">
            <p className="text-xs text-gray-400 font-bold">使った金額</p>
            <p className="font-black text-lg tabular-nums text-orange-500">{totalSpent.toLocaleString()}円</p>
          </div>
        </div>

        {/* Over-budget warning */}
        {isOver && (
          <div className="mx-4 mb-3 bg-red-100 border-2 border-red-400 rounded-2xl p-3 text-center">
            <p className="text-red-600 font-black text-base">
              ⚠️ 予算を{Math.abs(remaining).toLocaleString()}円オーバーしているよ！
            </p>
            <p className="text-red-400 text-sm font-bold mt-1">少し戻すか、安い物を探してね</p>
          </div>
        )}

        {/* Purchase history */}
        {current.purchases.length > 0 && (
          <div className="mx-4 mb-3 bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs text-gray-400 font-black mb-2">買った物（{current.purchases.length}件）</p>
            <div className="space-y-1 max-h-36 overflow-y-auto no-scrollbar">
              {current.purchases.map((price, i) => (
                <div key={i} className={`flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0 ${justAdded && i === current.purchases.length - 1 ? 'animate-bounce-in' : ''}`}>
                  <span className="font-black text-xl tabular-nums text-gray-800">{price.toLocaleString()}円</span>
                  <button
                    onClick={() => deletePurchase(i)}
                    className="text-red-300 hover:text-red-500 text-2xl active:scale-90 transition-all"
                    aria-label="削除"
                  >🗑</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Numpad input */}
        <div className="mx-4 bg-white rounded-2xl shadow-sm p-4 mb-3">
          <p className="text-xs text-gray-400 font-black mb-2">いくらでしたか？（税込）<br />入れた金額はすぐに計算されるよ</p>
          <div className="flex items-baseline justify-end gap-1 bg-gray-50 rounded-xl px-4 py-3 mb-3">
            <span className="text-4xl font-black text-gray-800 tabular-nums flex-1 text-right">
              {priceInput || '0'}
            </span>
            <span className="text-lg text-gray-400 font-bold">円</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {NUMPAD.map((key, i) => (
              key === '' ? <div key={i} /> : (
                <button
                  key={i}
                  onClick={() => numpad(key)}
                  className={`rounded-2xl py-4 text-2xl font-black active:scale-95 transition-transform ${
                    key === '⌫'
                      ? 'bg-red-100 text-red-500'
                      : 'bg-sky-50 text-gray-700 hover:bg-sky-100'
                  }`}
                >
                  {key}
                </button>
              )
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mx-4 pb-5 space-y-2">
          <button
            onClick={addPurchase}
            disabled={pendingPrice <= 0}
            className="w-full bg-gradient-to-b from-sky-400 to-sky-600 text-white text-xl font-black py-4 rounded-2xl shadow-lg disabled:opacity-40 active:scale-95 transition-transform"
          >
            次の商品を入れる
          </button>
          <button
            onClick={finishShopping}
            className="w-full bg-gradient-to-b from-orange-400 to-orange-500 text-white text-xl font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-transform"
          >
            終わる 🎉
          </button>
        </div>
      </div>
    );
  }

  // ── COMPLETE SCREEN ────────────────────────────────────────────────────────
  if (screen === 'complete' && current) {
    const finalSpent = current.purchases.reduce((a, b) => a + b, 0);
    const finalRem   = current.budget - finalSpent;
    const success    = finalRem >= 0;
    const hasOtherUnfinishedRecipient = recipients.some(
      r => r.id !== current.id && r.budget > 0 && !r.completed
    );

    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden ${
        success
          ? 'bg-gradient-to-b from-yellow-300 to-amber-200'
          : 'bg-gradient-to-b from-pink-300 to-rose-200'
      }`}>
        {success && <StarBurst />}
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 text-center relative z-10">
          <div className="text-7xl mb-3 animate-bounce-in">{success ? '🎉' : '😅'}</div>
          <div className="flex justify-center">
            <PurseIcon size={96} animated={success} />
          </div>
          <h2 className="text-4xl leading-snug font-black text-gray-800 mt-4 mb-2">
            {success ? 'お買い物できたね！' : '頑張ったね！'}
          </h2>
          <p className={`text-xl font-black leading-relaxed mb-6 ${success ? 'text-yellow-500' : 'text-orange-400'}`}>
            {success
              ? '予算の中でお買い物できたよ！🌟'
              : '次は予算内で試してみよう！'}
          </p>

          <div className={`rounded-2xl p-4 sm:p-5 mb-6 text-left space-y-4 ${success ? 'bg-yellow-50' : 'bg-pink-50'}`}>
            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-between items-center">
              <span className="text-lg text-gray-500 font-bold">{current.name}の予算</span>
              <span className="font-black text-2xl tabular-nums">{current.budget.toLocaleString()}円</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-between items-center">
              <span className="text-lg text-gray-500 font-bold">使った金額</span>
              <span className="font-black text-2xl tabular-nums text-orange-500">{finalSpent.toLocaleString()}円</span>
            </div>
            <div className="border-t border-gray-200 pt-4 flex flex-wrap gap-x-3 gap-y-1 justify-between items-center">
              <span className="text-xl text-gray-600 font-black">残り</span>
              <span className={`font-black text-3xl sm:text-4xl tabular-nums ${success ? 'text-green-600' : 'text-red-500'}`}>
                {success ? '' : '-'}{Math.abs(finalRem).toLocaleString()}円
                {!success && <span className="text-base ml-1">オーバー</span>}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {hasOtherUnfinishedRecipient && (
              <button
                onClick={() => setScreen('allocate')}
                className="flex-1 min-w-28 bg-gray-100 text-gray-700 text-lg sm:text-xl font-black py-4 rounded-2xl active:scale-95 transition-transform"
              >
                ほかの人の買い物へ
              </button>
            )}
            <button
              onClick={() => setScreen('summary')}
              className="flex-1 min-w-28 bg-gradient-to-b from-sky-400 to-sky-600 text-white text-lg sm:text-xl font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-transform"
            >
              買い物を終える
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── OVERALL SUMMARY SCREEN ─────────────────────────────────────────────────
  if (screen === 'summary') {
    const overallSpent = recipients.reduce(
      (sum, recipient) => sum + recipient.purchases.reduce((purchaseSum, price) => purchaseSum + price, 0),
      0
    );
    const overallRemaining = totalBudget - overallSpent;
    const overallSuccess = overallRemaining >= 0;

    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden ${
        overallSuccess
          ? 'bg-gradient-to-b from-yellow-300 to-amber-200'
          : 'bg-gradient-to-b from-pink-300 to-rose-200'
      }`}>
        {overallSuccess && <StarBurst />}
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 text-center relative z-10">
          <div className="text-7xl mb-3 animate-bounce-in">{overallSuccess ? '🎉' : '😅'}</div>
          <div className="flex justify-center">
            <PurseIcon size={96} animated={overallSuccess} />
          </div>
          <h2 className="text-4xl leading-snug font-black text-gray-800 mt-4 mb-2">
            お買い物の結果
          </h2>
          <p className={`text-xl font-black leading-relaxed mb-6 ${
            overallSuccess ? 'text-yellow-500' : 'text-orange-400'
          }`}>
            {overallSuccess ? 'みんなのお買い物ができたね！🌟' : '次は予算内で試してみよう！'}
          </p>

          <div className={`rounded-2xl p-4 sm:p-5 mb-6 text-left space-y-4 ${
            overallSuccess ? 'bg-yellow-50' : 'bg-pink-50'
          }`}>
            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-between items-center">
              <span className="text-lg text-gray-500 font-bold">全体予算</span>
              <span className="font-black text-2xl tabular-nums">{totalBudget.toLocaleString()}円</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-between items-center">
              <span className="text-lg text-gray-500 font-bold">使った合計金額</span>
              <span className="font-black text-2xl tabular-nums text-orange-500">
                {overallSpent.toLocaleString()}円
              </span>
            </div>
            <div className="border-t border-gray-200 pt-4 flex flex-wrap gap-x-3 gap-y-1 justify-between items-center">
              <span className="text-xl text-gray-600 font-black">残り金額</span>
              <span className={`font-black text-3xl sm:text-4xl tabular-nums ${
                overallSuccess ? 'text-green-600' : 'text-red-500'
              }`}>
                {overallSuccess ? '' : '-'}{Math.abs(overallRemaining).toLocaleString()}円
                {!overallSuccess && <span className="text-base ml-1">オーバー</span>}
              </span>
            </div>
          </div>

          <button
            onClick={resetAll}
            className="w-full bg-gradient-to-b from-sky-400 to-sky-600 text-white text-lg sm:text-xl font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-transform"
          >
            最初に戻る
          </button>
        </div>
      </div>
    );
  }

  return null;
}
