import React from 'react';
import { BaseNodeWrapper } from './base-node';
import { SkillNode } from '../types';
import { Zap } from 'lucide-react';

interface SkillNodeProps {
  node: SkillNode;
  isSelected: boolean;
  canvasSize: { width: number; height: number };
}

export const SkillNodeComponent: React.FC<SkillNodeProps> = ({ node, isSelected, canvasSize }) => {
  return (
    <BaseNodeWrapper node={node} isSelected={isSelected} canvasSize={canvasSize}>
      <div 
        className="bg-slate-900/80 backdrop-blur-md border-2 border-yellow-500/30 rounded-full flex items-center justify-center shadow-2xl group hover:bg-slate-800/90 transition-all active:scale-95"
        style={{ 
          width: 'var(--node-size, 56px)', 
          height: 'var(--node-size, 56px)' 
        }}
      >
        <div className="text-yellow-400 font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center gap-1 text-center px-1 truncate w-full" style={{ fontSize: node.label ? 'calc(var(--node-size, 56px) * 0.25)' : 'calc(var(--node-size, 56px) * 0.35)' }}>
          {!node.label && <Zap className="w-4 h-4" style={{ width: 'calc(var(--node-size, 56px) * 0.3)', height: 'calc(var(--node-size, 56px) * 0.3)' }} />}
          {node.label || node.key}
        </div>

        {!node.label && (
          <div className="absolute -bottom-8 whitespace-nowrap text-[10px] font-bold text-white bg-slate-900/90 px-2 py-0.5 rounded-full border border-white/10 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg opacity-100">
            {node.label || '技能施法'}
          </div>
        )}
      </div>
    </BaseNodeWrapper>
  );
};
