import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { KeyNode, KeymapConfig } from './types';

interface EditorContextState {
  config: KeymapConfig;
  selectedNodeId: string | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  addNode: (node: KeyNode) => void;
  updateNode: (id: string, updates: Partial<KeyNode>) => void;
  removeNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  setConfig: (config: KeymapConfig) => void;
  isEditing: boolean;
  onNodeAction?: (node: KeyNode, action: 'down' | 'up' | 'move', extra?: any) => void;
  isDraggingNode: boolean;
  setIsDraggingNode: (dragging: boolean) => void;
  showProperties: boolean;
  setShowProperties: (show: boolean) => void;
  executingNodeId: string | null;
  setExecutingNodeId: (id: string | null) => void;
  recordingIndex: { nodeId: string, actionIndex: number } | null;
  setRecordingIndex: (recording: { nodeId: string, actionIndex: number } | null) => void;
  recordingNodeKey: { nodeId: string, keyType: string } | null;
  setRecordingNodeKey: (recording: { nodeId: string, keyType: string } | null) => void;
}

export const EditorContext = createContext<EditorContextState | null>(null);

export const EditorProvider: React.FC<{ 
  children: React.ReactNode, 
  value?: KeymapConfig | null, 
  onChange?: (config: KeymapConfig) => void,
  isEditing?: boolean,
  onNodeAction?: (node: KeyNode, action: 'down' | 'up' | 'move', extra?: any) => void,
  isDraggingNode?: boolean,
  setIsDraggingNode?: (dragging: boolean) => void,
  selectedNodeId?: string | null,
  onSelectNode?: (id: string | null) => void,
  showProperties?: boolean,
  onShowPropertiesChange?: (show: boolean) => void,
  executingNodeId?: string | null,
  setExecutingNodeId?: (id: string | null) => void
}> = ({ 
  children, 
  value, 
  onChange, 
  isEditing = true, 
  onNodeAction,
  isDraggingNode: externalIsDraggingNode,
  setIsDraggingNode: externalSetIsDraggingNode,
  selectedNodeId: externalSelectedNodeId,
  onSelectNode: externalOnSelectNode,
  showProperties: externalShowProperties,
  onShowPropertiesChange: externalOnShowPropertiesChange,
  executingNodeId: externalExecutingNodeId,
  setExecutingNodeId: externalSetExecutingNodeId
}) => {
  const [internalConfig, setInternalConfig] = useState<KeymapConfig>({
    id: 'default',
    name: 'Default',
    nodes: [],
    gameResolution: { width: 1920, height: 1080 }
  });

  const config = value || internalConfig;
  const [internalIsDraggingNode, internalSetIsDraggingNode] = useState(false);
  const isDraggingNode = externalIsDraggingNode ?? internalIsDraggingNode;
  const setIsDraggingNode = externalSetIsDraggingNode ?? internalSetIsDraggingNode;

  const [internalSelectedNodeId, internalSetSelectedNodeId] = useState<string | null>(null);
  const selectedNodeId = externalSelectedNodeId ?? internalSelectedNodeId;
  const setSelectedNodeId = externalOnSelectNode ?? internalSetSelectedNodeId;

  const [internalShowProperties, internalSetShowProperties] = useState(false);
  const showProperties = externalShowProperties ?? internalShowProperties;
  const setShowProperties = externalOnShowPropertiesChange ?? internalSetShowProperties;

  const [internalExecutingNodeId, internalSetExecutingNodeId] = useState<string | null>(null);
  const executingNodeId = externalExecutingNodeId ?? internalExecutingNodeId;
  const setExecutingNodeId = externalSetExecutingNodeId ?? internalSetExecutingNodeId;

  const [recordingIndex, setRecordingIndex] = useState<{ nodeId: string, actionIndex: number } | null>(null);
  const [recordingNodeKey, setRecordingNodeKey] = useState<{ nodeId: string, keyType: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const setConfig = useCallback((newConfig: KeymapConfig | ((prev: KeymapConfig) => KeymapConfig)) => {
    if (typeof newConfig === 'function') {
      const next = newConfig(config);
      setInternalConfig(next);
      onChange?.(next);
    } else {
      setInternalConfig(newConfig);
      onChange?.(newConfig);
    }
  }, [config, onChange]);

  const addNode = useCallback((node: KeyNode) => {
    setConfig(prev => ({ ...prev, nodes: [...prev.nodes, node] }));
    setSelectedNodeId(node.id);
    setShowProperties(false);
  }, [setConfig, setSelectedNodeId, setShowProperties]);

  const updateNode = useCallback((id: string, updates: Partial<KeyNode>) => {
    setConfig(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === id ? { ...n, ...updates } as KeyNode : n)
    }));
  }, [setConfig]);

  const removeNode = useCallback((id: string) => {
    setConfig(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== id)
    }));
    setSelectedNodeId(null);
    setShowProperties(false);
  }, [setConfig, setSelectedNodeId, setShowProperties]);

  const selectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
    if (id === null) setShowProperties(false);
  }, [setSelectedNodeId, setShowProperties]);

  return (
    <EditorContext.Provider value={{
      config,
      selectedNodeId,
      containerRef,
      addNode,
      updateNode,
      removeNode,
      selectNode,
      setConfig,
      isEditing,
      onNodeAction,
      isDraggingNode,
      setIsDraggingNode,
      showProperties,
      setShowProperties,
      executingNodeId,
      setExecutingNodeId,
      recordingIndex,
      setRecordingIndex,
      recordingNodeKey,
      setRecordingNodeKey
    }}>
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
};
