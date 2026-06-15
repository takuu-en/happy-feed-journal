import type { FeedEntry, Insights } from "./types";

function startOfTodayISO(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function buildLocalMessage(
  entries: FeedEntry[],
  totalToday: number,
  byKind: Record<string, number>,
): string {
  if (entries.length === 0) {
    return "No feedings logged yet. Add your baby's first meal to start the journal!";
  }

  const baby = entries[0]?.baby_name?.trim() || "your little one";
  const topKind = Object.entries(byKind).sort((a, b) => b[1] - a[1])[0]?.[0];
  const kindLabel: Record<string, string> = {
    breast: "breastfeeds",
    bottle: "bottle feeds",
    solid: "solid meals",
    snack: "snacks",
  };

  if (totalToday === 0) {
    return `No feedings yet today for ${baby}. A good rhythm keeps little tummies happy!`;
  }

  const topPhrase = topKind
    ? ` Most often it's ${kindLabel[topKind] ?? topKind}.`
    : "";
  return `Great job! ${baby} has ${totalToday} feeding${
    totalToday === 1 ? "" : "s"
  } logged today.${topPhrase} Keep enjoying these growing-up moments. 🍼`;
}

async function tryOpenAi(prompt: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a warm, encouraging assistant for new parents tracking baby feedings. Reply with one short, friendly sentence.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 80,
        temperature: 0.7,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    return text ? text.trim() : null;
  } catch {
    return null;
  }
}

export async function computeInsights(entries: FeedEntry[]): Promise<Insights> {
  const todayStart = startOfTodayISO();
  const totalToday = entries.filter((e) => e.fed_at >= todayStart).length;

  const byKind: Record<string, number> = {};
  for (const e of entries) {
    byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
  }

  const lastFedAt = entries.length > 0 ? entries[0].fed_at : null;
  const localMessage = buildLocalMessage(entries, totalToday, byKind);

  const aiMessage = await tryOpenAi(
    `Summarize the baby's feeding day in one cheerful sentence. ` +
      `Total feedings today: ${totalToday}. Breakdown: ${JSON.stringify(byKind)}.`,
  );

  return {
    totalAll: entries.length,
    totalToday,
    byKind,
    lastFedAt,
    message: aiMessage ?? localMessage,
    source: aiMessage ? "ai" : "local",
  };
}
