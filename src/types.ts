// Shape of a single entry in the signal JSON database.
export type Endianness = "LITTLE" | "BIG";
export type Signedness = "SIGNED" | "UNSIGNED";

export interface SignalDefinition {
  StartPosition?: number;
  Width?: number;
  Endianness?: Endianness;
  Signedness?: Signedness;
  Scale?: number;
  Offset?: number;
  ClearMask?: number;
  Units?: string;
}

export interface MuxSignal {
  [key: string]: unknown;
}

export interface RawSignal {
  ID: number;
  Bus: number;
  BusName: string;
  MessageName: string;
  Name?: string;
  CycleTime?: number;
  Units?: string;
  Signal?: SignalDefinition;
  MuxSignal?: MuxSignal;
  MuxID?: number;
  Muxer?: string;
  ValueDescription?: Record<string, string>;
}

export interface Signal extends RawSignal {
  key: string;
}

export interface Message {
  id: number;
  name: string;
  bus: string;
  busNum: number;
  cycleTime?: number;
  signals: string[];
}

export type SignalDatabase = Record<string, RawSignal>;
