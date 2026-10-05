import type { ReactNode } from 'react';
import type { BlockState } from './blocks/rules';
import type { WaterState } from './water/rules';
import type { FruitState } from './fruit/state';
import type { Match3State } from './match3/rules';
import type { HubGameId } from './catalog';

export interface GameStates { blocks: BlockState; water: WaterState; fruit: FruitState; match3: Match3State; }
export type GameId = keyof GameStates;
export interface MiniGamesSave { schemaVersion: 1; activeGame: GameId; sound: boolean; games: GameStates; reportedSessions: string[]; }
export interface GameResult { game: GameId; sessionId: string; outcome: 'complete' | 'over'; score: number; }
export interface CompanionArtwork { name: string; idle: string; happy: string; }
export interface MiniGameHost {
  companion?: CompanionArtwork;
  load?: () => unknown;
  save?: (snapshot: MiniGamesSave) => void;
  onResult?: (result: GameResult) => void;
}
export type FeedbackSound = 'place' | 'clear' | 'pour' | 'win';
export interface CommonGameProps {
  active: boolean;
  paused: boolean;
  feedback: (text: string, sound?: FeedbackSound) => void;
  complete: (result: GameResult) => void;
}
export interface GameProps<K extends GameId> extends CommonGameProps { state: GameStates[K]; onChange: (state: GameStates[K]) => void; }
export interface GameDefinition {
  id: HubGameId;
  name: string;
  subtitle: string;
  icon: 'blocks' | 'bottle' | 'fruit' | 'grid';
  welcome: string;
  instructions: { title: string; body: string }[];
  tip: string;
  render: (props: CommonGameProps, states: GameStates, change: <K extends GameId>(id: K, expectedSession: string, state: GameStates[K]) => void) => ReactNode;
}
