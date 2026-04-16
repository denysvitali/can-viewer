import type { Message, Signal } from "./types.ts";

export interface AppState {
  allSignals: Signal[];
  filtered: Signal[];
  messages: Record<number, Message>;
  sigByKey: Record<string, Signal>;
  rendered: number;
  currentBus: string;
  fileName: string;
}

export const state: AppState = {
  allSignals: [],
  filtered: [],
  messages: {},
  sigByKey: {},
  rendered: 0,
  currentBus: "all",
  fileName: "",
};

export const BATCH = 80;
