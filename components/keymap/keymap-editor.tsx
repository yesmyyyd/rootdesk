import React, { useState, useContext } from 'react';
import { EditorProvider, useEditor, EditorContext } from './editor-context';
import { KeymapCanvas } from './keymap-canvas';
import { KeymapToolbar } from './keymap-toolbar';
import { KeymapProperties } from './keymap-properties';
import { KeymapKeyboardOverlay } from './keymap-keyboard-overlay';
import { Input } from '@/components/ui/input';

interface KeymapEditorProps {
  onSave?: (config: any) => void;
  onClose?: () => void;
  backgroundImage?: string;
  initialConfig?: any;
}

const EditorHeader: React.FC<{ onClose?: () => void, onSave?: (config: any) => void }> = ({ onClose, onSave }) => {
  const { config, setConfig } = useEditor();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(config.name);

  return (
    <div className="h-14 border-b border-slate-800 bg-slate-900/50 px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h2 className="font-bold text-lg">键鼠键位编辑</h2>
        <div className="h-4 w-px bg-slate-700 mx-2" />
        
        {isEditingName ? (
          <Input 
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="h-7 w-48 bg-slate-800 border-slate-600 text-xs text-white"
            autoFocus
            onBlur={() => {
              setIsEditingName(false);
              if (nameInput.trim()) {
                setConfig({ ...config, name: nameInput.trim() });
              } else {
                setNameInput(config.name);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
          />
        ) : (
          <div 
            className="text-sm text-slate-300 hover:text-white cursor-pointer px-2 py-1 rounded hover:bg-slate-800 transition-colors"
            onClick={() => setIsEditingName(true)}
            title="点击修改方案名称"
          >
            方案名称: <span className="font-semibold text-blue-400">{config.name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button 
          className="px-4 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 rounded transition-colors"
          onClick={onClose}
        >
          取消
        </button>
        <button 
          className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded font-medium transition-colors"
          onClick={() => onSave?.(config)}
        >
          保存
        </button>
      </div>
    </div>
  );
};

const EditorContent: React.FC<KeymapEditorProps> = ({ onSave, onClose, backgroundImage }) => {
  const { config } = useEditor();
  const aspectRatio = config.gameResolution ? `${config.gameResolution.width}/${config.gameResolution.height}` : '16/9';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 text-white font-sans overflow-hidden">
      <EditorHeader onClose={onClose} onSave={onSave} />

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Toolbar */}
        <div className="absolute left-4 top-4 z-50">
          <KeymapToolbar />
        </div>

        {/* Center Canvas */}
        <div className="flex-1 relative bg-slate-900 overflow-hidden flex items-center justify-center">
          {/* The game screen area where keys are placed */}
          <div 
            className="relative bg-black shadow-2xl border border-slate-800"
            style={{
              width: '85%', // scaled for preview
              aspectRatio: aspectRatio,
              backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center'
            }}
          >
            {!backgroundImage && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-700 pointer-events-none">
                游戏画面预览区域
              </div>
            )}
            
            <KeymapCanvas />
          </div>
        </div>

        {/* Right Properties Panel */}
        <div className="z-50 shrink-0 shadow-[-4px_0_15px_rgba(0,0,0,0.5)] h-full">
          <KeymapProperties />
        </div>

      </div>
      
      {/* Global Overlays */}
      <KeymapKeyboardOverlay />
    </div>
  );
};

export const KeymapEditor: React.FC<KeymapEditorProps> = (props) => {
  const context = useContext(EditorContext);
  
  if (context) {
    return <EditorContent {...props} />;
  }
  
  return (
    <EditorProvider value={props.initialConfig}>
      <EditorContent {...props} />
    </EditorProvider>
  );
};
