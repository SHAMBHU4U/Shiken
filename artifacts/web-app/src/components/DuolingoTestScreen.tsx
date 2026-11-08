import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { get, ref } from 'firebase/database';
import { db } from '@/firebase';

interface Question {
  id?: string;
  question?: string;
  english?: string;
  en?: {
    question?: string;
    options?: string[] | Record<string, string>;
  };
  options?: string[] | Record<string, string>;
  correctAnswer?: number | string;
  correctOptionIndex?: number;
  answerIndex?: number;
  explanation?: string;
  svg?: string;
}

interface DuolingoTestScreenProps {
  testPath: string;
  testTitle?: string;
  onBack: () => void;
  onComplete?: (score: number, total: number) => void;
}

export const DuolingoTestScreen: React.FC<DuolingoTestScreenProps> = ({ testPath, testTitle, onBack, onComplete }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [sessionCoins, setSessionCoins] = useState(0); // Live coins earned in this test
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(15);

  // Helper to extract options safely as an Array from any schema format
  const getOptions = (q: Question): string[] => {
    if (!q) return [];
    if (Array.isArray(q.options)) return q.options;
    if (q.options && typeof q.options === 'object') return Object.values(q.options);
    if (Array.isArray(q.en?.options)) return q.en.options;
    if (q.en?.options && typeof q.en?.options === 'object') return Object.values(q.en.options);
    return [];
  };

  // Helper to extract question text safely
  const getQuestionText = (q: Question): string => {
    return q.question || q.english || q.en?.question || "Question";
  };

  // Helper to extract correct answer index safely
  const getCorrectIndex = (q: Question): number => {
    if (typeof q.correctOptionIndex === 'number') return q.correctOptionIndex;
    if (typeof q.answerIndex === 'number') return q.answerIndex;
    if (q.correctAnswer !== undefined) return Number(q.correctAnswer);
    return 0;
  };

  // Safe local coin update handler (+4 correct, -2 incorrect)
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

  // Fetch questions safely from RTDB
  useEffect(() => {
    let isMounted = true;
    const fetchQuestions = async () => {
      try {
        const snapshot = await get(ref(db, testPath));
        if (snapshot.exists() && isMounted) {
          const data = snapshot.val();
          const rawQuestions: any[] = Array.isArray(data)
            ? data.filter(Boolean)
            : Object.values(data || {});

          // Randomize questions pool
          const shuffled = rawQuestions.sort(() => Math.random() - 0.5);
          setQuestions(shuffled);
        }
      } catch (error) {
        console.error("Error fetching test questions from RTDB:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchQuestions();
    return () => { isMounted = false; };
  }, [testPath]);

  // Timer logic per question
  useEffect(() => {
    if (loading || questions.length === 0) return;

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
  }, [currentIndex, loading, questions.length]);

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
    } else {
      setSessionCoins((prev) => Math.max(0, prev - 2));
      syncShikenCoins(-2);
    }
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 rounded-full border-2 border-transparent border-t-emerald-500 border-r-emerald-500 mb-3"
        />
        <p className="text-sm text-white/40 font-medium">Loading questions from Database...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white p-4 text-center">
        <p className="text-base font-bold mb-2">No questions available</p>
        <p className="text-xs text-white/40 mb-5">This test section has no questions loaded yet.</p>
        <button onClick={onBack} className="px-5 py-2.5 bg-emerald-600 rounded-xl text-sm font-bold text-white">
          Go Back
        </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const optionsList = getOptions(currentQ);
  const correctIdx = getCorrectIndex(currentQ);
  const progressPercent = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#0f172a] text-white flex flex-col justify-between p-4 font-sans select-none">
      {/* Top Header: Close, Coins, Progress Bar & Timer */}
      <div>
        <div className="flex items-center justify-between mb-3 pt-2">
          <button onClick={onBack} className="text-white/40 hover:text-white text-xl font-bold transition-colors">
            ✕
          </button>
          
          <div className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
            🪙 <span>+{sessionCoins}</span>
          </div>

          {/* Progress Bar */}
          <div className="flex-1 mx-3 h-3 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Circular Timer */}
          <div className="relative w-9 h-9 flex items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500/10 shrink-0">
            <span className="text-xs font-black text-emerald-400">{timeLeft}s</span>
          </div>
        </div>
        {testTitle && <p className="text-center text-xs text-white/40 font-semibold uppercase tracking-wider mb-2">{testTitle}</p>}
      </div>

      {/* Center Content: Mascot & Question Card */}
      <div className="flex-1 flex flex-col justify-center py-2">
        <div className="flex items-start space-x-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xl shrink-0 shadow-inner">
            🦉
          </div>
          <div className="flex-1 bg-white/5 border border-white/10 p-4 rounded-2xl text-white text-base font-semibold leading-relaxed shadow-sm">
            {getQuestionText(currentQ)}
          </div>
        </div>

        {/* SVG Diagram Support */}
        {currentQ.svg && (
          <div className="mb-5 flex justify-center bg-white/5 p-3 rounded-2xl border border-white/10" dangerouslySetInnerHTML={{ __html: currentQ.svg }} />
        )}

        {/* Safe Options Render */}
        <div className="space-y-3">
          {optionsList.map((option: string, idx: number) => {
            let optionStyle = "bg-white/5 border-white/10 text-white/90 hover:bg-white/10 hover:border-white/20";
            if (selectedOption !== null) {
              if (idx === correctIdx) {
                optionStyle = "bg-emerald-500/20 border-emerald-500 text-emerald-300";
              } else if (idx === selectedOption) {
                optionStyle = "bg-rose-500/20 border-rose-500 text-rose-300";
              } else {
                optionStyle = "bg-white/5 border-white/5 opacity-40 text-white/50";
              }
            }

            return (
              <motion.button
                key={idx}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleOptionClick(idx)}
                disabled={selectedOption !== null}
                className={`w-full p-4 rounded-2xl border-2 text-left font-medium transition-all flex items-center gap-3 ${optionStyle}`}
              >
                <span className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center text-xs font-bold text-white/60 shrink-0">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1 text-sm">{option}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Bottom Feedback Footer with Coin Feedback */}
      <AnimatePresence>
        {selectedOption !== null && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className={`p-4 rounded-2xl mt-4 flex items-center justify-between ${
              isAnswerCorrect ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}
          >
            <div>
              <p className="font-black text-base flex items-center gap-2">
                {isAnswerCorrect ? '🎉 Sahi jawab! (+4 Coins)' : '❌ Galat jawab (-2 Coins)'}
              </p>
              {currentQ.explanation && (
                <p className="text-xs opacity-90 mt-0.5 max-w-[220px] truncate">{currentQ.explanation}</p>
              )}
            </div>
            <button
              onClick={handleNext}
              className="px-5 py-2.5 bg-white text-slate-900 font-bold rounded-xl shadow-lg hover:bg-slate-100 transition-colors text-xs"
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
