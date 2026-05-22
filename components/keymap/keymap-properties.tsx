import React from 'react';
import { useEditor } from './editor-context';
import { KeyNode, JoystickNode, ClickNode, CrosshairNode, SwipeNode, SkillNode, ClickAction } from './types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, X, Plus, ArrowUp, ArrowDown, GripVertical, Clock, MousePointer2, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';

export const KeymapProperties: React.FC = () => {
  const { 
    config, 
    selectedNodeId, 
    updateNode, 
    removeNode, 
    selectNode,
    recordingIndex,
    setRecordingIndex,
    recordingNodeKey,
    setRecordingNodeKey
  } = useEditor();
  
  const selectedNode = config.nodes.find(n => n.id === selectedNodeId);

  if (!selectedNode) {
    return null;
  }

  const renderKeyButton = (key: string | undefined, isRecording: boolean, onClick: () => void) => {
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full h-8 flex items-center justify-between px-3 rounded-lg border transition-all text-[11px] font-medium",
          isRecording 
            ? "bg-blue-500/10 border-blue-500 text-blue-400 ring-1 ring-blue-500/50" 
            : "bg-slate-800 border-slate-700 text-white hover:border-slate-500"
        )}
      >
        <span>{isRecording ? '等待按键...' : (key || '未设置')}</span>
        <Keyboard className={cn("w-3 h-3 transition-colors", isRecording ? "text-blue-400" : "text-slate-500")} />
      </button>
    );
  };


  const renderNodeProperties = () => {
    switch (selectedNode.type) {
      case 'click':
        const clickNode = selectedNode as ClickNode;
        const actions = clickNode.actions || [{ type: 'click', key: clickNode.key }];

        const updateActions = (newActions: ClickAction[]) => {
           updateNode(selectedNode.id, { actions: newActions });
         };

        const addAction = () => {
          updateActions([...actions, { type: 'click', key: 'A' }]);
        };

        const removeAction = (index: number) => {
          if (actions.length <= 1) return;
          const newActions = [...actions];
          newActions.splice(index, 1);
          updateActions(newActions);
        };

        const moveAction = (index: number, direction: 'up' | 'down') => {
          const newIndex = direction === 'up' ? index - 1 : index + 1;
          if (newIndex < 0 || newIndex >= actions.length) return;
          const newActions = [...actions];
          const [moved] = newActions.splice(index, 1);
          newActions.splice(newIndex, 0, moved);
          updateActions(newActions);
        };

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-slate-200">组合动作序列</Label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={addAction}
                className="h-7 px-2 bg-slate-800 border-slate-700 text-blue-400 hover:text-blue-300 hover:bg-slate-700"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                添加动作
              </Button>
            </div>

            <div className="space-y-3">
              {actions.map((action, index) => (
                <div key={index} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2.5 space-y-2.5 relative group">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5">
                      <button 
                        disabled={index === 0}
                        onClick={() => moveAction(index, 'up')}
                        className="p-0.5 hover:bg-slate-700 rounded disabled:opacity-10 text-slate-500 hover:text-white"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button 
                        disabled={index === actions.length - 1}
                        onClick={() => moveAction(index, 'down')}
                        className="p-0.5 hover:bg-slate-700 rounded disabled:opacity-10 text-slate-500 hover:text-white"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Select 
                        value={action.type} 
                        onValueChange={(val: any) => {
                          const newActions = [...actions];
                          newActions[index] = { ...newActions[index], type: val };
                          if (val === 'click' && !newActions[index].key) newActions[index].key = 'A';
                          if (val === 'delay' && !newActions[index].delay) newActions[index].delay = 100;
                          updateActions(newActions);
                        }}
                      >
                        <SelectTrigger className="h-8 bg-slate-900/50 border-slate-700 text-[11px] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[110]">
                          <SelectItem value="click">按键点击</SelectItem>
                          <SelectItem value="delay">等待延迟</SelectItem>
                        </SelectContent>
                      </Select>

                      {action.type === 'click' ? (
                        <Select 
                        value={(action.key?.startsWith('Mouse') || ['LButton', 'RButton', 'MButton'].includes(action.key || '')) ? 'mouse' : 'keyboard'} 
                        onValueChange={(val) => {
                          const newActions = [...actions];
                          const defaultX = Math.round((selectedNode.x / 100) * (config.gameResolution?.width || 1920));
                          const defaultY = Math.round((selectedNode.y / 100) * (config.gameResolution?.height || 1080));
                          
                          newActions[index] = { 
                            ...newActions[index], 
                            key: val === 'mouse' ? 'LButton' : 'A',
                            x: val === 'mouse' ? defaultX : undefined,
                            y: val === 'mouse' ? defaultY : undefined
                          };
                          updateActions(newActions);
                        }}
                      >
                          <SelectTrigger className="h-8 bg-slate-900/50 border-slate-700 text-[11px] text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[110]">
                            <SelectItem value="keyboard">键盘</SelectItem>
                            <SelectItem value="mouse">鼠标</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2 bg-slate-900/30 rounded border border-slate-800 h-8">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">DELAY</span>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={() => removeAction(index)}
                      className="p-1.5 hover:bg-red-500/10 text-slate-600 hover:text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {action.type === 'click' ? (
                        <div className="pl-5 space-y-2">
                          {(action.key?.startsWith('Mouse') || ['LButton', 'RButton', 'MButton'].includes(action.key || '')) ? (
                            <>
                              <Select 
                                value={action.key} 
                                onValueChange={(val) => {
                                  const newActions = [...actions];
                                  newActions[index] = { ...newActions[index], key: val };
                                  updateActions(newActions);
                                }}
                              >
                                <SelectTrigger className="h-8 bg-slate-800 border-slate-700 text-[11px] text-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="z-[110]">
                                  <SelectItem value="LButton">左键 (Left)</SelectItem>
                                  <SelectItem value="RButton">右键 (Right)</SelectItem>
                                  <SelectItem value="MButton">中键 (Middle)</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-slate-400 uppercase font-bold">坐标 X (px)</Label>
                                  <Input 
                                    type="number"
                                    value={action.x ?? 960} 
                                    onChange={(e) => {
                                      const newActions = [...actions];
                                      newActions[index] = { ...newActions[index], x: parseInt(e.target.value) || 0 };
                                      updateActions(newActions);
                                    }}
                                    className="h-7 bg-slate-900/50 border-slate-700 text-[10px] text-white"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-slate-400 uppercase font-bold">坐标 Y (px)</Label>
                                  <Input 
                                    type="number"
                                    value={action.y ?? 540} 
                                    onChange={(e) => {
                                      const newActions = [...actions];
                                      newActions[index] = { ...newActions[index], y: parseInt(e.target.value) || 0 };
                                      updateActions(newActions);
                                    }}
                                    className="h-7 bg-slate-900/50 border-slate-700 text-[10px] text-white"
                                  />
                                </div>
                              </div>
                              <div className="text-[8px] text-slate-500 font-medium">参考分辨率: {config.gameResolution.width}x{config.gameResolution.height}</div>
                            </>
                          ) : (
                            <div className="space-y-1">
                              {renderKeyButton(
                                action.key,
                                recordingIndex?.nodeId === selectedNode.id && recordingIndex?.actionIndex === index,
                                () => setRecordingIndex({ nodeId: selectedNode.id, actionIndex: index })
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                    <div className="pl-5 flex items-center gap-2">
                      <div className="relative flex-1">
                        <Input 
                          type="number"
                          value={action.delay} 
                          onChange={(e) => {
                            const newActions = [...actions];
                            newActions[index] = { ...newActions[index], delay: parseInt(e.target.value) || 0 };
                            updateActions(newActions);
                          }}
                          className="h-8 bg-slate-800 border-slate-700 text-[11px] text-white pr-8"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-bold uppercase">ms</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'joystick':
        const joystickNode = selectedNode as JoystickNode;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">上 (Up)</Label>
                {renderKeyButton(
                  joystickNode.keyUp,
                  recordingNodeKey?.nodeId === selectedNode.id && recordingNodeKey?.keyType === 'up',
                  () => setRecordingNodeKey({ nodeId: selectedNode.id, keyType: 'up' })
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">下 (Down)</Label>
                {renderKeyButton(
                  joystickNode.keyDown,
                  recordingNodeKey?.nodeId === selectedNode.id && recordingNodeKey?.keyType === 'down',
                  () => setRecordingNodeKey({ nodeId: selectedNode.id, keyType: 'down' })
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">左 (Left)</Label>
                {renderKeyButton(
                  joystickNode.keyLeft,
                  recordingNodeKey?.nodeId === selectedNode.id && recordingNodeKey?.keyType === 'left',
                  () => setRecordingNodeKey({ nodeId: selectedNode.id, keyType: 'left' })
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">右 (Right)</Label>
                {renderKeyButton(
                  joystickNode.keyRight,
                  recordingNodeKey?.nodeId === selectedNode.id && recordingNodeKey?.keyType === 'right',
                  () => setRecordingNodeKey({ nodeId: selectedNode.id, keyType: 'right' })
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Label className="text-slate-200">操作方式</Label>
              <Select 
                value={joystickNode.controlType} 
                onValueChange={(val: any) => updateNode(selectedNode.id, { controlType: val })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  <SelectItem value="swipe">滑动控制</SelectItem>
                  <SelectItem value="click">点击控制</SelectItem>
                  <SelectItem value="penetrate">穿透</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'crosshair':
        const crosshairNode = selectedNode as CrosshairNode;
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-200">呼出指针按键</Label>
              {renderKeyButton(
                crosshairNode.key,
                recordingNodeKey?.nodeId === selectedNode.id && recordingNodeKey?.keyType === 'crosshair',
                () => setRecordingNodeKey({ nodeId: selectedNode.id, keyType: 'crosshair' })
              )}
            </div>
            
            <div className="space-y-2 pt-2">
              <Label className="text-slate-200">操作模式</Label>
              <Select 
                value={crosshairNode.mode || 'direct'} 
                onValueChange={(val: any) => updateNode(selectedNode.id, { mode: val })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  <SelectItem value="direct">直接移动 (不点击)</SelectItem>
                  <SelectItem value="click">点击移动 (按住移动)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(crosshairNode.mode === 'click') && (
              <div className="space-y-2 pt-2">
                <Label className="text-slate-200">点击按键</Label>
                <Select 
                  value={crosshairNode.button || 'left'} 
                  onValueChange={(val: any) => updateNode(selectedNode.id, { button: val })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[110]">
                    <SelectItem value="left">鼠标左键</SelectItem>
                    <SelectItem value="right">鼠标右键</SelectItem>
                    <SelectItem value="middle">鼠标中键</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <Label className="text-slate-200">灵敏度 ({crosshairNode.sensitivity}%)</Label>
              <Slider 
                value={[crosshairNode.sensitivity]} 
                min={1} max={500} step={1}
                onValueChange={(val) => updateNode(selectedNode.id, { sensitivity: val[0] })}
              />
            </div>
          </div>
        );

      case 'fire':
        return (
          <div className="space-y-4">
            <div className="p-3 bg-slate-800/50 rounded text-sm text-slate-300">
              开火键绑定为鼠标左键，需要配合准星键使用。
            </div>
          </div>
        );

      case 'swipe':
        const swipeNode = selectedNode as SwipeNode;
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-200">触发按键</Label>
              {renderKeyButton(
                swipeNode.key,
                recordingNodeKey?.nodeId === selectedNode.id && recordingNodeKey?.keyType === 'swipe',
                () => setRecordingNodeKey({ nodeId: selectedNode.id, keyType: 'swipe' })
              )}
            </div>
            {/* Note: Swipe requires defining endX and endY, visually it's a line but here we just show basic props */}
            <div className="space-y-2 pt-2">
              <Label className="text-slate-200 flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={swipeNode.straight}
                  onChange={(e) => updateNode(selectedNode.id, { straight: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-600"
                />
                直线轨迹
              </Label>
            </div>
          </div>
        );

      case 'skill':
        const skillNode = selectedNode as SkillNode;
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-200">施法按键</Label>
              {renderKeyButton(
                skillNode.key,
                recordingNodeKey?.nodeId === selectedNode.id && recordingNodeKey?.keyType === 'skill',
                () => setRecordingNodeKey({ nodeId: selectedNode.id, keyType: 'skill' })
              )}
            </div>
            
            <div className="space-y-2 pt-2">
              <Label className="text-slate-200">施法时机</Label>
              <Select 
                value={skillNode.castType} 
                onValueChange={(val: any) => updateNode(selectedNode.id, { castType: val })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  <SelectItem value="release">松开释放</SelectItem>
                  <SelectItem value="immediate">立即释放</SelectItem>
                  <SelectItem value="manual">手动释放</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 pt-2">
              <Label className="text-slate-200">施法轮盘半径</Label>
              <Slider 
                value={[skillNode.castRadius]} 
                min={20} max={150} step={1}
                onValueChange={(val) => updateNode(selectedNode.id, { castRadius: val[0] })}
              />
            </div>
          </div>
        );

      case 'continuous':
        const continuousNode = selectedNode as any; // ContinuousClickNode
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-200">触发按键</Label>
              {renderKeyButton(
                continuousNode.key,
                recordingNodeKey?.nodeId === selectedNode.id && recordingNodeKey?.keyType === 'continuous',
                () => setRecordingNodeKey({ nodeId: selectedNode.id, keyType: 'continuous' })
              )}
            </div>
            <div className="space-y-2 pt-2">
              <Label className="text-slate-200">连点频率 (次/秒)</Label>
              <Slider 
                value={[continuousNode.count || 10]} 
                min={1} max={50} step={1}
                onValueChange={(val) => updateNode(selectedNode.id, { count: val[0] })}
              />
            </div>
          </div>
        );

      case 'view':
        const viewNode = selectedNode as any; // ViewNode
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-200">视角控制按键</Label>
              {renderKeyButton(
                viewNode.key,
                recordingNodeKey?.nodeId === selectedNode.id && recordingNodeKey?.keyType === 'view',
                () => setRecordingNodeKey({ nodeId: selectedNode.id, keyType: 'view' })
              )}
            </div>
            <div className="space-y-2 pt-2">
              <Label className="text-slate-200">视角灵敏度 ({viewNode.sensitivity}%)</Label>
              <Slider 
                value={[viewNode.sensitivity || 100]} 
                min={1} max={500} step={1}
                onValueChange={(val) => updateNode(selectedNode.id, { sensitivity: val[0] })}
              />
            </div>
          </div>
        );


      default:
        return <div className="text-slate-400 text-sm">此节点类型暂无专属属性。</div>;
    }
  };

  return (
    <div 
      className="w-full sm:w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700 p-4 sm:p-5 flex flex-col h-full sm:h-auto rounded-xl sm:rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4 sm:mb-6 pb-2 sm:pb-3 border-b border-slate-800">
        <div className="flex flex-col">
          <h3 className="font-bold text-white text-xs sm:text-sm">属性设置</h3>
          <span className="text-[9px] sm:text-[10px] text-blue-400 font-bold uppercase tracking-wider">
            {selectedNode.type}
          </span>
        </div>
        <button 
          onClick={() => selectNode(null)}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar max-h-[50vh] sm:max-h-none">
        <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
          <div className="space-y-1.5 sm:space-y-2">
            <Label className="text-slate-400 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider">备注名称</Label>
            <Input 
              value={selectedNode.label || ''} 
              placeholder="输入按键备注..."
              onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
              className="bg-slate-800 border-slate-600 text-white h-7 sm:h-8 text-[10px] sm:text-xs"
            />
          </div>

          <div className="space-y-2 sm:space-y-3">
            <Label className="text-slate-400 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider">
              {selectedNode.type === 'joystick' ? '摇杆半径' : '按键尺寸'}
            </Label>
            <Slider 
              value={[
                (selectedNode.size || (selectedNode.type === 'joystick' ? (selectedNode as JoystickNode).radius * 2 : 48))
              ]} 
              min={20} max={400} step={1}
              onValueChange={(val) => {
                if (selectedNode.type === 'joystick') {
                  updateNode(selectedNode.id, { radius: val[0] / 2, size: val[0] });
                } else {
                  updateNode(selectedNode.id, { size: val[0] });
                }
              }}
              className="py-1 sm:py-2"
            />
          </div>
        </div>
        
        <div className="pt-1 sm:pt-2">
          {renderNodeProperties()}
        </div>
      </div>

      <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-800">
        <Button 
          variant="destructive" 
          className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 h-8 sm:h-10 rounded-lg sm:rounded-xl transition-all text-xs sm:text-sm"
          onClick={() => removeNode(selectedNode.id)}
        >
          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
          删除此键位
        </Button>
      </div>
    </div>
  );
};
