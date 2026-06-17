import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "@/context/app-context";
import { guessAudioMime, uriToBase64 } from "@/lib/audio";
import { supabase } from "@/lib/supabase";
import { FEED_KINDS, type FeedKind, type ParsedFeeding } from "@/lib/types";

export default function AddFeeding() {
  const router = useRouter();
  const { currentBaby, session } = useApp();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedAi, setUsedAi] = useState(false);

  // Structured fields.
  const [kind, setKind] = useState<FeedKind>("formula");
  const [food, setFood] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("ml");
  const [notes, setNotes] = useState("");

  function applyParsed(p: ParsedFeeding) {
    setKind(p.kind);
    setFood(p.food ?? "");
    setAmount(p.amount != null ? String(p.amount) : "");
    setUnit(p.unit ?? "");
    setNotes(p.notes ?? "");
    setUsedAi(true);
  }

  async function parse(body: Record<string, unknown>) {
    setError(null);
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-feeding", {
        body,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.transcript && !transcript) setTranscript(data.transcript);
      if (data?.parsed) applyParsed(data.parsed as ParsedFeeding);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not parse the feeding.",
      );
    } finally {
      setParsing(false);
    }
  }

  async function parseTranscript() {
    if (!transcript.trim()) {
      setError("Type what happened, or record your voice first.");
      return;
    }
    await parse({ transcript: transcript.trim() });
  }

  async function toggleRecording() {
    setError(null);
    try {
      if (!recording) {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) {
          setError("Microphone permission is required for voice input.");
          return;
        }
        await setAudioModeAsync({ allowsRecording: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        setRecording(true);
      } else {
        await recorder.stop();
        setRecording(false);
        const uri = recorder.uri;
        if (!uri) {
          setError("No audio was captured.");
          return;
        }
        const audio_base64 = await uriToBase64(uri);
        await parse({ audio_base64, mime: guessAudioMime() });
      }
    } catch (e) {
      setRecording(false);
      setError(e instanceof Error ? e.message : "Recording failed.");
    }
  }

  async function save() {
    if (!currentBaby || !session) return;
    setSaving(true);
    setError(null);
    const amountNum = amount.trim() === "" ? null : Number(amount);
    const { error } = await supabase.from("feedings").insert({
      baby_id: currentBaby.id,
      kind,
      food: food.trim(),
      amount: Number.isFinite(amountNum as number) ? amountNum : null,
      unit: unit.trim(),
      notes: notes.trim(),
      source: usedAi ? "voice" : "manual",
      created_by: session.user.id,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.back();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Log a feeding</Text>
          <Pressable onPress={() => router.back()} style={styles.close}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>
          For {currentBaby?.avatar_emoji} {currentBaby?.name}
        </Text>

        {/* Voice / AI section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🎙️ Speak or type</Text>
          <Text style={styles.hint}>
            e.g. “Gave Mia 120ml of formula 10 minutes ago, she was happy”
          </Text>
          <TextInput
            placeholder="Describe the feeding..."
            placeholderTextColor="#9ca3af"
            value={transcript}
            onChangeText={setTranscript}
            style={[styles.input, { minHeight: 64 }]}
            multiline
          />
          <View style={styles.row}>
            <Pressable
              onPress={toggleRecording}
              style={[
                styles.recordBtn,
                recording && styles.recordBtnActive,
              ]}
            >
              <Text style={styles.recordBtnText}>
                {recording
                  ? "■ Stop & parse"
                  : Platform.OS === "web"
                    ? "● Record"
                    : "● Hold to talk"}
              </Text>
            </Pressable>
            <Pressable
              onPress={parseTranscript}
              disabled={parsing}
              style={styles.parseBtn}
            >
              {parsing ? (
                <ActivityIndicator color="#9333ea" />
              ) : (
                <Text style={styles.parseBtnText}>✨ Parse with AI</Text>
              )}
            </Pressable>
          </View>
          {usedAi && (
            <Text style={styles.aiNote}>
              ✨ AI filled the fields below — review and edit before saving.
            </Text>
          )}
        </View>

        {/* Structured form */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Details</Text>
          <Text style={styles.label}>Type</Text>
          <View style={styles.kinds}>
            {FEED_KINDS.map((k) => (
              <Pressable
                key={k.value}
                onPress={() => setKind(k.value)}
                style={[styles.kind, kind === k.value && styles.kindActive]}
              >
                <Text
                  style={[
                    styles.kindText,
                    kind === k.value && styles.kindTextActive,
                  ]}
                >
                  {k.emoji} {k.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Food</Text>
          <TextInput
            placeholder="e.g. Formula, mashed banana"
            placeholderTextColor="#9ca3af"
            value={food}
            onChangeText={setFood}
            style={styles.input}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Amount</Text>
              <TextInput
                placeholder="120"
                placeholderTextColor="#9ca3af"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Unit</Text>
              <TextInput
                placeholder="ml / oz / g / min"
                placeholderTextColor="#9ca3af"
                value={unit}
                onChangeText={setUnit}
                style={styles.input}
              />
            </View>
          </View>

          <Text style={styles.label}>Notes</Text>
          <TextInput
            placeholder="Anything to remember?"
            placeholderTextColor="#9ca3af"
            value={notes}
            onChangeText={setNotes}
            style={styles.input}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={save}
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save to journal</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff7ed" },
  container: { padding: 16, gap: 12, paddingBottom: 48 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 24, fontWeight: "800", color: "#e11d48" },
  close: {
    backgroundColor: "#fee2e2",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "#e11d48", fontSize: 16, fontWeight: "700" },
  muted: { color: "#6b7280", marginBottom: 4 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  hint: { color: "#9ca3af", fontSize: 13 },
  label: { fontWeight: "600", color: "#374151", marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  recordBtn: {
    flex: 1,
    backgroundColor: "#e11d48",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  recordBtnActive: { backgroundColor: "#991b1b" },
  recordBtnText: { color: "#fff", fontWeight: "700" },
  parseBtn: {
    flex: 1,
    backgroundColor: "#f3e8ff",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  parseBtnText: { color: "#9333ea", fontWeight: "700" },
  aiNote: { color: "#9333ea", fontSize: 13, marginTop: 4 },
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kind: {
    backgroundColor: "#fef2f2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  kindActive: { backgroundColor: "#e11d48" },
  kindText: { color: "#e11d48", fontWeight: "600" },
  kindTextActive: { color: "#fff" },
  error: { color: "#dc2626", fontSize: 14 },
  saveBtn: {
    backgroundColor: "#e11d48",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
