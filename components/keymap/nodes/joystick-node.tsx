import React, { useState, useRef } from 'react';
import { BaseNodeWrapper } from './base-node';
import { JoystickNode } from '../types';
import { useEditor } from '../editor-context';

interface JoystickNodeProps {
  node: JoystickNode;
  isSelected: boolean;
  canvasSize: { width: number; height: number };
}

export const JoystickNodeComponent: React.FC<JoystickNodeProps> = ({ node, isSelected, canvasSize }) => {
  const { radius, keyUp, keyDown, keyLeft, keyRight, controlType } = node;
  const { isEditing, onNodeAction } = useEditor();
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const activeKeys = useRef<Set<string>>(new Set());
  const isDraggingStick = useRef(false);
  
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isEditing) return;
    e.stopPropagation();
    
    // For joystick, we want to capture the pointer so we can track it even if it leaves the circle
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingStick.current = true;
    
    // Initial movement
    updateStickPosition(e);
  };

  const updateStickPosition = (e: React.PointerEvent | PointerEvent) => {
    const container = document.getElementById(`joystick-${node.id}`);
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;
    
    const dist = Math.sqrt(dx * dx + dy * dy);
    const currentRadius = node.size ? node.size / 2 : radius;
    const maxDist = currentRadius;
    
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }
    
    setStickPos({ x: dx, y: dy });
    
    // Calculate keys based on position
    const threshold = maxDist * 0.3;
    const newKeys = new Set<string>();
    
    if (dy < -threshold) newKeys.add(keyUp);
    if (dy > threshold) newKeys.add(keyDown);
    if (dx < -threshold) newKeys.add(keyLeft);
    if (dx > threshold) newKeys.add(keyRight);
    
    // Send diffs
    // Important: Release keys first, then press new ones to avoid conflicts
    const toRelease = Array.from(activeKeys.current).filter(k => !newKeys.has(k));
    const toPress = Array.from(newKeys).filter(k => !activeKeys.current.has(k));

    toRelease.forEach(k => {
      onNodeAction?.(node, 'up', { key: k });
    });
    
    toPress.forEach(k => {
      onNodeAction?.(node, 'down', { key: k });
    });
    
    activeKeys.current = newKeys;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isEditing || !isDraggingStick.current) return;
    if (controlType === 'click') return;
    
    updateStickPosition(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isEditing) return;
    isDraggingStick.current = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch(err) {}
    
    setStickPos({ x: 0, y: 0 });
    activeKeys.current.forEach(k => {
      onNodeAction?.(node, 'up', { key: k });
    });
    activeKeys.current.clear();
  };

  const handleKeyClick = (e: React.PointerEvent, key: string) => {
    if (isEditing || controlType !== 'click') return;
    e.stopPropagation();
    
    onNodeAction?.(node, 'down', { key });
    
    const handleUp = () => {
      onNodeAction?.(node, 'up', { key });
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointerup', handleUp);
  };

  return (
    <BaseNodeWrapper node={node} isSelected={isSelected} canvasSize={canvasSize} disableTapScale={true}>
      <div 
        id={`joystick-${node.id}`}
        className="bg-slate-900/70 backdrop-blur-md border-2 border-white/20 rounded-full flex items-center justify-center relative shadow-2xl group hover:bg-slate-800/80 transition-all"
        style={{ 
          width: 'var(--node-size, 120px)', 
          height: 'var(--node-size, 120px)' 
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Inner stick - only visible in swipe mode */}
        {controlType === 'swipe' && (
          <div 
            className="bg-slate-700/80 rounded-full shadow-2xl border border-white/20 absolute transition-transform duration-75 pointer-events-none" 
            style={{ 
              width: 'calc(var(--node-size, 120px) / 3)', 
              height: 'calc(var(--node-size, 120px) / 3)',
              transform: `translate(${stickPos.x}px, ${stickPos.y}px)`
            }}
          />
        )}
        
        {/* Direction indicators */}
        <div 
          onPointerDown={(e) => handleKeyClick(e, keyUp)}
          className={`absolute top-2 left-1/2 -translate-x-1/2 font-bold flex items-center justify-center rounded-sm transition-colors cursor-pointer z-10 ${activeKeys.current.has(keyUp) ? 'bg-blue-500 text-white scale-110' : 'bg-slate-800/60 text-white/60 border border-white/5 hover:bg-slate-700/80'}`}
          style={{ 
            width: 'calc(var(--node-size, 120px) * 0.18)', 
            height: 'calc(var(--node-size, 120px) * 0.18)', 
            fontSize: 'calc(var(--node-size, 120px) * 0.08)' 
          }}
        >
          {keyUp}
        </div>
        <div 
          onPointerDown={(e) => handleKeyClick(e, keyDown)}
          className={`absolute bottom-2 left-1/2 -translate-x-1/2 font-bold flex items-center justify-center rounded-sm transition-colors cursor-pointer z-10 ${activeKeys.current.has(keyDown) ? 'bg-blue-500 text-white scale-110' : 'bg-slate-800/60 text-white/60 border border-white/5 hover:bg-slate-700/80'}`}
          style={{ 
            width: 'calc(var(--node-size, 120px) * 0.18)', 
            height: 'calc(var(--node-size, 120px) * 0.18)', 
            fontSize: 'calc(var(--node-size, 120px) * 0.08)' 
          }}
        >
          {keyDown}
        </div>
        <div 
          onPointerDown={(e) => handleKeyClick(e, keyLeft)}
          className={`absolute left-2 top-1/2 -translate-y-1/2 font-bold flex items-center justify-center rounded-sm transition-colors cursor-pointer z-10 ${activeKeys.current.has(keyLeft) ? 'bg-blue-500 text-white scale-110' : 'bg-slate-800/60 text-white/60 border border-white/5 hover:bg-slate-700/80'}`}
          style={{ 
            width: 'calc(var(--node-size, 120px) * 0.18)', 
            height: 'calc(var(--node-size, 120px) * 0.18)', 
            fontSize: 'calc(var(--node-size, 120px) * 0.08)' 
          }}
        >
          {keyLeft}
        </div>
        <div 
          onPointerDown={(e) => handleKeyClick(e, keyRight)}
          className={`absolute right-2 top-1/2 -translate-y-1/2 font-bold flex items-center justify-center rounded-sm transition-colors cursor-pointer z-10 ${activeKeys.current.has(keyRight) ? 'bg-blue-500 text-white scale-110' : 'bg-slate-800/60 text-white/60 border border-white/5 hover:bg-slate-700/80'}`}
          style={{ 
            width: 'calc(var(--node-size, 120px) * 0.18)', 
            height: 'calc(var(--node-size, 120px) * 0.18)', 
            fontSize: 'calc(var(--node-size, 120px) * 0.08)' 
          }}
        >
          {keyRight}
        </div>

        {/* Center label for click mode */}
        {controlType === 'click' && (
          <div className="text-[10px] text-white/20 font-bold uppercase tracking-widest pointer-events-none">
            Click
          </div>
        )}

        {/* Label */}
        <div className="absolute -bottom-8 whitespace-nowrap text-[10px] font-bold text-white bg-slate-900/90 px-2 py-0.5 rounded-full border border-white/10 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg opacity-100">
          {node.label || '方向摇杆'}
        </div>
      </div>
    </BaseNodeWrapper>
  );
};
