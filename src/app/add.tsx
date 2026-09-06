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

interface ItemRow {
  food: string;
  amount: string;
  unit: string;
}

const emptyItem = (): ItemRow => ({ food: "", amount: "", unit: "g" });

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

  const [kind, setKind] = useState<FeedKind>("formula");
  const [notes, setNotes] = useState("");

  // Breast
  const [leftMin, setLeftMin] = useState("");
  const [rightMin, setRightMin] = useState("");
  // Formula
  const [brand, setBrand] = useState("");
  const [scoops, setScoops] = useState("");
  const [formulaMl, setFormulaMl] = useState("");
  // Solid / snack
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  }
  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }
  function removeItem(index: number) {
    setItems((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index),
    );
  }

  function applyParsed(p: ParsedFeeding) {
    setKind(p.kind);
    setNotes(p.notes ?? "");
    setLeftMin(p.left_duration_min != null ? String(p.left_duration_min) : "");
    setRightMin(
      p.right_duration_min != null ? String(p.right_duration_min) : "",
    );
    setBrand(p.brand ?? "");
    setScoops(p.scoops != null ? String(p.scoops) : "");
    if (p.kind === "formula") {
      setFormulaMl(p.amount != null ? String(p.amount) : "");
    }
    if (p.kind === "solid" || p.kind === "snack") {
      const parsedItems =
        p.items && p.items.length > 0
          ? p.items.map((it) => ({
              food: it.food,
              amount: it.amount != null ? String(it.amount) : "",
              unit: it.unit || "g",
            }))
          : p.food
            ? [
                {
                  food: p.food,
                  amount: p.amount != null ? String(p.amount) : "",
                  unit: p.unit || "g",
                },
              ]
            : [emptyItem()];
      setItems(parsedItems);
    }
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
      setError(e instanceof Error ? e.message : "Could not parse the feeding.");
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

    const num = (s: string) => (s.trim() === "" ? null : Number(s));
    const payload: Record<string, unknown> = {
      _baby_id: currentBaby.id,
      _kind: kind,
      _notes: notes.trim(),
      _source: usedAi ? "voice" : "manual",
    };

    if (kind === "breast") {
      payload._left_duration_min = num(leftMin);
      payload._right_duration_min = num(rightMin);
    } else if (kind === "formula") {
      payload._brand = brand.trim();
      payload._scoops = num(scoops);
      payload._amount = num(formulaMl);
      payload._unit = "ml";
      payload._food = brand.trim() || "Formula";
    } else {
      // solid / snack
      const cleanItems = items
        .map((it) => ({
          food: it.food.trim(),
          amount: it.amount.trim() === "" ? null : Number(it.amount),
          unit: it.unit || "g",
        }))
        .filter((it) => it.food !== "");
      if (cleanItems.length === 0) {
        setSaving(false);
        setError("Add at least one food item.");
        return;
      }
      payload._items = cleanItems;
      payload._food = cleanItems.map((it) => it.food).join(", ");
    }

    const { error } = await supabase.rpc("create_feeding", payload);
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
            e.g. “Breakfast: 50g banana and 30g rice cereal” or “Left breast 10
            min, right 8 min” or “Brand Hipp formula, 3 scoops, 150ml”
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
              style={[styles.recordBtn, recording && styles.recordBtnActive]}
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

        {/* Kind selector */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Type</Text>
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
        </View>

        {/* Breast */}
        {kind === "breast" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Breastfeeding duration</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Left (min)</Text>
                <TextInput
                  placeholder="10"
                  placeholderTextColor="#9ca3af"
                  value={leftMin}
                  onChangeText={setLeftMin}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Right (min)</Text>
                <TextInput
                  placeholder="8"
                  placeholderTextColor="#9ca3af"
                  value={rightMin}
                  onChangeText={setRightMin}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
            </View>
          </View>
        )}

        {/* Formula */}
        {kind === "formula" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Formula details</Text>
            <Text style={styles.label}>Brand</Text>
            <TextInput
              placeholder="e.g. HiPP, Similac"
              placeholderTextColor="#9ca3af"
              value={brand}
              onChangeText={setBrand}
              style={styles.input}
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Scoops</Text>
                <TextInput
                  placeholder="3"
                  placeholderTextColor="#9ca3af"
                  value={scoops}
                  onChangeText={setScoops}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Amount (ml)</Text>
                <TextInput
                  placeholder="150"
                  placeholderTextColor="#9ca3af"
                  value={formulaMl}
                  onChangeText={setFormulaMl}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
            </View>
          </View>
        )}

        {/* Solid / snack items */}
        {(kind === "solid" || kind === "snack") && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Foods in this meal</Text>
            {items.map((it, index) => (
              <View key={index} style={styles.itemRow}>
                <TextInput
                  placeholder="Food (e.g. mashed banana)"
                  placeholderTextColor="#9ca3af"
                  value={it.food}
                  onChangeText={(t) => updateItem(index, { food: t })}
                  style={[styles.input, { flex: 2 }]}
                />
                <TextInput
                  placeholder="50"
                  placeholderTextColor="#9ca3af"
                  value={it.amount}
                  onChangeText={(t) => updateItem(index, { amount: t })}
                  keyboardType="numeric"
                  style={[styles.input, { flex: 1 }]}
                />
                <View style={styles.unitToggle}>
                  {["g", "ml"].map((u) => (
                    <Pressable
                      key={u}
                      onPress={() => updateItem(index, { unit: u })}
                      style={[
                        styles.unitBtn,
                        it.unit === u && styles.unitBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.unitBtnText,
                          it.unit === u && styles.unitBtnTextActive,
                        ]}
                      >
                        {u}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {items.length > 1 && (
                  <Pressable
                    onPress={() => removeItem(index)}
                    style={styles.removeItem}
                  >
                    <Text style={styles.removeItemText}>✕</Text>
                  </Pressable>
                )}
              </View>
            ))}
            <Pressable onPress={addItem} style={styles.addItemBtn}>
              <Text style={styles.addItemText}>＋ Add another food</Text>
            </Pressable>
          </View>
        )}

        {/* Notes */}
        <View style={styles.card}>
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
  itemRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  unitToggle: {
    flexDirection: "row",
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 3,
  },
  unitBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  unitBtnActive: { backgroundColor: "#e11d48" },
  unitBtnText: { color: "#e11d48", fontWeight: "700", fontSize: 13 },
  unitBtnTextActive: { color: "#fff" },
  removeItem: { padding: 6 },
  removeItemText: { color: "#9ca3af", fontSize: 16 },
  addItemBtn: {
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 4,
  },
  addItemText: { color: "#e11d48", fontWeight: "700" },
  error: { color: "#dc2626", fontSize: 14 },
  saveBtn: {
    backgroundColor: "#e11d48",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
