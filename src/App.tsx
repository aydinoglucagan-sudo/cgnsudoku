/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Lightbulb, 
  RotateCcw, 
  Plus, 
  Sparkles, 
  Palette,
  Undo2,
  Sun,
  Moon,
  TrendingUp
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { format, parseISO, isToday } from 'date-fns';
import { generateSudoku, Grid, isWin } from './lib/sudoku';

import { sounds } from './lib/sounds';
import { haptics } from './lib/haptics';

type VisualMode = 'light' | 'focus' | 'crayon';

interface GameStats {
  gamesPlayed: number;
  gamesWon: number;
  bestTime: number | null; // in seconds
}

interface GameState {
  grid: Grid;
}

export default function App() {
  // Appearance
  const [visualMode, setVisualMode] = useState<VisualMode>(() => {
    return (localStorage.getItem('sudoku-visual-mode') as VisualMode) || 'focus';
  });

  // Game Logic
  const [grid, setGrid] = useState<Grid>([]);
  const [initialGrid, setInitialGrid] = useState<Grid>([]);
  const [solvedGrid, setSolvedGrid] = useState<Grid>([]);
  const [undoStack, setUndoStack] = useState<GameState[]>([]);
  
  // Game State
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [hintedCell, setHintedCell] = useState<{ r: number; c: number } | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Stats
  const [stats, setStats] = useState<GameStats>({ gamesPlayed: 0, gamesWon: 0, bestTime: null });
  const [showStats, setShowStats] = useState(false);

  // Initialize
  const startNewGame = useCallback(() => {
    const { initial, solved } = generateSudoku(16); // Medium difficulty
    setGrid(initial.map(row => [...row]));
    setInitialGrid(initial.map(row => [...row]));
    setSolvedGrid(solved);
    setUndoStack([]);
    setSelectedCell(null);
    setIsGameOver(false);
    setHintsLeft(3);
    setHintedCell(null);
    setCurrentTime(0);
    setStartTime(Date.now());
  }, []);

  useEffect(() => {
    startNewGame();
    // Load data
    const savedStats = localStorage.getItem('sudoku-stats');
    if (savedStats) setStats(JSON.parse(savedStats));

    const savedMode = localStorage.getItem('sudoku-visual-mode') as VisualMode;
    if (savedMode) setVisualMode(savedMode);
  }, [startNewGame]);

  // Timer
  useEffect(() => {
    let interval: any;
    if (startTime && !isGameOver) {
      interval = setInterval(() => {
        setCurrentTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [startTime, isGameOver]);

  useEffect(() => {
    localStorage.setItem('sudoku-visual-mode', visualMode);
  }, [visualMode]);

  const pushToUndo = useCallback((currentGrid: Grid) => {
    setUndoStack(prev => [...prev.slice(-19), { 
      grid: currentGrid.map(row => [...row])
    }]);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0 || isGameOver) return;
    sounds.playClear();
    haptics.clear();
    const last = undoStack[undoStack.length - 1];
    setGrid(last.grid);
    setUndoStack(prev => prev.slice(0, -1));
  }, [undoStack, isGameOver]);

  const updateStats = () => {
    const newStats = { 
      ...stats, 
      gamesWon: stats.gamesWon + 1,
      gamesPlayed: stats.gamesPlayed + 1,
      bestTime: stats.bestTime === null ? currentTime : Math.min(stats.bestTime, currentTime)
    };
    setStats(newStats);
    localStorage.setItem('sudoku-stats', JSON.stringify(newStats));
  };

  const handleWin = () => {
    setIsGameOver(true);
    updateStats();
    sounds.playWin();
    haptics.success();
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: visualMode === 'crayon' ? ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93'] : ['#22C55E', '#10B981']
    });
    setTimeout(startNewGame, 4000);
  };

  const handleDrop = (r: number, c: number, e: React.DragEvent) => {
    e.preventDefault();
    const num = parseInt(e.dataTransfer.getData('text/plain'));
    if (!isNaN(num)) {
      setSelectedCell({ r, c });
      // We need to use a small timeout to ensure state update for selected cell if needed, 
      // but calling setNumber directly with a value is better.
      setNumberWithValue(r, c, num);
    }
  };

  const setNumberWithValue = useCallback((r: number, c: number, num: number) => {
    if (isGameOver || initialGrid[r][c] !== null) return;

    pushToUndo(grid);

    setGrid(prev => {
      const newGrid = prev.map(row => [...row]);
      const isClearing = newGrid[r][c] === num;
      newGrid[r][c] = isClearing ? null : num;
      
      if (isClearing) {
        sounds.playClear();
        haptics.clear();
      } else {
        sounds.playPlace();
        haptics.place();
      }

      if (newGrid[r][c] === solvedGrid[r][c]) {
        if (isWin(newGrid, solvedGrid)) setTimeout(handleWin, 0);
      }
      return newGrid;
    });
  }, [isGameOver, initialGrid, grid, solvedGrid, pushToUndo]);

  const setNumber = useCallback((num: number) => {
    if (!selectedCell) return;
    setNumberWithValue(selectedCell.r, selectedCell.c, num);
  }, [selectedCell, setNumberWithValue]);

  const getHint = () => {
    if (isGameOver || hintsLeft <= 0) return;
    
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const targetR = (selectedCell?.r ?? 0 + r) % 6;
        const targetC = (selectedCell?.c ?? 0 + c) % 6;
        
        if (grid[targetR][targetC] !== solvedGrid[targetR][targetC]) {
          pushToUndo(grid);
          sounds.playHint();
          haptics.hint();
          setGrid(prev => {
            const newGrid = prev.map(row => [...row]);
            newGrid[targetR][targetC] = solvedGrid[targetR][targetC];
            if (isWin(newGrid, solvedGrid)) setTimeout(handleWin, 0);
            return newGrid;
          });
          setHintsLeft(prev => prev - 1);
          setHintedCell({ r: targetR, c: targetC });
          setSelectedCell({ r: targetR, c: targetC });
          setTimeout(() => setHintedCell(null), 1600);
          return;
        }
      }
    }
  };

  const clearCell = useCallback(() => {
    if (!selectedCell || isGameOver) return;
    const { r, c } = selectedCell;
    if (initialGrid[r][c] !== null) return;
    
    pushToUndo(grid);
    sounds.playClear();
    haptics.clear();
    setGrid(prev => {
      const newGrid = prev.map(row => [...row]);
      newGrid[r][c] = null;
      return newGrid;
    });
  }, [selectedCell, isGameOver, initialGrid, grid, pushToUndo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isGameOver) return;

      if (e.key >= '1' && e.key <= '6') {
        setNumber(parseInt(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        clearCell();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        undo();
      } else if (e.key.startsWith('Arrow') && selectedCell) {
        let { r, c } = selectedCell;
        if (e.key === 'ArrowUp') r = (r - 1 + 6) % 6;
        if (e.key === 'ArrowDown') r = (r + 1) % 6;
        if (e.key === 'ArrowLeft') c = (c - 1 + 6) % 6;
        if (e.key === 'ArrowRight') c = (c + 1) % 6;
        setSelectedCell({ r, c });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, isGameOver, setNumber, undo, clearCell]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const theme = useMemo(() => {
    if (visualMode === 'crayon') return {
      bg: '#FFFBF2',
      grid: '#7C8C7C',
      board: '#F5E6D3',
      cell: '#FFF',
      text: '#444',
      primary: '#FF595E',
      secondary: '#8AC926',
      selected: '#FFCA3A',
      accent: '#1982C4',
      name: 'crayon'
    };
    if (visualMode === 'focus') return {
      bg: '#000000',
      grid: '#222',
      board: '#0A0A0A',
      cell: '#111',
      text: '#FFF',
      primary: '#FFF',
      secondary: '#666',
      selected: '#333',
      accent: '#555',
      name: 'focus'
    };
    return {
      bg: '#F9FAFB',
      grid: '#E5E7EB',
      board: '#FFF',
      cell: '#FFF',
      text: '#1F2937',
      primary: '#3B82F6',
      secondary: '#94A3B8',
      selected: '#DBEAFE',
      accent: '#6366F1',
      name: 'light'
    };
  }, [visualMode]);



  const isDark = visualMode === 'focus';

  return (
    <div 
      className={`min-h-screen flex flex-col items-center justify-center p-4 selection:bg-none transition-colors duration-500 landscape:py-2 ${visualMode === 'crayon' ? 'crayon-mode' : ''}`}
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      <svg className="absolute w-0 h-0 invisible">
        <filter id="wobbly">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" />
        </filter>
        <filter id="wobbly-lite">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
        </filter>
      </svg>

      <div className="w-full max-w-5xl flex flex-col landscape:flex-row landscape:items-start landscape:justify-center landscape:gap-8 items-center">
        
        {/* Left Column: Info */}
        <div className="w-full max-w-sm landscape:max-w-[200px] flex flex-col gap-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-col shrink-0">
              <h1 className="text-xl landscape:text-lg font-black tracking-tight leading-tight flex items-center gap-2">
                CGN SUDOKU <Sparkles className="text-yellow-500" size={16} />
              </h1>
              <p className="text-[10px] opacity-50 font-medium">{formatTime(currentTime)} • {visualMode.toUpperCase()}</p>
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={() => setShowStats(true)}
                className={`p-2 rounded-xl transition-all ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white shadow-sm border border-gray-100'}`}
              >
                <TrendingUp size={16} />
              </button>
              <button 
                onClick={() => {
                  const modes: VisualMode[] = ['light', 'focus', 'crayon'];
                  setVisualMode(modes[(modes.indexOf(visualMode) + 1) % 3]);
                }}
                className={`p-2 rounded-xl transition-all ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white shadow-sm border border-gray-100'}`}
              >
                {visualMode === 'light' && <Sun size={16} />}
                {visualMode === 'focus' && <Moon size={16} />}
                {visualMode === 'crayon' && <Palette size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* Middle Column: Board */}
        <div className="relative group my-6 landscape:my-0">
          <motion.div 
            layout
            className={`relative grid grid-cols-6 p-1.5 rounded-2xl transition-all ${visualMode === 'crayon' ? 'crayon-border' : isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-gray-100 border border-gray-200'}`}
            style={{ gap: '2px', backgroundColor: theme.board }}
          >
            {grid.length > 0 && grid.map((row, r) => (
              row.map((cell, c) => {
                const isInitial = initialGrid[r][c] !== null;
                const isSelected = selectedCell?.r === r && selectedCell?.c === c;
                const isSameRowCol = selectedCell?.r === r || selectedCell?.c === c;
                const isHinted = hintedCell?.r === r && hintedCell?.c === c;
                const isWrong = cell !== null && cell !== solvedGrid[r][c] && !isInitial;
                
                const borderRight = (c + 1) % 3 === 0 && c < 5;
                const borderBottom = (r + 1) % 2 === 0 && r < 5;

                return (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => !isGameOver && setSelectedCell({ r, c })}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(r, c, e)}
                    className={`
                      relative w-11 h-11 sm:w-14 sm:h-14 landscape:w-10 landscape:h-10 flex items-center justify-center text-lg sm:text-2xl landscape:text-base font-bold rounded-lg cell-transition
                      ${visualMode === 'crayon' ? 'crayon-cell' : ''}
                      ${isHinted ? 'hint-flash' : ''}
                    `}
                    style={{
                      backgroundColor: isSelected 
                        ? theme.selected 
                        : isSameRowCol ? (visualMode === 'crayon' ? 'rgba(255, 202, 58, 0.15)' : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(59,130,246,0.05)') : theme.cell,
                      color: isWrong 
                        ? '#EF4444' 
                        : isInitial ? theme.secondary : theme.text,
                      marginRight: borderRight ? (visualMode === 'crayon' ? '5px' : '3px') : '0',
                      marginBottom: borderBottom ? (visualMode === 'crayon' ? '5px' : '3px') : '0',
                      boxShadow: borderRight ? `2px 0 0 0 ${theme.grid}` : (borderBottom ? `0 2px 0 0 ${theme.grid}` : ''),
                    }}
                  >
                    {cell}
                    {isSelected && !isGameOver && (
                      <motion.div 
                        layoutId="cursor" 
                        className="absolute inset-0 border-2 rounded-lg pointer-events-none z-10"
                        style={{ borderColor: theme.primary }}
                      />
                    )}
                  </button>
                )
              })
            ))}
          </motion.div>

          <AnimatePresence>
            {isGameOver && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-[2px] rounded-2xl"
              >
                <motion.div 
                  initial={{ y: 10, scale: 0.9 }} animate={{ y: 0, scale: 1 }}
                  className={`p-6 rounded-3xl flex flex-col items-center text-center gap-3 ${visualMode === 'crayon' ? 'crayon-border bg-white' : isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white shadow-2xl'}`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-green-500/10 text-green-500 flex items-center justify-center">
                    <Trophy size={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black">Harika!</h2>
                    <p className="text-[10px] opacity-60">{formatTime(currentTime)} sürdü.</p>
                  </div>
                  <div className="w-24 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 4 }}
                      className="h-full bg-green-500"
                    />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Pad & Actions */}
        <div className="w-full max-w-sm landscape:max-w-[200px] flex flex-col gap-3">
          <div className="grid grid-cols-3 landscape:grid-cols-2 gap-2">
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <motion.button
                key={num}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', num.toString());
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setNumber(num)}
                disabled={isGameOver}
                className={`h-12 landscape:h-10 flex items-center justify-center text-lg font-bold rounded-xl transition-all ${visualMode === 'crayon' ? 'crayon-button' : isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-gray-100 shadow-sm'}`}
                style={{ 
                  backgroundColor: visualMode === 'crayon' ? `hsl(${num * 55}, 100%, 93%)` : '',
                  color: visualMode === 'crayon' ? `hsl(${num * 55}, 50%, 30%)` : ''
                }}
              >
                {num}
              </motion.button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={undo}
              disabled={undoStack.length === 0 || isGameOver}
              className={`flex-1 h-12 landscape:h-10 rounded-xl flex items-center justify-center gap-2 transition-all border ${undoStack.length > 0 ? (isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-white border-gray-100 text-gray-500 shadow-sm') : 'opacity-20'}`}
            >
              <Undo2 size={16} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Geri Al</span>
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={getHint}
              disabled={hintsLeft <= 0 || isGameOver}
              className={`flex-1 h-12 landscape:h-10 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border ${hintsLeft > 0 ? (isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-white border-gray-100 text-gray-500') : 'opacity-20'}`}
            >
              <Lightbulb size={16} />
              <div className="flex gap-1">
                {[1, 2, 3].map(i => (
                  <div 
                    key={i} 
                    className={`w-1 h-1 rounded-full transition-colors duration-500 ${i <= hintsLeft ? 'bg-yellow-500' : (isDark ? 'bg-zinc-800' : 'bg-gray-200')}`}
                  />
                ))}
              </div>
              <span className="text-[8px] font-bold uppercase tracking-widest opacity-60">İPUCU</span>
            </button>

            <button
              onClick={startNewGame}
              className={`p-3 landscape:p-2 rounded-xl transition-all shadow-lg ${visualMode === 'crayon' ? 'crayon-button bg-green-100 text-green-700' : 'bg-green-500 text-white active:scale-95'}`}
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>


      <AnimatePresence>
        {showStats && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className={`w-full max-w-sm rounded-[2.5rem] p-8 relative ${isDark ? 'bg-zinc-950 border border-zinc-900' : 'bg-white border border-gray-100 shadow-2xl'}`}
            >
              <button 
                onClick={() => setShowStats(false)}
                className="absolute top-6 right-6 p-2 rounded-full opacity-40 hover:opacity-100 transition-opacity"
              >
                <Plus size={24} className="rotate-45" />
              </button>
              <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
                  <TrendingUp size={24} />
                </div>
                İstatistiklerin
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Oynanan', value: stats.gamesPlayed },
                  { label: 'Kazanılan', value: stats.gamesWon },
                  { label: 'En iyi süre', value: stats.bestTime ? formatTime(stats.bestTime) : '--' },
                ].map((item, i) => (
                  <div key={i} className={`p-5 rounded-3xl flex flex-col gap-1 ${isDark ? 'bg-zinc-900/50' : 'bg-gray-50'}`}>
                    <span className="text-xs font-bold opacity-40 uppercase tracking-widest">{item.label}</span>
                    <span className="text-xl font-black">{item.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="mt-12 opacity-20 text-[10px] font-bold tracking-widest uppercase text-center selection:bg-none pointer-events-none">
        Odaklan ve Çöz • MacBook & Mobil Uyumlu
      </footer>
    </div>
  );
}
