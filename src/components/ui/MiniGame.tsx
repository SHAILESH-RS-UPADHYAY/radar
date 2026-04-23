'use client';

import { useState, useEffect } from 'react';
import { playSound } from '@/lib/audio';

export default function TicTacToe({ onComplete }: { onComplete?: () => void }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);

  const calculateWinner = (squares: any[]) => {
    const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    return null;
  };

  const handleClick = (i: number) => {
    if (board[i] || calculateWinner(board)) return;
    playSound('click');
    const newBoard = [...board];
    newBoard[i] = isXNext ? 'X' : 'O';
    setBoard(newBoard);
    setIsXNext(!isXNext);
    
    if (calculateWinner(newBoard)) {
      setTimeout(() => playSound('success'), 300);
    }
  };

  const winner = calculateWinner(board);
  const status = winner ? `Winner: ${winner}` : board.every(Boolean) ? 'Draw!' : `Next: ${isXNext ? 'X' : 'O'}`;

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-[#0a0a0a]/90 backdrop-blur-xl border border-[#00FFD4]/20 rounded-2xl w-[320px] shadow-[0_0_40px_rgba(0,255,212,0.1)]">
      <div className="flex items-center gap-2 mb-6 w-full">
        <div className="w-2 h-2 rounded-full bg-[#00FFD4] animate-pulse" />
        <div className="text-[#00FFD4] text-xs font-bold uppercase tracking-widest">AI Scanning... Play while you wait</div>
      </div>
      
      <div className="grid grid-cols-3 gap-2 mb-5 bg-white/5 p-2 rounded-xl">
        {board.map((cell, i) => (
          <button
            key={i}
            className="w-20 h-20 bg-[#111111] hover:bg-white/10 rounded-lg text-3xl font-black transition-colors flex items-center justify-center"
            style={{ color: cell === 'X' ? '#00FFD4' : '#8B5CF6' }}
            onMouseEnter={() => playSound('hover')}
            onClick={() => handleClick(i)}
          >
            {cell}
          </button>
        ))}
      </div>
      
      <div className="text-xs text-[#64748B] flex justify-between w-full px-1 items-center">
        <span className="font-semibold text-white">{status}</span>
        <button 
          className="px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors"
          onMouseEnter={() => playSound('hover')} 
          onClick={() => { playSound('click'); setBoard(Array(9).fill(null)); }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
