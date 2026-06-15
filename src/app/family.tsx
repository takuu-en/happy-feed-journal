import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "@/context/app-context";
import { supabase } from "@/lib/supabase";
import type { Baby, FamilyMember } from "@/lib/types";

export default function FamilyScreen() {
  const router = useRouter();
  const { currentFamily, babies, refreshBabies, refreshFamilies, session } =
    useApp();

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [babyName, setBabyName] = useState("");
  const [busy, setBusy] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!currentFamily) return;
    const { data } = await supabase
      .from("family_members")
      .select("*, profiles(id, display_name)")
      .eq("family_id", currentFamily.id);
    setMembers((data as FamilyMember[]) ?? []);
  }, [currentFamily]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function addBaby() {
    if (!babyName.trim() || !currentFamily) return;
    setBusy(true);
    await supabase
      .from("babies")
      .insert({ family_id: currentFamily.id, name: babyName.trim() });
    setBusy(false);
    setBabyName("");
    await refreshBabies();
  }

  async function removeBaby(b: Baby) {
    await supabase.from("babies").delete().eq("id", b.id);
    await refreshBabies();
  }

  if (!currentFamily) {
    router.back();
    return null;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{currentFamily.name}</Text>
          <Pressable onPress={() => router.back()} style={styles.close}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Invite family members</Text>
          <Text style={styles.hint}>
            Share this invite code so others can join and view this baby&apos;s
            data.
          </Text>
          <TextInput
            value={currentFamily.id}
            editable={false}
            selectTextOnFocus
            style={styles.code}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Members ({members.length})
          </Text>
          {members.map((m) => (
            <View key={m.user_id} style={styles.memberRow}>
              <Text style={styles.memberName}>
                {m.profiles?.display_name || "Member"}
                {m.user_id === session?.user.id ? " (you)" : ""}
              </Text>
              <Text style={styles.role}>{m.role}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Babies ({babies.length})</Text>
          {babies.map((b) => (
            <View key={b.id} style={styles.memberRow}>
              <Text style={styles.memberName}>
                {b.avatar_emoji} {b.name}
              </Text>
              <Pressable onPress={() => removeBaby(b)}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          ))}
          <TextInput
            placeholder="Add another baby"
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

        <Pressable
          onPress={async () => {
            await refreshFamilies();
            router.back();
          }}
          style={styles.doneBtn}
        >
          <Text style={styles.doneBtnText}>Done</Text>
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
  title: { fontSize: 24, fontWeight: "800", color: "#e11d48", flex: 1 },
  close: {
    backgroundColor: "#fee2e2",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "#e11d48", fontSize: 16, fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  hint: { color: "#9ca3af", fontSize: 13 },
  code: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: "#374151",
    backgroundColor: "#f9fafb",
  },
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  memberName: { color: "#111827", fontWeight: "600" },
  role: { color: "#9ca3af", fontSize: 13 },
  remove: { color: "#dc2626", fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: "#e11d48",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  doneBtn: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
