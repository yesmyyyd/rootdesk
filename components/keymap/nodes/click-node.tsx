import React from 'react';
import { BaseNodeWrapper } from './base-node';
import { ClickNode, CrosshairNode, FireNode } from '../types';
import { Crosshair, Target, Layers } from 'lucide-react';

interface ClickNodeProps {
  node: ClickNode | CrosshairNode | FireNode;
  isSelected: boolean;
  canvasSize: { width: number; height: number };
}

export const ClickNodeComponent: React.FC<ClickNodeProps> = ({ node, isSelected, canvasSize }) => {
  return (
    <BaseNodeWrapper node={node} isSelected={isSelected} canvasSize={canvasSize}>
      <div 
        className="bg-slate-900/80 backdrop-blur-md border-2 border-white/20 rounded-full flex items-center justify-center shadow-2xl group hover:bg-slate-800/90 transition-all active:scale-95"
        style={{ 
          width: 'var(--node-size, 48px)', 
          height: 'var(--node-size, 48px)' 
        }}
      >
        <div className="text-white font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] text-center px-1 truncate flex items-center justify-center gap-0.5" style={{ fontSize: node.label ? 'calc(var(--node-size, 48px) * 0.25)' : 'calc(var(--node-size, 48px) * 0.4)' }}>
          {node.label || (
            <>
              {node.type === 'click' && (
                <>
                  {node.key}
                  {node.actions && node.actions.length > 1 && (
                    <Layers className="w-[0.4em] h-[0.4em] opacity-70" />
                  )}
                </>
              )}
              {node.type === 'fire' && <Target className="w-6 h-6 text-red-400" />}
              {node.type === 'crosshair' && <Crosshair className="w-6 h-6 text-blue-400" />}
            </>
          )}
        </div>
        
        {/* Only show bottom label if center is not showing the label */}
        {!node.label && (
          <div className="absolute -bottom-8 whitespace-nowrap text-[10px] font-bold text-white bg-slate-900/90 px-2 py-0.5 rounded-full border border-white/10 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg opacity-100">
            {node.type === 'click' && (node.actions && node.actions.length > 1 ? '组合点击' : '点击')}
            {node.type === 'fire' && '开火'}
            {node.type === 'crosshair' && '准星'}
          </div>
        )}
      </div>
    </BaseNodeWrapper>
  );
};
