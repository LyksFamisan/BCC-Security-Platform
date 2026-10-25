import React, { useEffect, useState, useRef } from "react"
import {
  AppState,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  Button,
  View,
  StyleSheet,
  RefreshControl,
  Image,
} from "react-native"
import * as SecureStore from "expo-secure-store"
import * as ImagePicker from "expo-image-picker"
import { io } from "socket.io-client"
const api = process.env.EXPO_PUBLIC_API_URL
type Report = {
  id: string
  title: string
  status: string
  description: string
  location: string
}
export default function App() {
  const [token, setToken] = useState<string | null>(null),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false)
  const [reports, setReports] = useState<Report[]>([]),
    [sites, setSites] = useState<{ id: string; name: string }[]>([]),
    [site, setSite] = useState(""),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [location, setLocation] = useState(""),
    [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null),
    [live, setLive] = useState(false)
  const currentToken = useRef(token)
  currentToken.current = token
  async function logout(message = "") {
    currentToken.current = null
    setToken(null)
    setReports([])
    setSites([])
    setSite("")
    setTitle("")
    setDescription("")
    setLocation("")
    setPhoto(null)
    setPassword("")
    setLive(false)
    setError(message)
    try {
      await SecureStore.deleteItemAsync("bcc-token")
    } catch {
      setError("Could not remove saved login. Clear this app's storage before sharing the device.")
    }
  }
  useEffect(() => {
    SecureStore.getItemAsync("bcc-token")
      .then(setToken)
      .catch(() => setError("Could not restore login"))
      .finally(() => setReady(true))
  }, [])
  async function request(route: string, options: RequestInit = {}) {
    if (!api) throw Error("Set EXPO_PUBLIC_API_URL in mobile/.env")
    const res = await fetch(api + route, {
      ...options,
      headers: { Authorization: "Bearer " + token, ...options.headers },
    })
    if (currentToken.current !== token) throw Error("Session changed")
    if (res.status === 401) {
      await logout("Session expired. Sign in again.")
      throw Error("Session expired. Sign in again.")
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw Error(data.error || "Request failed")
    }
    return res.json()
  }
  async function refresh() {
    if (!token) return
    try {
      const [r, s] = await Promise.all([
        request("/incidents"),
        request("/sites"),
      ])
      if (currentToken.current !== token) return
      setReports(r)
      setSites(s)
      setSite((v) => v || s[0]?.id || "")
      setError("")
    } catch (e) {
      if (currentToken.current === token) setError((e as Error).message)
    }
  }
  useEffect(() => {
    if (!token || !api) return
    void refresh()
    const socket = io(api, { auth: { token } })
    socket.on("connect", () => {
      setLive(true)
      void refresh()
    })
    socket.on("incidents:changed", () => void refresh())
    socket.on("disconnect", () => setLive(false))
    socket.on("connect_error", () => setLive(false))
    const timer = setInterval(refresh, 15000)
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refresh()
    })
    return () => {
      socket.disconnect()
      clearInterval(timer)
      sub.remove()
    }
  }, [token])
  async function login() {
    setBusy(true)
    try {
      if (!api) throw Error("Set EXPO_PUBLIC_API_URL in mobile/.env")
      const res = await fetch(api + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const d = await res.json()
      if (!res.ok) throw Error(d.error)
      if (d.user.role !== "guard") throw Error("Use a Guard account")
      await SecureStore.setItemAsync("bcc-token", d.token)
      currentToken.current = d.token
      setToken(d.token)
      setPassword("")
      setError("")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function pick() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted)
        throw Error("Photo library permission is required")
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      })
      if (!result.canceled) {
        if ((result.assets[0].fileSize || 0) > 5 * 1024 * 1024)
          throw Error("Choose a photo under 5 MB")
        setPhoto(result.assets[0])
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }
  async function submit() {
    if (!photo || !site) {
      setError("Select a site and photo")
      return
    }
    setBusy(true)
    try {
      const form = new FormData()
      form.append("title", title)
      form.append("description", description)
      form.append("location", location)
      form.append("site_id", site)
      form.append("photo", {
        uri: photo.uri,
        name: photo.fileName || "evidence.jpg",
        type: photo.mimeType || "image/jpeg",
      } as any)
      await request("/incidents", { method: "POST", body: form })
      if (currentToken.current !== token) return
      setTitle("")
      setDescription("")
      setLocation("")
      setPhoto(null)
      await refresh()
    } catch (e) {
      if (currentToken.current === token) setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (!ready)
    return (
      <SafeAreaView>
        <Text>Restoring session…</Text>
      </SafeAreaView>
    )
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={
          <RefreshControl refreshing={busy} onRefresh={() => void refresh()} />
        }
      >
        <Text style={styles.heading}>BCC Guard</Text>
        <Text>
          {token
            ? live
              ? "Live updates connected"
              : "Polling / reconnecting"
            : "Sign in to submit and track your incidents"}
        </Text>
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        {!token ? (
          <>
            <Text>Email</Text>
            <TextInput
              accessibilityLabel="Email"
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Text>Password</Text>
            <TextInput
              accessibilityLabel="Password"
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <Button
              disabled={busy}
              title="Sign in"
              onPress={() => void login()}
            />
          </>
        ) : (
          <>
            <Button title="Sign out" onPress={() => void logout()} />
            <Text style={styles.heading}>New incident</Text>
            <Text>Assigned site</Text>
            {sites.map((s) => (
              <Button
                key={s.id}
                title={(site === s.id ? "✓ " : "") + s.name}
                onPress={() => setSite(s.id)}
              />
            ))}
            {[
              { label: "Title", value: title, set: setTitle },
              { label: "Description", value: description, set: setDescription },
              { label: "Location", value: location, set: setLocation },
            ].map((f) => (
              <View key={f.label}>
                <Text>{f.label}</Text>
                <TextInput
                  accessibilityLabel={f.label}
                  style={styles.input}
                  value={f.value}
                  onChangeText={f.set}
                  multiline={f.label === "Description"}
                />
              </View>
            ))}
            <Button title="Choose evidence photo" onPress={() => void pick()} />
            {photo && (
              <Image
                source={{ uri: photo.uri }}
                accessibilityLabel="Selected evidence"
                style={{ height: 160, borderRadius: 12 }}
              />
            )}
            <Button
              disabled={busy}
              title={busy ? "Submitting…" : "Submit incident"}
              onPress={() => void submit()}
            />
            <Text style={styles.heading}>My reports</Text>
            {reports.length === 0 && (
              <Text>No reports yet. Pull to refresh.</Text>
            )}
            {reports.map((r) => (
              <View style={styles.card} key={r.id}>
                <Text style={styles.title}>{r.title}</Text>
                <Text>{r.status}</Text>
                <Text>{r.description}</Text>
                <Text>{r.location}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#eef4f9" },
  page: { padding: 24, gap: 14, paddingTop: 40 },
  heading: { fontSize: 26, fontWeight: "700", color: "#102439" },
  title: { fontSize: 18, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#8a9dad",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "white",
  },
  error: { color: "#991b1b", padding: 12, backgroundColor: "#fee2e2" },
  card: { padding: 18, backgroundColor: "white", borderRadius: 12, gap: 8 },
})
