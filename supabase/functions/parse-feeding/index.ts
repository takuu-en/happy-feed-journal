// Edge Function: parse-feeding
// Accepts a voice clip (base64 audio) or a text transcript and returns a
// structured feeding draft using OpenAI (Whisper for speech-to-text + an LLM
// for field extraction). The mobile app lets the user confirm/edit the draft
// before saving it to the database.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
const WHISPER_MODEL = Deno.env.get("OPENAI_WHISPER_MODEL") ?? "whisper-1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function transcribe(
  audioBase64: string,
  mime: string,
): Promise<string> {
  const ext = mime.includes("wav")
    ? "wav"
    : mime.includes("mp4") || mime.includes("m4a")
      ? "m4a"
      : mime.includes("webm")
        ? "webm"
        : "mp3";
  const form = new FormData();
  form.append(
    "file",
    new Blob([base64ToBytes(audioBase64)], { type: mime }),
    `audio.${ext}`,
  );
  form.append("model", WHISPER_MODEL);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Transcription failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.text ?? "";
}

async function extractStructured(transcript: string): Promise<unknown> {
  const nowIso = new Date().toISOString();
  const system =
    "You extract a single baby feeding event from a caregiver's note and " +
    "return STRICT JSON. Fields: kind (one of breast|formula|solid|snack), " +
    "food (short string, e.g. 'mashed banana' or '' for breast), amount " +
    "(number or null), unit (e.g. 'ml','oz','g','min' or ''), fed_at (ISO " +
    "8601 timestamp; resolve relative times against the provided current " +
    "time, or null if unknown), notes (short string). Only output JSON.";
  const user =
    `Current time: ${nowIso}\nCaregiver note: "${transcript}"\n` +
    `Return JSON with keys kind, food, amount, unit, fed_at, notes.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Extraction failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content);
}

function normalize(raw: Record<string, unknown>) {
  const validKinds = ["breast", "formula", "solid", "snack"];
  let kind = String(raw.kind ?? "").toLowerCase();
  if (!validKinds.includes(kind)) kind = "solid";
  const amountNum = Number(raw.amount);
  return {
    kind,
    food: String(raw.food ?? "").trim(),
    amount: Number.isFinite(amountNum) && raw.amount !== null ? amountNum : null,
    unit: String(raw.unit ?? "").trim(),
    fed_at: raw.fed_at ? String(raw.fed_at) : null,
    notes: String(raw.notes ?? "").trim(),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!OPENAI_API_KEY) {
    return json(
      { error: "OPENAI_API_KEY is not configured for this function." },
      501,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    let transcript = String(body.transcript ?? "").trim();
    if (!transcript && body.audio_base64) {
      transcript = await transcribe(
        String(body.audio_base64),
        String(body.mime ?? "audio/m4a"),
      );
    }
    if (!transcript) {
      return json({ error: "Provide a transcript or audio_base64." }, 400);
    }

    const raw = (await extractStructured(transcript)) as Record<string, unknown>;
    return json({ transcript, parsed: normalize(raw) });
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});
