import type { Inventory } from './petTypes';
import type { MuseumQuestId, MuseumRegion, MuseumScale, MuseumTheme, MuseumVisitId } from './museumData';

export interface MuseumHallState { stage: number; invested: number; openedAt?: number }
export interface MuseumQuestState { acceptedAt: number; progress: Record<string, number>; visits?: Partial<Record<MuseumVisitId, number>>; completedAt?: number; delivery?: Inventory }
export interface MuseumDraft { id: number; revision: number; theme: MuseumTheme; scale: MuseumScale; exhibits: string[]; dishes: string[] }
export interface MuseumRecord { id: number; at: number; week: string; weekly: boolean; theme: MuseumTheme; scale: MuseumScale; rating: number; stars: number; exhibits: string[]; dishes: string[]; coins: number; apples: number; portions: number; actorId: string; actorName: string; guestId?: string; guestName: string; message: number }
export interface MuseumAppearance { base: 'none' | 'common' | 'prestige'; plate: 0 | 3 | 30 | 50 | 100; filigree: boolean; ribbon: boolean; crown: boolean; frame: 'none' | 'common' | 'prestige'; badge: 'common' | 'prestige'; title: 'default' | 'companion' | 'keeper' | 'century' | 'curator' }
export interface MuseumState {
  schemaVersion: 1; halls: Record<MuseumRegion, MuseumHallState>; quests: Partial<Record<MuseumQuestId, MuseumQuestState>>;
  board: { week: string; themes: MuseumTheme[] }; draft?: MuseumDraft; nextDraftId: number;
  stars: number; hosted: number; coinsSpent: number; applesSpent: number; lastHostedWeek: string; weeklyPages: number;
  best: Partial<Record<MuseumTheme, { rating: number; exhibits: string[]; dishes: string[] }>>;
  records: MuseumRecord[]; appearance: MuseumAppearance;
}
export interface MuseumTripContext { visitId: MuseumVisitId; acceptedAt: number; startStep: number; step: number }
