import React from 'react';
import { useEditor } from './editor-context';
import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  MousePointer2, 
  Gamepad2, 
  Crosshair, 
  Target,
  Navigation,
  Zap
} from 'lucide-react';

const generateId = () => Math.random().toString(36).substring(2, 9);

export const KeymapToolbar: React.FC = () => {
  const { addNode } = useEditor();

  const handleAddClick = () => {
    addNode({
      id: generateId(),
      type: 'click',
      x: 50,
      y: 50,
      size: 48,
      key: 'A'
    });
  };

  const handleAddJoystick = () => {
    addNode({
      id: generateId(),
      type: 'joystick',
      x: 50,
      y: 50,
      size: 120,
      radius: 60,
      keyUp: 'W',
      keyDown: 'S',
      keyLeft: 'A',
      keyRight: 'D',
      controlType: 'swipe'
    });
  };

  const handleAddCrosshair = () => {
    addNode({
      id: generateId(),
      type: 'crosshair',
      x: 50,
      y: 50,
      size: 48,
      key: 'MouseRight',
      sensitivity: 100
    });
  };

  const handleAddFire = () => {
    addNode({
      id: generateId(),
      type: 'fire',
      x: 50,
      y: 50,
      size: 48,
      key: 'LButton'
    });
  };

  const handleAddSwipe = () => {
    addNode({
      id: generateId(),
      type: 'swipe',
      x: 50,
      y: 50,
      size: 48,
      key: 'Shift',
      endX: 60,
      endY: 40,
      straight: true,
      delayStart: 0
    });
  };

  const handleAddSkill = () => {
    addNode({
      id: generateId(),
      type: 'skill',
      x: 50,
      y: 50,
      size: 48,
      key: 'Q',
      castType: 'release',
      castRadius: 50
    });
  };

  return (
    <div className="flex flex-col gap-2 sm:gap-3 p-1.5 sm:p-2.5 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl sm:rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-white w-auto sm:w-[52px] items-center">
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center gap-0.5 sm:gap-1 group cursor-pointer shrink-0" onClick={handleAddClick}>
              <Button variant="ghost" size="icon" className="group-hover:bg-blue-500/20 rounded-lg sm:rounded-xl h-8 w-8 sm:h-10 sm:w-10 transition-all active:scale-90">
                <MousePointer2 className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-blue-400 group-hover:text-blue-300" />
              </Button>
              <span className="text-[7px] sm:text-[10px] text-slate-400 group-hover:text-blue-300 font-medium">点击</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">普通点击</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center gap-0.5 sm:gap-1 group cursor-pointer shrink-0" onClick={handleAddJoystick}>
              <Button variant="ghost" size="icon" className="group-hover:bg-green-500/20 rounded-lg sm:rounded-xl h-8 w-8 sm:h-10 sm:w-10 transition-all active:scale-90">
                <Gamepad2 className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-green-400 group-hover:text-green-300" />
              </Button>
              <span className="text-[7px] sm:text-[10px] text-slate-400 group-hover:text-green-300 font-medium">摇杆</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">方向摇杆</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center gap-0.5 sm:gap-1 group cursor-pointer shrink-0" onClick={handleAddCrosshair}>
              <Button variant="ghost" size="icon" className="group-hover:bg-purple-500/20 rounded-lg sm:rounded-xl h-8 w-8 sm:h-10 sm:w-10 transition-all active:scale-90">
                <Crosshair className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-purple-400 group-hover:text-purple-300" />
              </Button>
              <span className="text-[7px] sm:text-[10px] text-slate-400 group-hover:text-purple-300 font-medium">准星</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">准星键</TooltipContent>
        </Tooltip>

        {/* <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center gap-0.5 sm:gap-1 group cursor-pointer shrink-0" onClick={handleAddFire}>
              <Button variant="ghost" size="icon" className="group-hover:bg-red-500/20 rounded-lg sm:rounded-xl h-8 w-8 sm:h-10 sm:w-10 transition-all active:scale-90">
                <Target className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-red-400 group-hover:text-red-300" />
              </Button>
              <span className="text-[7px] sm:text-[10px] text-slate-400 group-hover:text-red-300 font-medium">开火</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">开火键</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center gap-0.5 sm:gap-1 group cursor-pointer shrink-0" onClick={handleAddSwipe}>
              <Button variant="ghost" size="icon" className="group-hover:bg-orange-500/20 rounded-lg sm:rounded-xl h-8 w-8 sm:h-10 sm:w-10 transition-all active:scale-90">
                <Navigation className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-orange-400 group-hover:text-orange-300" />
              </Button>
              <span className="text-[7px] sm:text-[10px] text-slate-400 group-hover:text-orange-300 font-medium">滑动</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">滑动轨迹</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center gap-0.5 sm:gap-1 group cursor-pointer shrink-0" onClick={handleAddSkill}>
              <Button variant="ghost" size="icon" className="group-hover:bg-yellow-500/20 rounded-lg sm:rounded-xl h-8 w-8 sm:h-10 sm:w-10 transition-all active:scale-90">
                <Zap className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-yellow-400 group-hover:text-yellow-300" />
              </Button>
              <span className="text-[7px] sm:text-[10px] text-slate-400 group-hover:text-yellow-300 font-medium">技能</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">技能施法</TooltipContent>
        </Tooltip> */}
      </TooltipProvider>
    </div>
  );
};
