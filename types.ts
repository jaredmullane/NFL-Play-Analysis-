export interface Position {
  x: number; // 0-120 (yards)
  y: number; // 0-53.3 (yards)
}

export interface Player {
  id: string;
  x: number;
  y: number;
}

export interface Keyframe {
  timeOffset: number; // Seconds from start
  ball: Position;
  teamRed: Player[]; // Offense/Team A
  teamBlue: Player[]; // Defense/Team B
}

export interface AnalysisResult {
  summary: string;
  formation: string;
  playType: string;
  keyframes: Keyframe[];
}

export enum AppState {
  IDLE,
  UPLOADING,
  ANALYZING,
  PLAYBACK,
  ERROR,
}

// Gemini 2.5 Schema Types helper (internal use mostly, but good to type)
export enum GeminiType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  INTEGER = 'INTEGER',
  BOOLEAN = 'BOOLEAN',
  ARRAY = 'ARRAY',
  OBJECT = 'OBJECT',
}