export type FeedKind = "breast" | "bottle" | "solid" | "snack";

export interface FeedEntry {
  id: number;
  baby_name: string;
  kind: FeedKind;
  food: string;
  amount: string;
  mood: string;
  notes: string;
  fed_at: string;
  created_at: string;
}

export type NewFeedEntry = Omit<FeedEntry, "id" | "created_at">;

export interface Insights {
  totalAll: number;
  totalToday: number;
  byKind: Record<string, number>;
  lastFedAt: string | null;
  message: string;
  source: "ai" | "local";
}
