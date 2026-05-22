import React, { useRef, useState, useEffect } from 'react';
import { useEditor } from './editor-context';
import { KeyNode } from './types';
import { ClickNodeComponent } from './nodes/click-node';
import { JoystickNodeComponent } from './nodes/joystick-node';
import { SwipeNodeComponent } from './nodes/swipe-node';
import { SkillNodeComponent } from './nodes/skill-node';

export const KeymapCanvas: React.FC = () => {
  const { config, selectNode, selectedNodeId, isEditing } = useEditor();
  const [size, setSize] = useState({ width: 0, height: 0 });
  
  const observerRef = useRef<ResizeObserver | null>(null);
  
  const containerRefCallback = React.useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (node) {
      const observer = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        setSize({ width, height });
      });
      observer.observe(node);
      observerRef.current = observer;
    }
  }, []);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (isEditing && e.target === e.currentTarget) {
      selectNode(null);
    }
  };

  if (!config || !config.nodes) return null;

  return (
    <div 
      ref={containerRefCallback}
      className={`absolute inset-0 w-full h-full pointer-events-none ${isEditing ? 'pointer-events-auto' : ''}`}
      onClick={handleCanvasClick}
    >
      {config.nodes.map(node => {
        const isSelected = selectedNodeId === node.id;
        
        switch (node.type) {
          case 'click':
          case 'fire':
          case 'crosshair':
            return <ClickNodeComponent key={node.id} node={node} isSelected={isSelected} canvasSize={size} />;
          case 'joystick':
            return <JoystickNodeComponent key={node.id} node={node} isSelected={isSelected} canvasSize={size} />;
          case 'swipe':
            return <SwipeNodeComponent key={node.id} node={node as any} isSelected={isSelected} canvasSize={size} />;
          case 'skill':
            return <SkillNodeComponent key={node.id} node={node as any} isSelected={isSelected} canvasSize={size} />;
          default:
            return null;
        }
      })}
    </div>
  );
};
