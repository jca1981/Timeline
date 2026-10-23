// **** Dato-motor types — se DESIGN.md ****

export type Precision = 'year' | 'month' | 'day' | 'time';

/** Kalender-dato med valgfri præcision. Astronomisk årstal: 1 f.Kr. = 0, 2 f.Kr. = -1. */
export interface DateValue {
  y: number;
  mo?: number; // 1-12
  d?: number;  // 1-31
  h?: number;  // 0-23
  mi?: number; // 0-59
  s?: number;  // 0-59
  precision: Precision;
}

/** Kalender-følsom varighed (år/månedere er ikke faste antal dage). */
export interface Duration {
  y?: number; mo?: number; d?: number; h?: number; mi?: number; s?: number;
}

export interface UncertainDates {
  latestStart?: DateValue;   // senest mulige start
  earliestEnd?: DateValue;   // tidligst mulige slut
}

export interface Span {
  start?: DateValue;
  end?: DateValue;      // intern: EKSKLUSIV øjeblik (inklusiv håndteres i format)
  duration?: Duration;
  ongoing?: boolean;    // "… – nutid"
  uncertain?: UncertainDates;
}

export type DateStyle =
  | { kind: 'absolute' }
  | { kind: 'relative'; unit: 'day' | 'week' | 'time'; zero: DateValue };
