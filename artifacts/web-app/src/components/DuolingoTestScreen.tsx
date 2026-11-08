import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { get, ref } from 'firebase/database';
import { db } from '@/firebase';

interface DuolingoTestScreenProps {
  testPath: string;
  testTitle?: string;
  onBack: () => void;
  onComplete?: (score: number, total: number) => void;
}

export const DuolingoTestScreen: React.FC<DuolingoTestScreenProps> = ({ testPath, testTitle, onBack, onComplete }) => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [sessionCoins, setSessionCoins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(15);
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [splashAnim, setSplashAnim] = useState<{ text: string; type: 'win' | 'loss' } | null>(null);

  // Specific & Direct Question Text Extractor
  const getQuestionText = (q: any): string => {
    if (!q) return "Question text unavailable";
    if (lang === 'hi' && (q.hindi || q.hi?.question)) {
      return q.hindi || q.hi?.question;
    }
    return q.question || q.english || q.en?.question || q.text || q.title || q.que || Object.values(q).find(v => typeof v === 'string' && v.length > 5) || "Question text unavailable";
  };

  // Specific & Direct Options Extractor
  const getOptions = (q: any): string[] => {
    if (!q) return [];
    let opts = lang === 'hi' 
      ? (q.hindiOptions || q.hi?.options || q.options)
      : (q.options || q.en?.options || q.choices || q.optionList);

    if (Array.isArray(opts)) return opts.filter(Boolean);
    if (opts && typeof opts === 'object') return Object.values(opts).filter(Boolean);
    
    // Fallback: search any array inside the question object
    const foundArray = Object.values(q).find(val => Array.isArray(val) && val.length >= 2);
    if (foundArray) return foundArray as string[];

    return ["Option A", "Option B", "Option C", "Option D"];
  };

  // Specific & Direct Correct Answer Index Finder
  const getCorrectIndex = (q: any): number => {
    if (!q) return 0;
    if (typeof q.correctOptionIndex === 'number') return q.correctOptionIndex;
    if (typeof q.answerIndex === 'number') return q.answerIndex;
    if (typeof q.correctAnswer === 'number') return q.correctAnswer;
    if (typeof q.correctIndex === 'number') return q.correctIndex;
    
    if (typeof q.correctAnswer === 'string') {
      const parsed = parseInt(q.correctAnswer, 10);
      if (!isNaN(parsed)) return parsed;
      const opts = getOptions(q);
      const matchedIdx = opts.findIndex(o => o.toString().trim().toLowerCase() === q.correctAnswer.toString().trim().toLowerCase());
      if (matchedIdx !== -1) return matchedIdx;
    }
    return 0; // Default to first option if not specified
  };

  const playSound = (type: 'win' | 'loss') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (type === 'win') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.setValueAtTime(90, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      console.error("Audio playback error:", e);
    }
  };

  const syncShikenCoins = (delta: number) => {
    try {
      const stored = localStorage.getItem("shiken_coins");
      const current = stored ? parseInt(stored, 10) : 100;
      const updated = Math.max(0, current + delta);
      localStorage.setItem("shiken_coins", String(updated));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {
      console.error("Coin sync error:", e);
    }
  };

  // Direct Fetching without aggressive filtering
  useEffect(() => {
    let isMounted = true;
    const fetchQuestions = async () => {
      try {
        const snapshot = await get(ref(db, testPath));
        if (snapshot.exists() && isMounted) {
          const data = snapshot.val();
          
          let rawList: any[] = [];
          if (Array.isArray(data)) {
            rawList = data.filter(Boolean);
          } else if (data && typeof data === 'object') {
            rawList = Object.values(data).flatMap(item => {
              if (item && typeof item === 'object' && !Array.isArray(item)) {
                // If container has sub-items, take them
                if (!item.question && !item.options && !item.choices) {
                  return Object.values(item);
                }
              }
              return item;
            }).filter(Boolean);
          }

          // Fallback if list is empty, wrap data itself
          if (rawList.length === 0 && data) {
            rawList = [data];
          }

          const shuffled = rawList.sort(() => Math.random() - 0.5);
          setQuestions(shuffled);
        }
      } catch (error) {
        console.error("Error fetching test questions:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchQuestions();
    return () => { isMounted = false; };
  }, [testPath]);

  useEffect(() => {
    if (loading || questions.length === 0 || selectedOption !== null) return;

    setTimeLeft(15);
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, loading, questions.length, selectedOption]);

  const handleOptionClick = (index: number) => {
    if (selectedOption !== null) return;

    setSelectedOption(index);
    const currentQ = questions[currentIndex];
    const correctIdx = getCorrectIndex(currentQ);
    const correct = index === correctIdx;

    setIsAnswerCorrect(correct);
    if (correct) {
      setScore((prev) => prev + 1);
      setSessionCoins((prev) => prev + 4);
      syncShikenCoins(4);
      setSplashAnim({ text: "+4 🪙", type: 'win' });
      playSound('win');
    } else {
      setSessionCoins((prev) => Math.max(0, prev - 2));
      syncShikenCoins(-2);
      setSplashAnim({ text: "-2 🪙", type: 'loss' });
      playSound('loss');
    }

    setTimeout(() => setSplashAnim(null), 1200);
  };

  const handleNext = () => {
    setSelectedOption(null);
    setIsAnswerCorrect(null);
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      if (onComplete) onComplete(score, questions.length);
      onBack();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-800">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-emerald-500 mb-3"
        />
        <p className="text-sm text-slate-500 font-semibold">Loading questions...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-800 p-4 text-center">
        <p className="text-lg font-bold mb-2">No questions available</p>
        <button onClick={onBack} className="px-6 py-3 bg-emerald-500 text-white font-bold rounded-2xl shadow-md hover:bg-emerald-600 transition-all">
          Go Back
        </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const questionText = getQuestionText(currentQ);
  const optionsList = getOptions(currentQ);
  const correctIdx = getCorrectIndex(currentQ);
  const progressPercent = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-4 font-sans select-none relative overflow-hidden">
      
      {/* Coin Splash Floating Animation */}
      <AnimatePresence>
        {splashAnim && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1.3, y: -40 }}
            exit={{ opacity: 0, scale: 0.8, y: -80 }}
            className={`absolute top-20 right-10 z-50 px-4 py-2 rounded-2xl font-black text-xl shadow-2xl flex items-center gap-1 ${
              splashAnim.type === 'win' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
            }`}
          >
            {splashAnim.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between mb-3 pt-2 gap-2">
          <button onClick={onBack} className="text-slate-400 hover:text-slate-700 text-xl font-bold transition-colors">
            ✕
          </button>
          
          <button 
            onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
            className="px-2.5 py-1 text-xs font-bold rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors border border-slate-300"
          >
            {lang === 'en' ? '🇮🇳 हिंदी' : '🇬🇧 English'}
          </button>

          <div className="text-xs font-black text-amber-600 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20 flex items-center gap-1 shadow-sm">
            🪙 <span>{sessionCoins}</span>
          </div>

          <div className="flex-1 mx-2 h-3.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <motion.div
              className="h-full bg-emerald-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className="relative w-9 h-9 flex items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-50 font-black text-xs text-emerald-600 shrink-0 shadow-sm">
            {timeLeft}s
          </div>
        </div>
        {testTitle && <p className="text-center text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">{testTitle}</p>}
      </div>

      {/* Center Content: Mascot & Question */}
      <div className="flex-1 flex flex-col justify-center py-3">
        <div className="flex items-start space-x-3 mb-6">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center text-3xl shrink-0 shadow-md">
            🦉
          </div>
          <div className="flex-1 bg-white border-2 border-slate-200 p-5 rounded-3xl text-slate-900 text-base font-bold leading-relaxed shadow-sm">
            {questionText}
          </div>
        </div>

        {currentQ?.svg && (
          <div className="mb-5 flex justify-center bg-white p-3 rounded-2xl border border-slate-200 shadow-sm" dangerouslySetInnerHTML={{ __html: currentQ.svg }} />
        )}

        {/* Options Cards */}
        <div className="space-y-3">
          {optionsList.map((option: string, idx: number) => {
            let optionStyle = "bg-white border-2 border-slate-200 text-slate-800 hover:bg-slate-100 hover:border-slate-300 shadow-sm";
            if (selectedOption !== null) {
              if (idx === correctIdx) {
                optionStyle = "bg-emerald-100 border-2 border-emerald-500 text-emerald-900 shadow-sm";
              } else if (idx === selectedOption) {
                optionStyle = "bg-rose-100 border-2 border-rose-500 text-rose-900 shadow-sm";
              } else {
                optionStyle = "bg-slate-100 border-2 border-slate-200 opacity-40 text-slate-400";
              }
            }

            return (
              <motion.button
                key={idx}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleOptionClick(idx)}
                disabled={selectedOption !== null}
                className={`w-full p-4 rounded-2xl text-left font-bold transition-all flex items-center gap-3 ${optionStyle}`}
              >
                <span className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center text-xs font-black text-slate-600 shrink-0">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1 text-sm">{option}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Bottom Feedback & Continue Button (No Step-by-Step Explanation) */}
      <AnimatePresence>
        {selectedOption !== null && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className={`p-5 rounded-3xl mt-4 flex items-center justify-between shadow-xl ${
              isAnswerCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
            }`}
          >
            <div>
              <p className="font-black text-lg flex items-center gap-2">
                {isAnswerCorrect ? '🎉 Sahi jawab! (+4 Coins)' : '❌ Galat jawab (-2 Coins)'}
              </p>
            </div>
            <button
              onClick={handleNext}
              className="px-8 py-3 bg-white text-slate-900 font-black rounded-2xl shadow-lg hover:bg-slate-100 transition-all text-sm active:translate-y-0.5"
            >
              Continue →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default DuolingoTestScreen;
