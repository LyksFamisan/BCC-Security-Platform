import React, { useEffect, useState, useRef } from "react"
import {
  AppState,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
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
  const [role, setRole] = useState<string | null>(null)
  const [tab, setTab] = useState<"home" | "reports" | "new">("home")
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState("")
  const currentToken = useRef(token)
  currentToken.current = token
  async function logout(message = "") {
    currentToken.current = null
    setToken(null)
    setRole(null)
    setTab("home")
    setNotice("")
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
      setError(
        "Could not remove saved login. Clear this app's storage before sharing the device.",
      )
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
      const [r, s, identity] = await Promise.all([
        request("/incidents"),
        request("/sites"),
        request("/auth/me"),
      ])
      if (currentToken.current !== token) return
      if (!["guard", "supervisor"].includes(identity.role)) {
        await logout("Use a Guard or Supervisor account")
        return
      }
      setRole(identity.role)
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
      if (!["guard", "supervisor"].includes(d.user.role))
        throw Error("Use a Guard or Supervisor account")
      setRole(d.user.role)
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
    if (
      title.trim().length < 3 ||
      description.trim().length < 5 ||
      location.trim().length < 2
    ) {
      setError("Add a title, description and location before submitting.")
      return
    }
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
      setTab("reports")
      setNotice("Report submitted. Your team can now review it.")
    } catch (e) {
      if (currentToken.current === token) setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const supervisor = role === "supervisor"
  const openReports = reports.filter(
    (report) => report.status !== "Resolved",
  ).length
  const displayReports = tab === "home" ? reports.slice(0, 3) : reports
  async function changeStatus(id: string, status: string) {
    const activeToken = token
    setBusy(true)
    try {
      await request("/incidents/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      await refresh()
    } catch (e) {
      if (currentToken.current === activeToken) setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#102B35" />
      {!ready ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#F5AB69" />
          <Text style={styles.lightText}>Restoring your session…</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.page}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              token ? (
                <RefreshControl
                  tintColor="#F5AB69"
                  refreshing={busy}
                  onRefresh={() => void refresh()}
                />
              ) : undefined
            }
          >
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Text style={styles.brandLetter}>B</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.brand}>BCC / CAT</Text>
                <Text style={styles.brandSub}>SECURITY SERVICES</Text>
              </View>
              {token && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sign out"
                  disabled={busy}
                  onPress={() => void logout()}
                  style={styles.signout}
                >
                  <Text style={styles.lightText}>Sign out</Text>
                </Pressable>
              )}
            </View>
            {!token ? (
              <>
                <View style={styles.loginHero}>
                  <Text style={styles.eyebrow}>YOUR PARTNER ON DUTY</Text>
                  <Text style={styles.heroTitle}>
                    Stay connected.{"\n"}Stay protected.
                  </Text>
                  <Text style={styles.heroCopy}>
                    A clear view of every report, wherever duty takes you.
                  </Text>
                  <View style={styles.roleRow}>
                    <Text style={styles.rolePill}>GUARD</Text>
                    <Text style={styles.rolePill}>SUPERVISOR</Text>
                  </View>
                </View>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Welcome back</Text>
                  <Text style={styles.muted}>
                    Sign in with your assigned account.
                  </Text>
                  {!!error && (
                    <Text accessibilityRole="alert" style={styles.error}>
                      {error}
                    </Text>
                  )}
                  <Field
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="name@company.com"
                    email
                  />
                  <View>
                    <View style={styles.between}>
                      <Text style={styles.label}>Password</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          showPassword ? "Hide password" : "Show password"
                        }
                        onPress={() => setShowPassword((value) => !value)}
                      >
                        <Text style={styles.link}>
                          {showPassword ? "Hide" : "Show"}
                        </Text>
                      </Pressable>
                    </View>
                    <TextInput
                      accessibilityLabel="Password"
                      placeholder="Enter your password"
                      placeholderTextColor="#8A9CA4"
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoComplete="password"
                    />
                  </View>
                  <Action
                    label="Sign in"
                    busy={busy}
                    disabled={!email.trim() || !password}
                    onPress={() => void login()}
                  />
                  <Text style={styles.small}>
                    Your account determines which sites and records you can
                    access.
                  </Text>
                </View>
                <Text style={styles.footer}>
                  BCC Security Services Platform · Mobile
                </Text>
              </>
            ) : (
              <>
                <View style={styles.hero}>
                  <View style={styles.between}>
                    <Text style={styles.eyebrow}>
                      {supervisor ? "SITE OPERATIONS" : "YOUR DUTY COMPANION"}
                    </Text>
                    <View style={styles.connection}>
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: live ? "#75E0B6" : "#F5AB69" },
                        ]}
                      />
                      <Text style={styles.connectionText}>
                        {live ? "Live" : "Reconnecting"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.dashboardTitle}>
                    {tab === "new"
                      ? "Report an incident"
                      : tab === "reports"
                        ? "Your reports, in focus."
                        : supervisor
                          ? "Your sites. One view."
                          : "Ready for your shift."}
                  </Text>
                  <Text style={styles.heroCopy}>
                    {supervisor
                      ? "Monitor reports across your assigned sites."
                      : "Report clearly. Track progress. Keep your team informed."}
                  </Text>
                  <View style={styles.scopeTag}>
                    <Text style={styles.lightText}>
                      {supervisor
                        ? "Supervisor / Site In-Charge"
                        : "Security Personnel (Guard)"}
                    </Text>
                  </View>
                </View>
                {!!error && (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {error}
                  </Text>
                )}
                {!!notice && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss notification"
                    onPress={() => setNotice("")}
                  >
                    <Text
                      accessibilityLiveRegion="polite"
                      style={styles.success}
                    >
                      {notice} ×
                    </Text>
                  </Pressable>
                )}
                {tab === "home" && (
                  <>
                    <View style={styles.statsRow}>
                      <Stat number={reports.length} label="Total reports" />
                      <Stat number={openReports} label="Open cases" />
                      <Stat
                        number={reports.length - openReports}
                        label="Resolved"
                      />
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setError("")
                        setTab("new")
                      }}
                      style={({ pressed }) => [
                        styles.quickAction,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.plus}>
                        <Text style={styles.plusText}>+</Text>
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.quickTitle}>
                          Something to report?
                        </Text>
                        <Text style={styles.muted}>
                          Add details and photo evidence
                        </Text>
                      </View>
                      <Text style={styles.arrow}>→</Text>
                    </Pressable>
                    <View style={styles.card}>
                      <View style={styles.between}>
                        <Text style={styles.sectionTitle}>Assigned sites</Text>
                        <Text style={styles.count}>{sites.length}</Text>
                      </View>
                      {sites.length ? (
                        sites.map((item) => (
                          <View key={item.id} style={styles.siteRow}>
                            <View style={styles.siteIcon}>
                              <Text style={styles.link}>◎</Text>
                            </View>
                            <Text style={styles.siteName}>{item.name}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.muted}>
                          No assigned sites. Contact your administrator.
                        </Text>
                      )}
                    </View>
                  </>
                )}
                {tab === "new" ? (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Incident details</Text>
                    <Text style={styles.muted}>
                      Give your team the information they need to act.
                    </Text>
                    <Text style={styles.label}>Assigned site</Text>
                    <View style={styles.siteChoices}>
                      {sites.map((item) => (
                        <Pressable
                          key={item.id}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: site === item.id }}
                          onPress={() => setSite(item.id)}
                          style={[
                            styles.siteChoice,
                            site === item.id && styles.siteChoiceSelected,
                          ]}
                        >
                          <Text
                            style={
                              site === item.id
                                ? styles.selectedText
                                : styles.muted
                            }
                          >
                            {site === item.id ? "●  " : "○  "}
                            {item.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    {!sites.length && (
                      <Text style={styles.muted}>
                        A site assignment is required before reporting.
                      </Text>
                    )}
                    <Field
                      label="Title"
                      value={title}
                      onChangeText={setTitle}
                      placeholder="A brief summary of what happened"
                      maxLength={160}
                    />
                    <Field
                      label="Location"
                      value={location}
                      onChangeText={setLocation}
                      placeholder="e.g. Main entrance, Gate 2"
                      maxLength={300}
                    />
                    <Field
                      label="Description"
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Describe what happened and any action taken…"
                      multiline
                      maxLength={5000}
                    />
                    <Text style={styles.label}>Photo evidence</Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void pick()}
                      style={styles.upload}
                    >
                      {photo ? (
                        <Image
                          source={{ uri: photo.uri }}
                          accessibilityLabel="Selected evidence"
                          style={styles.photo}
                        />
                      ) : (
                        <>
                          <Text style={styles.uploadIcon}>＋</Text>
                          <Text style={styles.quickTitle}>Add a photo</Text>
                          <Text style={styles.small}>
                            JPEG, PNG or WebP · Up to 5 MB
                          </Text>
                        </>
                      )}
                      <Text style={styles.link}>
                        {photo ? "Replace photo" : "Choose from gallery"}
                      </Text>
                    </Pressable>
                    <Action
                      label="Submit incident"
                      busy={busy}
                      disabled={
                        !site ||
                        !photo ||
                        !title.trim() ||
                        !description.trim() ||
                        !location.trim()
                      }
                      onPress={() => void submit()}
                    />
                    <Text style={styles.small}>
                      Your report will appear in the connected operations
                      dashboard after submission.
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.between}>
                      <Text style={styles.sectionOnDark}>
                        {tab === "home"
                          ? "Recent activity"
                          : supervisor
                            ? "Assigned-site reports"
                            : "My reports"}
                      </Text>
                      {tab === "home" && (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setTab("reports")}
                        >
                          <Text style={styles.lightText}>View all →</Text>
                        </Pressable>
                      )}
                    </View>
                    {!displayReports.length && (
                      <View style={[styles.card, styles.empty]}>
                        <Text style={styles.emptyIcon}>◎</Text>
                        <Text style={styles.sectionTitle}>A clear board</Text>
                        <Text style={styles.muted}>
                          No reports to show yet. Pull down to refresh or submit
                          your first incident.
                        </Text>
                        <Action
                          label="Create a report"
                          onPress={() => setTab("new")}
                        />
                      </View>
                    )}
                    {displayReports.map((report) => (
                      <View key={report.id} style={styles.card}>
                        <View style={styles.between}>
                          <Text style={styles.reportId}>
                            #{report.id.slice(0, 8).toUpperCase()}
                          </Text>
                          <View
                            style={[
                              styles.badge,
                              report.status === "Resolved"
                                ? styles.resolved
                                : styles.pending,
                            ]}
                          >
                            <Text style={styles.badgeText}>
                              {report.status}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.reportTitle}>{report.title}</Text>
                        <Text style={styles.body}>{report.description}</Text>
                        <View style={styles.location}>
                          <Text style={styles.muted}>◎ {report.location}</Text>
                        </View>
                        {supervisor && (
                          <View style={styles.review}>
                            <Text style={styles.label}>
                              Update report status
                            </Text>
                            <View style={styles.siteChoices}>
                              {["Under Review", "In Progress", "Resolved"]
                                .filter((status) => status !== report.status)
                                .map((status) => (
                                  <Pressable
                                    key={status}
                                    accessibilityRole="button"
                                    accessibilityLabel={
                                      "Set status to " + status
                                    }
                                    disabled={busy}
                                    onPress={() =>
                                      void changeStatus(report.id, status)
                                    }
                                    style={[
                                      styles.statusAction,
                                      busy && styles.disabled,
                                    ]}
                                  >
                                    <Text style={styles.link}>{status}</Text>
                                  </Pressable>
                                ))}
                            </View>
                          </View>
                        )}
                      </View>
                    ))}
                  </>
                )}
                <Text style={styles.footer}>
                  {supervisor ? "Assigned sites only" : "Your reports only"} ·
                  Pull down to refresh
                </Text>
              </>
            )}
          </ScrollView>
          {token && (
            <View style={styles.nav}>
              {([
                ["home", "◈", "Overview"],
                ["new", "＋", "Report"],
                ["reports", "≡", "Activity"],
              ] as const).map(([key, icon, label]) => (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === key }}
                  onPress={() => {
                    setError("")
                    setTab(key)
                  }}
                  style={[styles.navItem, tab === key && styles.navActive]}
                >
                  <Text
                    style={[styles.navIcon, tab === key && styles.navSelected]}
                  >
                    {icon}
                  </Text>
                  <Text
                    style={[styles.navLabel, tab === key && styles.navSelected]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  )
}
function Action({
  label,
  onPress,
  busy = false,
  disabled = false,
}: {
  label: string
  onPress: () => void
  busy?: boolean
  disabled?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        (disabled || busy) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color="#102B35" />
      ) : (
        <Text style={styles.actionText}>{label} →</Text>
      )}
    </Pressable>
  )
}
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  email = false,
  maxLength,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder: string
  multiline?: boolean
  email?: boolean
  maxLength?: number
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8A9CA4"
        multiline={multiline}
        maxLength={maxLength}
        style={[styles.input, multiline && styles.textarea]}
        autoCapitalize={email ? "none" : "sentences"}
        keyboardType={email ? "email-address" : "default"}
        autoComplete={email ? "email" : "off"}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  )
}
function Stat({ number, label }: { number: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{number}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#102B35",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  flex: { flex: 1 },
  page: { padding: 22, paddingBottom: 28, gap: 18 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 10,
  },
  brandMark: {
    width: 42,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#F5AB69",
    justifyContent: "center",
    alignItems: "center",
  },
  brandLetter: { fontSize: 26, fontWeight: "900", color: "#102B35" },
  brand: { fontSize: 18, fontWeight: "800", color: "#FFF", letterSpacing: 1.4 },
  brandSub: {
    fontSize: 9,
    fontWeight: "600",
    color: "#A4B8C0",
    letterSpacing: 2.3,
    marginTop: 3,
  },
  signout: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  lightText: { color: "#D0E0E5", fontSize: 12, fontWeight: "500" },
  loginHero: { paddingVertical: 20, gap: 18 },
  eyebrow: {
    color: "#F5AB69",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  heroTitle: {
    fontSize: 40,
    lineHeight: 47,
    color: "#F7FAF9",
    fontWeight: "800",
    letterSpacing: -1.5,
  },
  heroCopy: { fontSize: 14, lineHeight: 22, color: "#B4C9D0" },
  roleRow: { flexDirection: "row", gap: 10 },
  rolePill: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#B7DED6",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#34535C",
  },
  card: { backgroundColor: "#F9FBFA", padding: 20, borderRadius: 24, gap: 14 },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#19333D",
    letterSpacing: -0.5,
  },
  muted: { fontSize: 12, lineHeight: 19, color: "#61777F" },
  small: { fontSize: 11, lineHeight: 17, color: "#6A7F86" },
  label: { fontSize: 12, fontWeight: "700", color: "#334E58", marginBottom: 3 },
  field: { gap: 6 },
  input: {
    backgroundColor: "#EEF3F2",
    borderWidth: 1,
    borderColor: "#DAE5E2",
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderRadius: 14,
    fontSize: 14,
    color: "#19333D",
    minHeight: 50,
  },
  textarea: { minHeight: 130 },
  link: { fontSize: 12, fontWeight: "700", color: "#246A60" },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  action: {
    backgroundColor: "#F5AB69",
    borderRadius: 15,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  actionText: { fontSize: 14, fontWeight: "800", color: "#16343D" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  error: {
    backgroundColor: "#FCE8E4",
    color: "#973E36",
    padding: 14,
    borderRadius: 14,
    fontSize: 12,
    lineHeight: 19,
  },
  success: {
    backgroundColor: "#D9F3E9",
    color: "#245D4B",
    padding: 14,
    borderRadius: 14,
    fontSize: 12,
    lineHeight: 19,
  },
  footer: {
    color: "#8FAAB4",
    fontSize: 10,
    lineHeight: 17,
    textAlign: "center",
    padding: 12,
  },
  hero: { paddingVertical: 10, gap: 15 },
  dashboardTitle: {
    fontSize: 32,
    lineHeight: 39,
    color: "#F7FAF9",
    fontWeight: "800",
    letterSpacing: -1,
  },
  connection: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  connectionText: { fontSize: 10, color: "#C9DBDF" },
  scopeTag: {
    alignSelf: "flex-start",
    backgroundColor: "#24454E",
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 11,
  },
  statsRow: { flexDirection: "row", gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: "#21424B",
    padding: 14,
    borderRadius: 18,
    gap: 6,
  },
  statValue: { fontSize: 25, fontWeight: "800", color: "#F6C08E" },
  statLabel: { fontSize: 10, color: "#B9CDD3" },
  quickAction: {
    backgroundColor: "#E4EFEA",
    padding: 18,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  plus: {
    height: 42,
    width: 42,
    borderRadius: 14,
    backgroundColor: "#23594F",
    alignItems: "center",
    justifyContent: "center",
  },
  plusText: { fontSize: 26, color: "#FFF" },
  quickTitle: { fontSize: 14, fontWeight: "700", color: "#203D47" },
  arrow: { fontSize: 24, color: "#23594F" },
  siteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: "#E3EBE7",
  },
  siteIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "#E4EFEA",
    alignItems: "center",
    justifyContent: "center",
  },
  siteName: { fontSize: 13, color: "#304E57", flex: 1 },
  count: { color: "#246A60", fontSize: 12, fontWeight: "800" },
  sectionOnDark: { fontSize: 18, color: "#F4F7F6", fontWeight: "700" },
  siteChoices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  siteChoice: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D8E3DE",
    minHeight: 44,
  },
  siteChoiceSelected: { backgroundColor: "#E2F1E9", borderColor: "#33766A" },
  selectedText: { fontSize: 12, fontWeight: "700", color: "#20594F" },
  upload: {
    padding: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#A6C3B6",
    borderRadius: 18,
    alignItems: "center",
    gap: 10,
    backgroundColor: "#EFF5F0",
  },
  uploadIcon: { fontSize: 30, color: "#33766A" },
  photo: { width: "100%", height: 190, borderRadius: 12 },
  empty: { alignItems: "stretch", gap: 14 },
  emptyIcon: { fontSize: 36, color: "#3F7C6D" },
  reportId: {
    fontSize: 10,
    color: "#74888E",
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  resolved: { backgroundColor: "#D7EEE2" },
  pending: { backgroundColor: "#F9E8D2" },
  badgeText: { fontSize: 10, color: "#3D574C", fontWeight: "700" },
  reportTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#19333D",
    lineHeight: 23,
  },
  body: { fontSize: 13, lineHeight: 21, color: "#597078" },
  location: { borderTopWidth: 1, borderColor: "#E3EBE7", paddingTop: 12 },
  review: { gap: 10, paddingTop: 8 },
  statusAction: {
    padding: 12,
    backgroundColor: "#E4EFEA",
    borderRadius: 12,
    minHeight: 44,
  },
  nav: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FAFCFB",
    gap: 8,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    padding: 8,
    borderRadius: 16,
    minHeight: 56,
  },
  navActive: { backgroundColor: "#E2EFE8" },
  navIcon: { fontSize: 23, color: "#81958F" },
  navLabel: { fontSize: 10, fontWeight: "600", color: "#6E837C" },
  navSelected: { color: "#23594F" },
})
