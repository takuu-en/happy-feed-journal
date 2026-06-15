"use client";

import { useCallback, useEffect, useState } from "react";
import type { FeedEntry, FeedKind, Insights } from "@/lib/types";

const KIND_OPTIONS: { value: FeedKind; label: string; emoji: string }[] = [
  { value: "breast", label: "Breast", emoji: "🤱" },
  { value: "bottle", label: "Bottle", emoji: "🍼" },
  { value: "solid", label: "Solid", emoji: "🥣" },
  { value: "snack", label: "Snack", emoji: "🍎" },
];

const MOOD_OPTIONS = ["😀", "🙂", "😐", "😢", "😴"];

function kindEmoji(kind: string): string {
  return KIND_OPTIONS.find((k) => k.value === kind)?.emoji ?? "🍽️";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Home() {
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [babyName, setBabyName] = useState("");
  const [kind, setKind] = useState<FeedKind>("bottle");
  const [food, setFood] = useState("");
  const [amount, setAmount] = useState("");
  const [mood, setMood] = useState("🙂");
  const [notes, setNotes] = useState("");

  const refresh = useCallback(async () => {
    const [entriesRes, insightsRes] = await Promise.all([
      fetch("/api/entries"),
      fetch("/api/insights"),
    ]);
    const entriesData = await entriesRes.json();
    const insightsData = await insightsRes.json();
    setEntries(entriesData.entries ?? []);
    setInsights(insightsData.insights ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!babyName.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baby_name: babyName,
          kind,
          food,
          amount,
          mood,
          notes,
        }),
      });
      setFood("");
      setAmount("");
      setNotes("");
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/entries/${id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-rose-600 sm:text-4xl">
          🍼 Happy Feed Journal
        </h1>
        <p className="mt-2 text-slate-600">
          Record feed &amp; food for your baby. Enjoy the growing-up time.
        </p>
      </header>

      {insights && (
        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-rose-100">
            <p className="text-sm text-slate-500">Feedings today</p>
            <p className="text-3xl font-bold text-rose-600">
              {insights.totalToday}
            </p>
          </div>
          <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-rose-100">
            <p className="text-sm text-slate-500">Total logged</p>
            <p className="text-3xl font-bold text-rose-600">
              {insights.totalAll}
            </p>
          </div>
          <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-rose-100">
            <p className="text-sm text-slate-500">
              AI insight{" "}
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-600">
                {insights.source === "ai" ? "AI" : "smart"}
              </span>
            </p>
            <p className="mt-1 text-sm font-medium text-slate-700">
              {insights.message}
            </p>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="rounded-2xl bg-white/90 p-6 shadow-sm ring-1 ring-rose-100">
          <h2 className="mb-4 text-xl font-semibold text-slate-800">
            Log a feeding
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">
                Baby name
              </label>
              <input
                aria-label="Baby name"
                value={babyName}
                onChange={(e) => setBabyName(e.target.value)}
                placeholder="e.g. Mia"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">
                Feed type
              </label>
              <div className="flex flex-wrap gap-2">
                {KIND_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setKind(opt.value)}
                    className={`rounded-full px-3 py-1.5 text-sm transition ${
                      kind === opt.value
                        ? "bg-rose-500 text-white"
                        : "bg-rose-50 text-rose-600 hover:bg-rose-100"
                    }`}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">
                  Food
                </label>
                <input
                  aria-label="Food"
                  value={food}
                  onChange={(e) => setFood(e.target.value)}
                  placeholder="e.g. Formula"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">
                  Amount
                </label>
                <input
                  aria-label="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 120ml"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">
                Mood
              </label>
              <div className="flex gap-2">
                {MOOD_OPTIONS.map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setMood(m)}
                    className={`rounded-lg px-3 py-1.5 text-lg transition ${
                      mood === m ? "bg-rose-100 ring-2 ring-rose-400" : "bg-slate-50"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">
                Notes
              </label>
              <textarea
                aria-label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything to remember?"
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-rose-500 px-4 py-2.5 font-semibold text-white transition hover:bg-rose-600 disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Add to journal"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl bg-white/90 p-6 shadow-sm ring-1 ring-rose-100">
          <h2 className="mb-4 text-xl font-semibold text-slate-800">
            Journal timeline
          </h2>
          {loading ? (
            <p className="text-slate-500">Loading...</p>
          ) : entries.length === 0 ? (
            <p className="text-slate-500">
              No entries yet. Log your baby&apos;s first feeding! 🌱
            </p>
          ) : (
            <ul className="space-y-3">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"
                >
                  <span className="text-2xl">{kindEmoji(entry.kind)}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">
                        {entry.baby_name}
                      </span>
                      {entry.mood && <span>{entry.mood}</span>}
                    </div>
                    <p className="text-sm text-slate-600">
                      {[entry.food, entry.amount].filter(Boolean).join(" · ") ||
                        entry.kind}
                    </p>
                    {entry.notes && (
                      <p className="mt-1 text-sm italic text-slate-500">
                        “{entry.notes}”
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">
                      {formatTime(entry.fed_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete entry ${entry.id}`}
                    onClick={() => handleDelete(entry.id)}
                    className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
