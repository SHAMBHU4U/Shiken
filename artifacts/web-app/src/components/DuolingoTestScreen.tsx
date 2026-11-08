import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { get, ref } from 'firebase/database';
import { db } from '@/firebase';

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number | string;
  explanation?: string;
  svg?: string;
}

interface DuolingoTestScreenProps {
  testPath: string; // RTDB path (e.g., 'class10/science' or 'c10/maths')
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
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(15); // Circular round timer

  // Fetching questions directly from Firebase RTDB (No AI latency, direct NCERT/SCERT data)
  useEffect(() => {
    let isMounted = true;
    const fetchQuestions = async () => {
      try {
        const snapshot = await get(ref(db, testPath));
        if (snapshot.exists() && isMounted) {
          const data = snapshot.val();
          const loadedQuestions: Question[] = Array.isArray(data)
            ? data.filter(Boolean)
            : Object.values(data);
          setQuestions(loadedQuestions);
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

  // Circular Timer Logic
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
  }, [currentIndex, loading]);

  const handleOptionClick = (index: number) => {
    if (selectedOption !== null) return;

    setSelectedOption(index);
    const currentQ = questions[currentIndex];
    const correct = index === Number(currentQ.correctAnswer) || index.toString() === currentQ.correctAnswer.toString();

    setIsAnswerCorrect(correct);
    if (correct) {
      setScore((prev) => prev + 1);
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
  const progressPercent = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#0f172a] text-white flex flex-col justify-between p-4 font-sans select-none">
      {/* Top Header: Close, Progress bar & Circular Timer */}
      <div>
        <div className="flex items-center justify-between mb-4 pt-2">
          <button onClick={onBack} className="text-white/40 hover:text-white text-xl font-bold transition-colors">
            ✕
          </button>
          
          {/* Progress Bar */}
          <div className="flex-1 mx-4 h-3 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Round Circular Timer */}
          <div className="relative w-10 h-10 flex items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500/10">
            <span className="text-xs font-black text-emerald-400">{timeLeft}s</span>
          </div>
        </div>
        {testTitle && <p className="text-center text-xs text-white/40 font-semibold uppercase tracking-wider">{testTitle}</p>}
      </div>

      {/* Center Content: Mascot & Question Card */}
      <div className="flex-1 flex flex-col justify-center py-4">
        <div className="flex items-start space-x-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xl shrink-0 shadow-inner">
            🦉
          </div>
          <div className="flex-1 bg-white/5 border border-white/10 p-4 rounded-2xl text-white text-base font-semibold leading-relaxed shadow-sm">
            {currentQ.question}
          </div>
        </div>

        {/* Optional SVG Support */}
        {currentQ.svg && (
          <div className="mb-6 flex justify-center bg-white/5 p-3 rounded-2xl border border-white/10" dangerouslySetInnerHTML={{ __html: currentQ.svg }} />
        )}

        {/* Options Cards */}
        <div className="space-y-3">
          {currentQ.options?.map((option, idx) => {
            let optionStyle = "bg-white/5 border-white/10 text-white/90 hover:bg-white/10 hover:border-white/20";
            if (selectedOption !== null) {
              const correctIdx = Number(currentQ.correctAnswer);
              if (idx === correctIdx || idx.toString() === currentQ.correctAnswer.toString()) {
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

      {/* Bottom Feedback Footer */}
      <AnimatePresence>
        {selectedOption !== null && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className={`p-5 rounded-t-3xl -mx-4 -mb-4 mt-4 flex items-center justify-between ${
              isAnswerCorrect ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}
          >
            <div>
              <p className="font-black text-lg flex items-center gap-2">
                {isAnswerCorrect ? '🎉 Sahi jawab!' : '❌ Galat jawab'}
              </p>
              {currentQ.explanation && (
                <p className="text-xs opacity-90 mt-1 max-w-[240px] truncate">{currentQ.explanation}</p>
              )}
            </div>
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-white text-slate-900 font-bold rounded-2xl shadow-lg hover:bg-slate-100 transition-colors text-sm"
            >
              Continue →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
