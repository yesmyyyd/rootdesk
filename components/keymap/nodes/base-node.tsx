import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useEditor } from '../editor-context';
import { KeyNode } from '../types';
import { Settings, X } from 'lucide-react';

interface BaseNodeProps {
  node: KeyNode;
  isSelected: boolean;
  canvasSize: { width: number; height: number };
  children: React.ReactNode;
  className?: string;
  disableTapScale?: boolean;
}

export const BaseNodeWrapper: React.FC<BaseNodeProps> = ({ 
  node, 
  isSelected, 
  canvasSize,
  children,
  className = "",
  disableTapScale = false
}) => {
  const { updateNode, removeNode, selectNode, isEditing, onNodeAction, setIsDraggingNode, setShowProperties, executingNodeId } = useEditor();
  
  // Use local state for immediate feedback
  const [localPos, setLocalPos] = useState({ 
    x: node.x, 
    y: node.y 
  });
  const [localSize, setLocalSize] = useState(
    node.size || (node.type === 'joystick' ? (node as any).radius * 2 : 48)
  );

  const isExecuting = executingNodeId === node.id;

  const [isDraggingState, setIsDraggingState] = useState(false);
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Sync with props when not dragging
  useEffect(() => {
    if (!isDragging.current) {
      setLocalPos({ 
        x: node.x, 
        y: node.y 
      });
      setLocalSize(
        node.size || (node.type === 'joystick' ? (node as any).radius * 2 : 48)
      );
    }
  }, [node.x, node.y, node.size]);

  const xPx = (localPos.x / 100) * (canvasSize.width || 0);
  const yPx = (localPos.y / 100) * (canvasSize.height || 0);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    
    if (isEditing) {
      selectNode(node.id);
      isDragging.current = true;
      setIsDraggingState(true);
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      setIsDraggingNode(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    
    // Play mode interaction
    if (isExecuting) return; // Prevent interaction if executing
    e.currentTarget.setPointerCapture(e.pointerId);
    onNodeAction?.(node, 'down', { clientX: e.clientX, clientY: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    
    if (isEditing) {
      if (isDragging.current && canvasSize.width && canvasSize.height) {
        const dx = e.clientX - dragStartPos.current.x;
        const dy = e.clientY - dragStartPos.current.y;
        
        const deltaXPercent = (dx / canvasSize.width) * 100;
        const deltaYPercent = (dy / canvasSize.height) * 100;
        
        setLocalPos(prev => ({
          x: Math.max(0, Math.min(100, prev.x + deltaXPercent)),
          y: Math.max(0, Math.min(100, prev.y + deltaYPercent))
        }));
        
        dragStartPos.current = { x: e.clientX, y: e.clientY };
      }
      return;
    }
    
    onNodeAction?.(node, 'move', { clientX: e.clientX, clientY: e.clientY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    
    if (isEditing) {
      if (isDragging.current) {
        isDragging.current = false;
        setIsDraggingState(false);
        setIsDraggingNode(false);
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(err){}
        
        updateNode(node.id, { x: localPos.x, y: localPos.y });
      }
      return;
    }
    
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(err){}
    onNodeAction?.(node, 'up');
  };

  // Handle Resize Drag
  const handleResizeDrag = (e: any, info: any) => {
    e.stopPropagation();
    const delta = (info.delta.x + info.delta.y) * 1.5;
    const newSize = Math.max(20, Math.min(400, localSize + delta));
    setLocalSize(newSize);
  };

  const handleResizeEnd = () => {
    setIsDraggingNode(false);
    if (node.type === 'joystick') {
      updateNode(node.id, { size: localSize, radius: localSize / 2 });
    } else {
      updateNode(node.id, { size: localSize });
    }
  };

  return (
    <motion.div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => {
        // Prevent default browser behaviors like text selection or scrolling
        // e.preventDefault() is often passive by default, using touchAction: none instead
        e.stopPropagation();
      }}
      onContextMenu={(e) => e.preventDefault()} // Disable long-press context menu
      whileTap={(!isEditing && !disableTapScale) ? { scale: 0.92, filter: 'brightness(0.8)' } : {}}
      initial={false}
      animate={{ 
        x: xPx, 
        y: yPx,
        opacity: (canvasSize.width > 0) ? 1 : 0,
        scale: isDraggingState ? 1.05 : 1,
        zIndex: isDraggingState ? 100 : (isSelected ? 50 : 40)
      }}
      transition={{ type: "spring", damping: 50, stiffness: 500, mass: 0.5 }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 select-none touch-none ${isEditing ? 'cursor-move pointer-events-auto' : 'pointer-events-auto'} ${isSelected && isEditing ? 'ring-2 ring-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.6)]' : ''} ${isExecuting ? 'opacity-50 grayscale pointer-events-none' : ''} ${className}`}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        msUserSelect: 'none',
        MozUserSelect: 'none',
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        ['--node-size' as any]: `${localSize}px`,
        ['--node-radius' as any]: `${localSize / 2}px`
      }}
    >
      {isEditing && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-600/80 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
          {node.label || '按键'}
        </div>
      )}
      
      {/* Control Handles */}
      {isSelected && isEditing && (
        <div className="absolute -right-4 -bottom-4 flex items-center gap-1.5 z-[60] pointer-events-auto">
          {/* Delete Button */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              removeNode(node.id);
            }}
            className="w-8 h-8 bg-red-500/90 border-2 border-white/80 rounded-full flex items-center justify-center cursor-pointer shadow-xl hover:bg-red-600 transition-colors"
            title="删除按键"
          >
            <X className="w-4 h-4 text-white" />
          </motion.div>

          {/* Settings Button - Opens Property Panel */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setShowProperties(true);
            }}
            className="w-8 h-8 bg-slate-800/90 border-2 border-white/80 rounded-full flex items-center justify-center cursor-pointer shadow-xl hover:bg-slate-700 transition-colors"
            title="设置属性"
          >
            <Settings className="w-4 h-4 text-white" />
          </motion.div>

          {/* Resize Handle - Drags to change size */}
          <motion.div
            onPointerDown={(e) => {
              e.stopPropagation();
              setIsDraggingNode(true);
              const startSize = localSize;
              const startX = e.clientX;
              const startY = e.clientY;
              
              const handleMove = (moveEvent: PointerEvent) => {
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                const delta = (dx + dy) * 1.5;
                const newSize = Math.max(20, Math.min(400, startSize + delta));
                setLocalSize(newSize);
              };
              
              const handleUp = () => {
                window.removeEventListener('pointermove', handleMove);
                window.removeEventListener('pointerup', handleUp);
                handleResizeEnd();
              };
              
              window.addEventListener('pointermove', handleMove);
              window.addEventListener('pointerup', handleUp);
            }}
            className="w-8 h-8 bg-blue-600/90 border-2 border-white/80 rounded-full cursor-nwse-resize flex items-center justify-center shadow-xl hover:bg-blue-500 transition-colors"
            title="按住缩放"
          >
            <div className="w-2.5 h-2.5 bg-white rounded-full" />
          </motion.div>
        </div>
      )}

      {children}
    </motion.div>
  );
};
