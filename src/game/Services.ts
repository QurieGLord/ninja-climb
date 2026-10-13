import type { AudioSystem } from '../systems/AudioSystem';
import type { InputSystem } from '../systems/InputSystem';
import type { PauseManager } from '../systems/PauseManager';
import type { ProgressStore } from '../systems/ProgressStore';
import type { PlatformAdapter } from '../sdk/types';
import type { RunSnapshot } from './RunModel';

export interface Services {
  audio: AudioSystem; input: InputSystem; pause: PauseManager;
  store: ProgressStore; platform: PlatformAdapter;
  onReady(): void; onRunUpdate(state: RunSnapshot): void;
  onRunEnd(state: RunSnapshot): void;
}
