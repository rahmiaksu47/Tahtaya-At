import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { 
  Timer, 
  Dices, 
  Users, 
  Play, 
  Pause, 
  RotateCcw, 
  X, 
  EyeOff, 
  Sparkles, 
  Plus, 
  Trash2,
  Hash,
  ListFilter
} from 'lucide-react';
import { sounds } from '../utils/audio';

const DEFAULT_STUDENTS = [
  'Ahmet Yılmaz', 'Ayşe Demir', 'Mehmet Kaya', 'Zeynep Çelik', 
  'Can Yıldız', 'Elif Şahin', 'Burak Aydın', 'Fatma Koç', 
  'Emre Arslan', 'Büşra Doğan', 'Deniz Aksoy', 'Gamze Öztürk', 
  'Mustafa Kurt', 'Ece Güler', 'Yusuf Yavuz', 'Selin Polat'
];

interface ClassroomWidgetsProps {
  timerState: {
    isRunning: boolean;
    timeLeft: number;
    initialTime: number;
  };
  onTimerChange: (action: 'start' | 'pause' | 'reset' | 'set', seconds?: number) => void;
  diceState: {
    rolling: boolean;
    values: number[];
  };
  onRollDice: (count: number) => void;
  pickedStudent: string | null;
  pickedNumber?: number | null;
  onPickStudent: (name?: string, num?: number) => void;
  isBlackout: boolean;
  onToggleBlackout: (val?: boolean) => void;
  activeWidget: 'none' | 'timer' | 'dice' | 'picker';
  setActiveWidget: (w: 'none' | 'timer' | 'dice' | 'picker') => void;
}

export const ClassroomWidgets: React.FC<ClassroomWidgetsProps> = ({
  timerState,
  onTimerChange,
  diceState,
  onRollDice,
  pickedStudent,
  pickedNumber,
  onPickStudent,
  isBlackout,
  onToggleBlackout,
  activeWidget,
  setActiveWidget,
}) => {
  // Default is 'number' (1-30)
  const [pickerMode, setPickerMode] = useState<'number' | 'roster'>('number');
  const [minNum] = useState<number>(1);
  const [maxNum, setMaxNum] = useState<number>(30);
  const [avoidRepeats, setAvoidRepeats] = useState<boolean>(true);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [activeNumberWinner, setActiveNumberWinner] = useState<number | null>(null);

  const [studentList, setStudentList] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('tahta_students');
        if (saved) return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return DEFAULT_STUDENTS;
  });

  const [newStudentInput, setNewStudentInput] = useState('');
  const [isEditingRoster, setIsEditingRoster] = useState(false);
  const [cyclingName, setCyclingName] = useState<string | null>(null);
  const [cyclingNumber, setCyclingNumber] = useState<number | null>(null);
  const [isPickerSpinning, setIsPickerSpinning] = useState(false);

  const saveRoster = (list: string[]) => {
    setStudentList(list);
    try {
      localStorage.setItem('tahta_students', JSON.stringify(list));
    } catch {
      // safe catch
    }
  };

  const handleAddStudent = () => {
    if (!newStudentInput.trim()) return;
    const updated = [...studentList, newStudentInput.trim()];
    saveRoster(updated);
    setNewStudentInput('');
  };

  const handleRemoveStudent = (index: number) => {
    const updated = studentList.filter((_, i) => i !== index);
    saveRoster(updated);
  };

  const startNumberLottery = useCallback((customMax?: number) => {
    const targetMax = customMax || maxNum;
    const available: number[] = [];
    for (let i = minNum; i <= targetMax; i++) {
      if (!avoidRepeats || !drawnNumbers.includes(i)) {
        available.push(i);
      }
    }

    if (available.length === 0) {
      setDrawnNumbers([]);
      for (let i = minNum; i <= targetMax; i++) {
        available.push(i);
      }
    }

    setIsPickerSpinning(true);
    let counter = 0;
    const totalSteps = 24;
    sounds.playDiceRoll();

    const interval = setInterval(() => {
      counter++;
      const randomCandidate = Math.floor(Math.random() * (targetMax - minNum + 1)) + minNum;
      setCyclingNumber(randomCandidate);

      if (counter >= totalSteps) {
        clearInterval(interval);
        const finalWinner = available[Math.floor(Math.random() * available.length)];
        setCyclingNumber(finalWinner);
        setActiveNumberWinner(finalWinner);
        setDrawnNumbers((prev) => [...prev, finalWinner]);
        setIsPickerSpinning(false);
        onPickStudent(undefined, finalWinner);
        sounds.playFanfare();
        confetti({
          particleCount: 110,
          spread: 80,
          origin: { y: 0.6 },
        });
      }
    }, 75);
  }, [minNum, maxNum, avoidRepeats, drawnNumbers, onPickStudent]);

  const startStudentLottery = useCallback(() => {
    if (studentList.length === 0) return;
    setIsPickerSpinning(true);
    let counter = 0;
    const totalSteps = 22;
    sounds.playDiceRoll();

    const interval = setInterval(() => {
      counter++;
      const randomCandidate = studentList[Math.floor(Math.random() * studentList.length)];
      setCyclingName(randomCandidate);

      if (counter >= totalSteps) {
        clearInterval(interval);
        const finalWinner = studentList[Math.floor(Math.random() * studentList.length)];
        setCyclingName(finalWinner);
        setIsPickerSpinning(false);
        onPickStudent(finalWinner, undefined);
        sounds.playFanfare();
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    }, 85);
  }, [studentList, onPickStudent]);

  useEffect(() => {
    if (typeof pickedNumber === 'number' && !isPickerSpinning) {
      setPickerMode('number');
      setCyclingNumber(pickedNumber);
      setActiveNumberWinner(pickedNumber);
      setDrawnNumbers((prev) => (prev.includes(pickedNumber) ? prev : [...prev, pickedNumber]));
      sounds.playFanfare();
      confetti({
        particleCount: 100,
        spread: 75,
        origin: { y: 0.6 },
      });
    } else if (pickedStudent && !isPickerSpinning) {
      setPickerMode('roster');
      setCyclingName(pickedStudent);
      sounds.playFanfare();
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  }, [pickedStudent, pickedNumber, isPickerSpinning]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const timerProgress = timerState.initialTime > 0 
    ? (timerState.timeLeft / timerState.initialTime) 
    : 0;

  return (
    <>
      {/* 1. BLACKOUT / ATTENTION CURTAIN OVERLAY */}
      {isBlackout && (
        <div 
          onClick={() => onToggleBlackout(false)}
          className="fixed inset-0 z-[100] bg-slate-950/98 backdrop-blur-xl flex flex-col items-center justify-center text-center p-8 cursor-pointer select-none animate-in fade-in duration-300"
        >
          <div className="w-24 h-24 rounded-full bg-indigo-500/10 border-2 border-indigo-500/30 flex items-center justify-center mb-6 animate-pulse">
            <EyeOff className="w-12 h-12 text-indigo-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
            Öğretmeninize Odaklanın
          </h2>
          <p className="text-slate-400 text-sm max-w-md mb-8">
            Ders anlatımı için tahta karartıldı. Tahtaya veya kumandadaki butona dokunarak ekranı tekrar açabilirsiniz.
          </p>
          <span className="text-xs font-semibold px-4 py-2 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            Ekranı Açmak İçin Dokunun
          </span>
        </div>
      )}

      {/* 2. FLOATING TIMER WIDGET */}
      {activeWidget === 'timer' && (
        <div className="fixed top-16 left-6 z-40 bg-white/95 dark:bg-[#0b1a2d]/95 border border-slate-200 dark:border-[#193654] rounded-2xl p-5 shadow-2xl backdrop-blur-md w-80 animate-in slide-in-from-left duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#193654] mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#0284c7]/15 text-[#0284c7] dark:text-[#38bdf8]">
                <Timer className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Soru Süresi
              </span>
            </div>
            <button
              onClick={() => setActiveWidget('none')}
              className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col items-center my-2">
            <span className={`text-5xl font-mono font-black tracking-wider transition-colors ${
              timerState.timeLeft <= 10 && timerState.timeLeft > 0 
                ? 'text-rose-500 animate-pulse' 
                : timerState.isRunning 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-slate-900 dark:text-white'
            }`}>
              {formatTime(timerState.timeLeft)}
            </span>

            <div className="w-full h-2 bg-slate-100 dark:bg-[#071322] rounded-full overflow-hidden mt-3 border border-slate-200 dark:border-[#193654]">
              <div
                className={`h-full transition-all duration-300 ${
                  timerState.timeLeft <= 10 ? 'bg-rose-500' : 'bg-gradient-to-r from-[#0284c7] to-emerald-500'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, timerProgress * 100))}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5 my-3 text-xs">
            {[30, 60, 120, 300].map((sec) => (
              <button
                key={sec}
                onClick={() => onTimerChange('set', sec)}
                className="py-1.5 rounded-lg bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] text-slate-700 dark:text-slate-200 font-semibold border border-slate-200 dark:border-[#193654] transition-colors"
              >
                {sec < 60 ? `${sec}sn` : `${sec / 60}dk`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-[#193654]">
            <button
              onClick={() => onTimerChange(timerState.isRunning ? 'pause' : 'start')}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                timerState.isRunning
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {timerState.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{timerState.isRunning ? 'Duraklat' : 'Başlat'}</span>
            </button>
            <button
              onClick={() => onTimerChange('reset')}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#193654] transition-colors"
              title="Sıfırla"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. FLOATING DICE ROLLER WIDGET */}
      {activeWidget === 'dice' && (
        <div className="fixed top-16 left-6 z-40 bg-white/95 dark:bg-[#0b1a2d]/95 border border-slate-200 dark:border-[#193654] rounded-2xl p-5 shadow-2xl backdrop-blur-md w-80 animate-in slide-in-from-left duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#193654] mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Dices className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Akıllı Zar
              </span>
            </div>
            <button
              onClick={() => setActiveWidget('none')}
              className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-5 my-5">
            {diceState.values.map((val, idx) => (
              <div
                key={idx}
                className={`w-20 h-20 rounded-2xl bg-slate-50 dark:bg-white text-slate-900 border-2 border-slate-300 shadow-lg flex items-center justify-center text-4xl font-black font-mono transition-transform duration-200 ${
                  diceState.rolling ? 'animate-bounce scale-95 rotate-12' : 'hover:scale-105'
                }`}
              >
                {val}
              </div>
            ))}
          </div>

          <div className="text-center mb-4">
            <span className="text-xs text-slate-500 dark:text-slate-400">Toplam: </span>
            <span className="text-lg font-bold text-amber-600 dark:text-amber-400 font-mono">
              {diceState.values.reduce((a, b) => a + b, 0)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200 dark:border-[#193654]">
            <button
              onClick={() => onRollDice(1)}
              disabled={diceState.rolling}
              className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-xs text-slate-950 shadow-xs transition-all active:scale-95 disabled:opacity-50"
            >
              1 Zar At
            </button>
            <button
              onClick={() => onRollDice(2)}
              disabled={diceState.rolling}
              className="py-2.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] font-bold text-xs text-white shadow-xs transition-all active:scale-95 disabled:opacity-50"
            >
              2 Zar At
            </button>
          </div>
        </div>
      )}

      {/* 4. RANDOM STUDENT PICKER (1-30 NUMARA SEÇİCİ & İSİM LİSTESİ) */}
      {activeWidget === 'picker' && (
        <div className="fixed top-16 left-6 z-40 bg-white/98 dark:bg-[#0b1a2d]/98 border border-slate-200 dark:border-[#193654] rounded-2xl p-5 shadow-2xl backdrop-blur-md w-92 animate-in slide-in-from-left duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#193654] mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                  Şanslı Öğrenci
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  {pickerMode === 'number' ? `1 - ${maxNum} Numara Kurası` : 'Sınıf İsim Kurası'}
                </span>
              </div>
            </div>
            
            <button
              onClick={() => setActiveWidget('none')}
              className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-[#071322] rounded-xl mb-3 border border-slate-200 dark:border-[#193654]">
            <button
              onClick={() => {
                setPickerMode('number');
                setIsEditingRoster(false);
              }}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                pickerMode === 'number'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              <span>1 - {maxNum} Numara</span>
            </button>
            <button
              onClick={() => setPickerMode('roster')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                pickerMode === 'roster'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>İsim Listesi</span>
            </button>
          </div>

          {pickerMode === 'number' && (
            <div className="flex flex-col gap-3">
              <div className="w-full h-32 rounded-2xl bg-slate-50 dark:bg-[#071322] border-2 border-emerald-500/40 flex flex-col items-center justify-center p-3 text-center shadow-inner relative overflow-hidden">
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mb-1">
                  {isPickerSpinning ? 'Numara Çekiliyor...' : 'Şanslı Numara'}
                </span>
                <span className={`text-6xl font-mono font-black tracking-tight transition-all duration-75 ${
                  isPickerSpinning ? 'text-amber-500 scale-110 animate-pulse' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {cyclingNumber !== null ? cyclingNumber : activeNumberWinner !== null ? activeNumberWinner : '??'}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  {cyclingNumber !== null ? `Öğrenci No: ${cyclingNumber}` : `1'den ${maxNum}'a kadar kura`}
                </span>
              </div>

              <div className="flex items-center justify-between gap-1 text-[11px] bg-slate-100 dark:bg-[#071322] p-2 rounded-xl border border-slate-200 dark:border-[#193654]">
                <span className="text-slate-600 dark:text-slate-400 font-semibold pl-1">Sınıf Mevcudu:</span>
                <div className="flex items-center gap-1">
                  {[20, 25, 30, 35, 40].map((size) => (
                    <button
                      key={size}
                      onClick={() => setMaxNum(size)}
                      className={`px-2 py-1 rounded-lg font-bold transition-all ${
                        maxNum === size
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white dark:bg-[#10243b] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#193654]'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs px-1 text-slate-700 dark:text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={avoidRepeats}
                    onChange={(e) => setAvoidRepeats(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Aynı numara tekrar çıkmasın</span>
                </label>
                {drawnNumbers.length > 0 && (
                  <button
                    onClick={() => {
                      setDrawnNumbers([]);
                      setActiveNumberWinner(null);
                      setCyclingNumber(null);
                    }}
                    className="text-[10px] text-rose-500 hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Sıfırla</span>
                  </button>
                )}
              </div>

              {drawnNumbers.length > 0 && (
                <div className="bg-slate-50 dark:bg-[#071322] p-2 rounded-xl border border-slate-200 dark:border-[#193654] text-xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">
                    Çıkan Numaralar ({drawnNumbers.length}/{maxNum}):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                    {drawnNumbers.map((num, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-white dark:bg-[#10243b] text-emerald-600 dark:text-emerald-300 font-mono font-bold text-[11px] border border-slate-200 dark:border-[#193654]"
                      >
                        {num}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => startNumberLottery()}
                disabled={isPickerSpinning}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isPickerSpinning ? 'Kura Çekiliyor...' : `1 - ${maxNum} Numara Kurası Çek`}</span>
              </button>
            </div>
          )}

          {pickerMode === 'roster' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {studentList.length} Öğrenci Kayıtlı
                </span>
                <button
                  onClick={() => setIsEditingRoster((prev) => !prev)}
                  className="text-[11px] px-2 py-1 rounded bg-slate-100 dark:bg-[#10243b] text-slate-700 dark:text-slate-300 font-medium border border-slate-200 dark:border-[#193654]"
                >
                  {isEditingRoster ? 'Kura Ekranı' : 'Listeyi Düzenle'}
                </button>
              </div>

              {!isEditingRoster ? (
                <>
                  <div className="w-full h-28 rounded-2xl bg-slate-50 dark:bg-[#071322] border-2 border-emerald-500/40 flex items-center justify-center p-3 text-center shadow-inner relative overflow-hidden">
                    <span className={`text-xl font-bold tracking-tight transition-all duration-100 ${
                      isPickerSpinning ? 'text-amber-500 scale-105' : 'text-emerald-600 dark:text-emerald-400 font-black'
                    }`}>
                      {cyclingName || 'Öğrenci Seçmek İçin Basın'}
                    </span>
                  </div>

                  <button
                    onClick={startStudentLottery}
                    disabled={isPickerSpinning || studentList.length === 0}
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isPickerSpinning ? 'Seçiliyor...' : 'İsim Kurası Çek'}</span>
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                  <div className="flex gap-1.5 mb-1">
                    <input
                      type="text"
                      value={newStudentInput}
                      onChange={(e) => setNewStudentInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()}
                      placeholder="Öğrenci Adı Soyadı..."
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#071322] border border-slate-200 dark:border-[#193654] text-xs text-slate-900 dark:text-white"
                    />
                    <button
                      onClick={handleAddStudent}
                      className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {studentList.map((st, i) => (
                      <div key={i} className="flex items-center justify-between px-2.5 py-1 rounded bg-slate-100 dark:bg-[#10243b] text-xs text-slate-800 dark:text-slate-200">
                        <span>{st}</span>
                        <button
                          onClick={() => handleRemoveStudent(i)}
                          className="text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};
