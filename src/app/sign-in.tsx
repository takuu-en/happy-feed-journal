import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";

export default function SignIn() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signUp");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signUp") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() || undefined } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.logo}>🍼</Text>
          <Text style={styles.title}>Happy Feed Journal</Text>
          <Text style={styles.subtitle}>
            Track your baby&apos;s feedings together as a family.
          </Text>

          <View style={styles.card}>
            <View style={styles.tabs}>
              <Pressable
                onPress={() => setMode("signUp")}
                style={[styles.tab, mode === "signUp" && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    mode === "signUp" && styles.tabTextActive,
                  ]}
                >
                  Sign up
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMode("signIn")}
                style={[styles.tab, mode === "signIn" && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    mode === "signIn" && styles.tabTextActive,
                  ]}
                >
                  Sign in
                </Text>
              </Pressable>
            </View>

            {mode === "signUp" && (
              <TextInput
                placeholder="Your name (e.g. Mom)"
                placeholderTextColor="#9ca3af"
                value={displayName}
                onChangeText={setDisplayName}
                style={styles.input}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
              />
            )}
            <TextInput
              placeholder="Email"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
            />
            <TextInput
              placeholder="Password"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              secureTextEntry
              autoComplete={mode === "signUp" ? "new-password" : "current-password"}
              textContentType={mode === "signUp" ? "newPassword" : "password"}
              returnKeyType="go"
              onSubmitEditing={submit}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              onPress={submit}
              disabled={loading}
              style={[styles.button, loading && styles.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {mode === "signUp" ? "Create account" : "Sign in"}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff7ed" },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  logo: { fontSize: 56, textAlign: "center" },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#e11d48",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 4,
    marginBottom: 4,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
  tabActive: { backgroundColor: "#e11d48" },
  tabText: { fontWeight: "600", color: "#e11d48" },
  tabTextActive: { color: "#fff" },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  error: { color: "#dc2626", fontSize: 14 },
  button: {
    backgroundColor: "#e11d48",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
