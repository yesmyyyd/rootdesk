import React, { useEffect } from 'react';
import { useEditor } from './editor-context';
import { VirtualKeyboard } from './virtual-keyboard';
import { ClickNode } from './types';

export const KeymapKeyboardOverlay: React.FC = () => {
  const { 
    config, 
    updateNode, 
    recordingIndex, 
    setRecordingIndex, 
    recordingNodeKey, 
    setRecordingNodeKey 
  } = useEditor();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!recordingIndex && !recordingNodeKey) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      // Ignore modifier keys alone
      if (['Control', 'Shift', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
      
      let key = e.key.toUpperCase();
      if (key === ' ') key = 'SPACE';
      if (key === 'ESCAPE') key = 'ESC';
      if (key === 'BACKSPACE') key = 'BACK';
      if (key === 'DELETE') key = 'DEL';
      if (key === 'ARROWUP') key = 'UP';
      if (key === 'ARROWDOWN') key = 'DOWN';
      if (key === 'ARROWLEFT') key = 'LEFT';
      if (key === 'ARROWRIGHT') key = 'RIGHT';

      handleKeySelect(key);
    };

    if (recordingIndex || recordingNodeKey) {
      window.addEventListener('keydown', handleKeyDown, true);
    }
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [recordingIndex, recordingNodeKey, config.nodes, updateNode]);

  const handleKeySelect = (key: string) => {
    if (recordingIndex) {
      const node = config.nodes.find(n => n.id === recordingIndex.nodeId);
      if (node && node.type === 'click') {
        const clickNode = node as ClickNode;
        const newActions = [...(clickNode.actions || [])];
        newActions[recordingIndex.actionIndex] = { 
          ...newActions[recordingIndex.actionIndex], 
          key 
        };
        updateNode(node.id, { actions: newActions });
      }
      setRecordingIndex(null);
    } else if (recordingNodeKey) {
      const node = config.nodes.find(n => n.id === recordingNodeKey.nodeId);
      if (node) {
        const updates: any = {};
        if (node.type === 'joystick') {
          const keyMap: Record<string, string> = {
            'up': 'keyUp',
            'down': 'keyDown',
            'left': 'keyLeft',
            'right': 'keyRight'
          };
          updates[keyMap[recordingNodeKey.keyType]] = key;
        } else {
          updates['key'] = key;
        }
        updateNode(node.id, updates);
      }
      setRecordingNodeKey(null);
    }
  };

  if (!recordingIndex && !recordingNodeKey) return null;

  return (
    <VirtualKeyboard 
      onKeySelect={handleKeySelect}
      onClose={() => {
        setRecordingIndex(null);
        setRecordingNodeKey(null);
      }}
    />
  );
};
