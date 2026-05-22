import React from 'react';
import { BaseNodeWrapper } from './base-node';
import { SwipeNode } from '../types';
import { Navigation } from 'lucide-react';

interface SwipeNodeProps {
  node: SwipeNode;
  isSelected: boolean;
  canvasSize: { width: number; height: number };
}

export const SwipeNodeComponent: React.FC<SwipeNodeProps> = ({ node, isSelected, canvasSize }) => {
  return (
    <BaseNodeWrapper node={node} isSelected={isSelected} canvasSize={canvasSize}>
      <div 
        className="bg-slate-900/80 backdrop-blur-md border-2 border-white/20 rounded-full flex items-center justify-center shadow-2xl group hover:bg-slate-800/90 transition-all active:scale-95"
        style={{ 
          width: 'var(--node-size, 48px)', 
          height: 'var(--node-size, 48px)' 
        }}
      >
        <div className="text-white font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] text-center px-1 truncate w-full" style={{ fontSize: node.label ? 'calc(var(--node-size, 48px) * 0.25)' : 'calc(var(--node-size, 48px) * 0.4)' }}>
          {node.label || node.key}
        </div>
        
        {/* Direction arrow indication */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2">
          <Navigation className="w-4 h-4 text-orange-400 rotate-45" style={{ width: 'calc(var(--node-size, 48px) * 0.35)', height: 'calc(var(--node-size, 48px) * 0.35)' }} />
        </div>

        {!node.label && (
          <div className="absolute -bottom-8 whitespace-nowrap text-[10px] font-bold text-white bg-slate-900/90 px-2 py-0.5 rounded-full border border-white/10 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg opacity-100">
            {node.label || '滑动'}
          </div>
        )}
      </div>
    </BaseNodeWrapper>
  );
};
