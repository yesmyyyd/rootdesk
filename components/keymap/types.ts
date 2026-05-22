export type KeyNodeType = 'click' | 'joystick' | 'continuous' | 'swipe' | 'crosshair' | 'view' | 'skill' | 'fire';

export interface BaseNode {
  id: string;
  type: KeyNodeType;
  x: number; // UI position X (percentage)
  y: number; // UI position Y (percentage)
  size?: number; // Visual size in pixels (for UI layer)
  label?: string; // Custom label/remark for the node
}

export interface ClickAction {
  type: 'click' | 'delay';
  key?: string;      // 对应 click 类型 (如 'A', 'LButton', 'RButton')
  delay?: number;    // 对应 delay 类型
  x?: number;        // 绝对坐标 X (px)
  y?: number;        // 绝对坐标 Y (px)
}

export interface ClickNode extends BaseNode {
  type: 'click';
  key: string;       // 默认主按键（用于显示）
  actions?: ClickAction[]; // 组合点击动作序列
}

export interface JoystickNode extends BaseNode {
  type: 'joystick';
  radius: number;
  keyUp: string;
  keyDown: string;
  keyLeft: string;
  keyRight: string;
  controlType: 'swipe' | 'click' | 'penetrate';
}

export interface ContinuousClickNode extends BaseNode {
  type: 'continuous';
  key: string;
  count: number;
  mode: 'hold' | 'after_click';
}

export interface SwipeNode extends BaseNode {
  type: 'swipe';
  key: string;
  endX: number;
  endY: number;
  straight: boolean;
  delayStart: number;
}

export interface CrosshairNode extends BaseNode {
  type: 'crosshair';
  key: string; // typically mouse
  sensitivity: number;
  mode?: 'direct' | 'click'; // direct = move only, click = click and hold then move
  button?: 'left' | 'right' | 'middle';
}

export interface FireNode extends BaseNode {
  type: 'fire';
  key: 'LButton';
}

export interface ViewNode extends BaseNode {
  type: 'view';
  key: string;
  sensitivity: number;
}

export interface SkillNode extends BaseNode {
  type: 'skill';
  key: string;
  castType: 'release' | 'immediate' | 'manual';
  castRadius: number;
  cancelX?: number;
  cancelY?: number;
}

export type KeyNode = 
  | ClickNode 
  | JoystickNode 
  | ContinuousClickNode 
  | SwipeNode 
  | CrosshairNode 
  | FireNode 
  | ViewNode 
  | SkillNode;

export interface KeymapConfig {
  id: string;
  name: string;
  nodes: KeyNode[];
  gameResolution: { width: number; height: number };
}
