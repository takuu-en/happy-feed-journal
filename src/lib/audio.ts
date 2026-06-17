import { Platform } from "react-native";

// Reads a recorded audio file (native file:// uri or web blob: uri) into a
// base64 string suitable for sending to the parse-feeding Edge Function.
export async function uriToBase64(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  const { File } = await import("expo-file-system");
  return await new File(uri).base64();
}

export function guessAudioMime(): string {
  return Platform.OS === "web" ? "audio/webm" : "audio/m4a";
}
