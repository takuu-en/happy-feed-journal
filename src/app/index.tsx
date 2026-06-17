import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "@/context/app-context";
import { supabase } from "@/lib/supabase";
import { FEED_KINDS, type Feeding } from "@/lib/types";

function kindEmoji(kind: string): string {
  return FEED_KINDS.find((k) => k.value === kind)?.emoji ?? "🍽️";
}

function summarize(f: Feeding): string {
  if (f.kind === "breast") {
    const parts: string[] = [];
    if (f.left_duration_min != null) parts.push(`Left ${f.left_duration_min}m`);
    if (f.right_duration_min != null)
      parts.push(`Right ${f.right_duration_min}m`);
    return parts.join(" · ") || "Breastfeeding";
  }
  if (f.kind === "formula") {
    const parts: string[] = [];
    if (f.brand) parts.push(f.brand);
    if (f.scoops != null) parts.push(`${f.scoops} scoops`);
    if (f.amount != null) parts.push(`${f.amount}${f.unit || "ml"}`);
    return parts.join(" · ") || "Formula";
  }
  const its = f.feeding_items ?? [];
  if (its.length > 0) {
    return its
      .map(
        (it) =>
          `${it.food}${it.amount != null ? ` ${it.amount}${it.unit}` : ""}`,
      )
      .join(", ");
  }
  return (
    [f.food, f.amount != null ? `${f.amount}${f.unit}` : ""]
      .filter(Boolean)
      .join(" · ") || "—"
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function Dashboard() {
  const router = useRouter();
  const {
    session,
    families,
    currentFamily,
    setCurrentFamilyId,
    babies,
    currentBaby,
    setCurrentBabyId,
    refreshFamilies,
    refreshBabies,
    signOut,
  } = useApp();

  const [feedings, setFeedings] = useState<Feeding[]>([]);
  const [loading, setLoading] = useState(false);

  // Onboarding form state.
  const [familyName, setFamilyName] = useState("");
  const [joinId, setJoinId] = useState("");
  const [babyName, setBabyName] = useState("");
  const [busy, setBusy] = useState(false);

  const loadFeedings = useCallback(async () => {
    if (!currentBaby) {
      setFeedings([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("feedings")
      .select("*, feeding_items(*)")
      .eq("baby_id", currentBaby.id)
      .order("fed_at", { ascending: false });
    if (!error) setFeedings((data as Feeding[]) ?? []);
    setLoading(false);
  }, [currentBaby]);

  useEffect(() => {
    loadFeedings();
  }, [loadFeedings]);

  // Realtime sync: any change to this baby's feedings refreshes the timeline.
  useEffect(() => {
    if (!currentBaby) return;
    const channel = supabase
      .channel(`feedings-${currentBaby.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feedings",
          filter: `baby_id=eq.${currentBaby.id}`,
        },
        () => loadFeedings(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentBaby, loadFeedings]);

  async function createFamily() {
    if (!familyName.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("create_family", {
      _name: familyName.trim(),
    });
    setBusy(false);
    if (error) return;
    setFamilyName("");
    await refreshFamilies();
  }

  async function joinFamily() {
    if (!joinId.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("join_family", {
      _family_id: joinId.trim(),
    });
    setBusy(false);
    if (error) return;
    setJoinId("");
    await refreshFamilies();
  }

  async function addBaby() {
    if (!babyName.trim() || !currentFamily) return;
    setBusy(true);
    const { error } = await supabase
      .from("babies")
      .insert({ family_id: currentFamily.id, name: babyName.trim() });
    setBusy(false);
    if (error) return;
    setBabyName("");
    await refreshBabies();
  }

  async function deleteFeeding(id: string) {
    await supabase.from("feedings").delete().eq("id", id);
    loadFeedings();
  }

  const todayCount = feedings.filter((f) => isToday(f.fed_at)).length;

  // --- Onboarding: no family yet ---
  if (families.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.onboard}>
          <Text style={styles.logo}>👨‍👩‍👧</Text>
          <Text style={styles.h1}>Start a family</Text>
          <Text style={styles.muted}>
            Create a family to track your babies together, or join one with an
            invite code.
          </Text>
          <View style={styles.card}>
            <Text style={styles.label}>Create a family</Text>
            <TextInput
              placeholder="Family name (e.g. The Smiths)"
              placeholderTextColor="#9ca3af"
              value={familyName}
              onChangeText={setFamilyName}
              style={styles.input}
            />
            <Pressable
              onPress={createFamily}
              disabled={busy}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Create family</Text>
            </Pressable>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Join with an invite code</Text>
            <TextInput
              placeholder="Paste family invite code"
              placeholderTextColor="#9ca3af"
              value={joinId}
              onChangeText={setJoinId}
              style={styles.input}
              autoCapitalize="none"
            />
            <Pressable
              onPress={joinFamily}
              disabled={busy}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>Join family</Text>
            </Pressable>
          </View>
          <Pressable onPress={signOut} style={styles.signOut}>
            <Text style={styles.signOutText}>Sign out ({session?.user.email})</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.appTitle}>🍼 Happy Feed Journal</Text>
          <Pressable onPress={() => router.push("/family")}>
            <Text style={styles.familyLink}>
              {currentFamily?.name} · manage family ›
            </Text>
          </Pressable>
        </View>
        <Pressable onPress={signOut} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>Sign out</Text>
        </Pressable>
      </View>

      {/* Family switcher (only when multiple families) */}
      {families.length > 1 && (
        <View style={styles.switcher}>
          {families.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => setCurrentFamilyId(f.id)}
              style={[
                styles.chip,
                currentFamily?.id === f.id && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  currentFamily?.id === f.id && styles.chipTextActive,
                ]}
              >
                {f.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {babies.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.label}>Add your first baby</Text>
          <TextInput
            placeholder="Baby name (e.g. Mia)"
            placeholderTextColor="#9ca3af"
            value={babyName}
            onChangeText={setBabyName}
            style={styles.input}
          />
          <Pressable
            onPress={addBaby}
            disabled={busy}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Add baby</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Baby switcher */}
          <View style={styles.switcher}>
            {babies.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => setCurrentBabyId(b.id)}
                style={[
                  styles.chip,
                  currentBaby?.id === b.id && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    currentBaby?.id === b.id && styles.chipTextActive,
                  ]}
                >
                  {b.avatar_emoji} {b.name}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{todayCount}</Text>
              <Text style={styles.statLabel}>Feedings today</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{feedings.length}</Text>
              <Text style={styles.statLabel}>Total logged</Text>
            </View>
          </View>

          <Pressable
            onPress={() => router.push("/add")}
            style={styles.logBtn}
          >
            <Text style={styles.logBtnText}>🎙️  Log a feeding</Text>
          </Pressable>

          {/* Timeline */}
          {loading && feedings.length === 0 ? (
            <ActivityIndicator
              color="#e11d48"
              style={{ marginTop: 24 }}
            />
          ) : (
            <FlatList
              data={feedings}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              refreshControl={
                <RefreshControl
                  refreshing={loading}
                  onRefresh={loadFeedings}
                />
              }
              ListEmptyComponent={
                <Text style={styles.empty}>
                  No feedings yet for {currentBaby?.name}. Tap “Log a feeding”
                  to start! 🌱
                </Text>
              }
              renderItem={({ item }) => (
                <View style={styles.entry}>
                  <Text style={styles.entryEmoji}>{kindEmoji(item.kind)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryTitle}>
                      {FEED_KINDS.find((k) => k.value === item.kind)?.label ??
                        item.kind}
                      {item.source === "voice" ? "  🎙️" : ""}
                    </Text>
                    <Text style={styles.entrySub}>{summarize(item)}</Text>
                    {item.notes ? (
                      <Text style={styles.entryNotes}>“{item.notes}”</Text>
                    ) : null}
                    <Text style={styles.entryTime}>
                      {formatTime(item.fed_at)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => deleteFeeding(item.id)}
                    style={styles.deleteBtn}
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </Pressable>
                </View>
              )}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff7ed", paddingHorizontal: 16 },
  onboard: { flex: 1, justifyContent: "center", gap: 12, padding: 8 },
  logo: { fontSize: 48, textAlign: "center" },
  h1: {
    fontSize: 24,
    fontWeight: "800",
    color: "#e11d48",
    textAlign: "center",
  },
  muted: { color: "#6b7280", textAlign: "center", marginBottom: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 12,
  },
  appTitle: { fontSize: 20, fontWeight: "800", color: "#e11d48" },
  familyLink: { color: "#9333ea", marginTop: 2, fontWeight: "600" },
  iconBtn: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  iconBtnText: { color: "#e11d48", fontWeight: "600" },
  switcher: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#fbcfe8",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: "#e11d48", borderColor: "#e11d48" },
  chipText: { color: "#e11d48", fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  statNum: { fontSize: 28, fontWeight: "800", color: "#e11d48" },
  statLabel: { color: "#6b7280", fontSize: 13, marginTop: 2 },
  logBtn: {
    backgroundColor: "#e11d48",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  logBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 24 },
  entry: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  entryEmoji: { fontSize: 28 },
  entryTitle: { fontWeight: "700", color: "#111827" },
  entrySub: { color: "#4b5563", marginTop: 2 },
  entryNotes: { color: "#6b7280", fontStyle: "italic", marginTop: 2 },
  entryTime: { color: "#9ca3af", fontSize: 12, marginTop: 4 },
  deleteBtn: { padding: 6 },
  deleteBtnText: { color: "#9ca3af", fontSize: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginBottom: 8,
  },
  label: { fontWeight: "700", color: "#111827", fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  primaryBtn: {
    backgroundColor: "#e11d48",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    backgroundColor: "#f3e8ff",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#9333ea", fontWeight: "700", fontSize: 16 },
  signOut: { alignItems: "center", marginTop: 8 },
  signOutText: { color: "#9ca3af" },
});
