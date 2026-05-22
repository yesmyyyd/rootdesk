import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VirtualKeyboardProps {
  onKeySelect: (key: string) => void;
  onClose: () => void;
  className?: string;
}

const KEYBOARD_LAYOUT = [
  ['ESC', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'],
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'BACK'],
  ['TAB', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
  ['CAPS', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'ENTER'],
  ['SHIFT', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'SHIFT'],
  ['CTRL', 'WIN', 'ALT', 'SPACE', 'ALT', 'WIN', 'MENU', 'CTRL'],
  ['UP', 'DOWN', 'LEFT', 'RIGHT']
];

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({ onKeySelect, onClose, className }) => {
  return (
    <div className="fixed inset-0 z-[1000] flex flex-col justify-end bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="absolute inset-0" 
        onClick={onClose} 
      />
      
      <div className={cn(
        "relative w-full bg-slate-900 border-t border-slate-700 p-4 pb-10 shadow-[0_-8px_32px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom duration-300",
        className
      )}>
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h3 className="text-slate-200 font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                等待按键输入...
              </h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
                直接按下物理键盘 或 点击下方按键
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex flex-col gap-1.5 items-center select-none">
          {KEYBOARD_LAYOUT.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-1.5 w-full justify-center">
              {row.map((key) => {
                const isWide = ['BACK', 'TAB', 'CAPS', 'ENTER', 'SHIFT', 'CTRL', 'WIN', 'ALT', 'SPACE'].includes(key);
                const isSpace = key === 'SPACE';
                
                return (
                  <button
                    key={key}
                    onClick={() => onKeySelect(key)}
                    className={cn(
                      "h-10 sm:h-12 flex items-center justify-center rounded bg-slate-800 border border-slate-700 text-slate-200 text-xs sm:text-sm font-medium hover:bg-slate-700 active:bg-blue-600 active:border-blue-500 transition-all shadow-sm",
                      isWide ? "px-3 min-w-[50px]" : "w-8 sm:w-10",
                      isSpace && "flex-1 max-w-[300px]",
                      key === 'SHIFT' && "min-w-[70px]",
                      key === 'BACK' && "min-w-[70px]",
                      key === 'ENTER' && "min-w-[80px]"
                    )}
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
};
