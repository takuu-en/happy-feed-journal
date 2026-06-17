export type FeedKind = "breast" | "formula" | "solid" | "snack";

export const FEED_KINDS: { value: FeedKind; label: string; emoji: string }[] = [
  { value: "breast", label: "Breast milk", emoji: "🤱" },
  { value: "formula", label: "Formula", emoji: "🍼" },
  { value: "solid", label: "Solid food", emoji: "🥣" },
  { value: "snack", label: "Snack", emoji: "🍎" },
];

export interface Profile {
  id: string;
  display_name: string;
}

export interface Family {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface FamilyMember {
  family_id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles?: Profile;
}

export interface Baby {
  id: string;
  family_id: string;
  name: string;
  birthdate: string | null;
  avatar_emoji: string;
  created_at: string;
}

export interface FeedingItem {
  id?: string;
  feeding_id?: string;
  food: string;
  amount: number | null;
  unit: string;
}

export interface Feeding {
  id: string;
  baby_id: string;
  kind: FeedKind;
  food: string;
  amount: number | null;
  unit: string;
  notes: string;
  source: "voice" | "manual";
  fed_at: string;
  created_by: string;
  created_at: string;
  // Formula
  brand: string;
  scoops: number | null;
  // Breast
  left_duration_min: number | null;
  right_duration_min: number | null;
  // Solid / snack items (embedded via PostgREST)
  feeding_items?: FeedingItem[];
}

export interface ParsedItem {
  food: string;
  amount: number | null;
  unit: string;
}

export interface ParsedFeeding {
  kind: FeedKind;
  food: string;
  amount: number | null;
  unit: string;
  fed_at: string | null;
  notes: string;
  brand: string;
  scoops: number | null;
  left_duration_min: number | null;
  right_duration_min: number | null;
  items: ParsedItem[];
}
