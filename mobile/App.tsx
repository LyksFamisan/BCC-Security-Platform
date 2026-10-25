import React, { useEffect, useState, useRef } from "react"
import {
  AppState,
  Alert,
  Modal,
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
import {ThemeProvider,ThemeToggle,TechBackground,useTheme,useThemedStyles} from "./Theme"
import OperationsPanel from "./OperationsPanel"
import { io } from "socket.io-client"
const APP_ROLE = "guard"
const SESSION_KEY = "bcc-guard-token"
const api = process.env.EXPO_PUBLIC_API_URL || "https://bcc-security-platform.vercel.app/api"
type Report = {
  id: string
  title: string
  status: string
  description: string
  location: string
  severity: string
  classification: string
  approval: string
  investigation: string
  root_cause: string
  version: number
}
export default function Root() {return <ThemeProvider><App/></ThemeProvider>}
function App() {
  const styles=useThemedStyles(baseStyles)
  const {dark}=useTheme()
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
  const [tab, setTab] = useState<"home" | "reports" | "new" | "duty">("duty")
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [search, setSearch] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState("")
  const currentToken = useRef(token)
  currentToken.current = token
  async function logout(message = "") {
    const oldToken = currentToken.current
    if (oldToken && api)
      void fetch(api + "/auth/logout", {
        method: "POST",
        headers: { Authorization: "Bearer " + oldToken },
      }).catch(() => {})
    currentToken.current = null
    setToken(null)
    setRole(null)
    setTab("duty")
    setNotice("")
    setSelectedReport(null)
    setSearch("")
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
      await SecureStore.deleteItemAsync(SESSION_KEY)
    } catch {
      setError(
        "Could not remove saved login. Clear this app's storage before sharing the device.",
      )
    }
  }
  useEffect(() => {
    SecureStore.getItemAsync(SESSION_KEY)
      .then(setToken)
      .catch(() => setError("Could not restore login"))
      .finally(() => setReady(true))
  }, [])
  async function request(route: string, options: RequestInit = {}) {
    if (!api)
      throw Error("Service unavailable. Please contact your administrator.")
    const controller=new AbortController()
    const timeout=setTimeout(()=>controller.abort(),20000)
    let res: Response
    try {res = await fetch(api + route, {
      signal: controller.signal,
      ...options,
      headers: { Authorization: "Bearer " + token, ...options.headers },
    })
    } finally {clearTimeout(timeout)}
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
      if (![APP_ROLE].includes(identity.role)) {
        await logout("Use a Guard account in BCC Guard")
        return
      }
      setRole(identity.role)
      setReports(r)
      setLive(true)
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
    const socket = process.env.EXPO_PUBLIC_REALTIME_TRANSPORT === "socket" ? io(api, { auth: { token } }) : null
    socket?.on("connect", () => {
      setLive(true)
      void refresh()
    })
    socket?.on("incidents:changed", () => void refresh())
    socket?.on("disconnect", () => setLive(false))
    socket?.on("connect_error", () => setLive(false))
    const timer = setInterval(refresh, 15000)
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refresh()
    })
    return () => {
      socket?.disconnect()
      clearInterval(timer)
      sub.remove()
    }
  }, [token])
  async function login() {
    setBusy(true)
    try {
      if (!api)
        throw Error("Service unavailable. Please contact your administrator.")
      const res = await fetch(api + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          app_role: APP_ROLE,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw Error(d.error)
      if (![APP_ROLE].includes(d.user.role))
        throw Error("Use a Guard account in BCC Guard")
      setRole(d.user.role)
      await SecureStore.setItemAsync(SESSION_KEY, d.token)
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
  async function pick(camera = false) {
    try {
      const permission = await (camera
        ? ImagePicker.requestCameraPermissionsAsync()
        : ImagePicker.requestMediaLibraryPermissionsAsync())
      if (!permission.granted) throw Error("Camera or photo access is required")
      const result = await (
        camera
          ? ImagePicker.launchCameraAsync
          : ImagePicker.launchImageLibraryAsync
      )({
        mediaTypes: ["images"],
        quality: 0.8,
      })
      if (!result.canceled) {
        if ((result.assets[0].fileSize || 0) > 3 * 1024 * 1024)
          throw Error("Choose a photo under 3 MB")
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
      setNotice("Report submitted")
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
  const displayReports =
    tab === "home"
      ? reports.slice(0, 3)
      : reports.filter((r) =>
          `${r.title} ${r.location} ${r.status}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
  async function changeStatus(
    id: string,
    status: string,
    extra: Record<string, unknown> = {},
  ) {
    const activeToken = token
    setBusy(true)
    try {
      await request("/incidents/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, version: reports.find(r=>r.id===id)?.version, ...extra }),
      })
      await refresh()
      if(currentToken.current===activeToken)setNotice("Saved")
    } catch (e) {
      if (currentToken.current === activeToken) setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <SafeAreaView style={styles.safe}>
      <TechBackground/>
      <Modal
        visible={!!selectedReport}
        animationType="slide"
        onRequestClose={() => setSelectedReport(null)}
      >
        <SafeAreaView style={styles.safe}>
          <TechBackground/>
          <ScrollView contentContainerStyle={styles.page}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedReport(null)}
              style={{ minHeight: 48, justifyContent: "center" }}
            >
              <Text style={styles.link}>‹ Back</Text>
            </Pressable>
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            {!!notice && <Text accessibilityLiveRegion="polite" style={styles.success}>{notice}</Text>}
            {selectedReport && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{selectedReport.title}</Text>
                <Text style={styles.muted}>
                  {reports.find((r) => r.id === selectedReport.id)?.status ||
                    selectedReport.status}
                </Text>
                <Text style={styles.body}>{selectedReport.description}</Text>
                <Text style={styles.muted}>{selectedReport.location}</Text>
                <Text style={styles.muted}>
                  {reports.find((r) => r.id === selectedReport.id)?.approval ||
                    selectedReport.approval}
                </Text>
                {supervisor && (
                  <Text style={styles.muted}>
                    {selectedReport.classification} · {selectedReport.severity}
                  </Text>
                )}
                <Text style={styles.body}>{selectedReport.investigation}</Text>
                {supervisor && (
                  <View style={{ gap: 10 }}>
                    <Field label="Classification" value={selectedReport.classification||""} onChangeText={v=>setSelectedReport({...selectedReport,classification:v})} placeholder="Incident category" maxLength={100}/>
                    <Text style={styles.label}>Severity</Text>
                    <View style={styles.siteChoices}>{["Low","Medium","High","Critical"].map(v=><Pressable key={v} accessibilityRole="radio" accessibilityLabel={v} accessibilityState={{selected:selectedReport.severity===v}} onPress={()=>setSelectedReport({...selectedReport,severity:v})} style={[styles.siteChoice,selectedReport.severity===v&&styles.siteChoiceSelected]}><Text style={styles.link}>{v}</Text></Pressable>)}</View>
                    <Field label="Investigation" value={selectedReport.investigation||""} onChangeText={v=>setSelectedReport({...selectedReport,investigation:v})} placeholder="Investigation findings" multiline maxLength={5000}/>
                    <Field label="Root cause" value={selectedReport.root_cause||""} onChangeText={v=>setSelectedReport({...selectedReport,root_cause:v})} placeholder="Cause of incident" multiline maxLength={5000}/>
                    <Action label="Save case details" busy={busy} onPress={()=>void changeStatus(selectedReport.id,reports.find(r=>r.id===selectedReport.id)?.status||selectedReport.status,{classification:selectedReport.classification,severity:selectedReport.severity,investigation:selectedReport.investigation,root_cause:selectedReport.root_cause})}/>
                    <Action
                      label="Approve incident"
                      busy={busy}
                      onPress={() =>
                        void changeStatus(
                          selectedReport.id,
                          reports.find((r) => r.id === selectedReport.id)
                            ?.status || selectedReport.status,
                          { approval: "Approved" },
                        )
                      }
                    />
                    <Action
                      label="Return for clarification"
                      busy={busy}
                      onPress={() =>
                        void changeStatus(selectedReport.id, "Under Review", {
                          approval: "Returned",
                        })
                      }
                    />
                  </View>
                )}
                <Image
                  source={{
                    uri: api + "/incidents/" + selectedReport.id + "/photo",
                    headers: { Authorization: "Bearer " + token },
                  }}
                  style={{ width: "100%", height: 280, borderRadius: 12 }}
                  resizeMode="contain"
                  accessibilityLabel="Incident evidence"
                />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <StatusBar barStyle={dark?"light-content":"dark-content"} backgroundColor={dark?"#07172B":"#EFF6FF"} />
      {!ready ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#2563EB" />
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
                  tintColor="#2563EB"
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true)
                    void refresh().finally(() => setRefreshing(false))
                  }}
                />
              ) : undefined
            }
          >
            <View style={{alignItems:"flex-end"}}><ThemeToggle/></View>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Image
                  source={require("./assets/BCC_logo.jpg")}
                  accessibilityLabel="BCC"
                  style={{ width: 42, height: 42 }}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.flex}>
                <Text style={styles.brand}>BCC Guard</Text>
              </View>
              <Image
                source={require("./assets/CAT_logo.jpg")}
                accessibilityLabel="CAT"
                style={{ width: 36, height: 36 }}
                resizeMode="contain"
              />
              {token && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sign out"
                  disabled={busy}
                  onPress={() => void logout()}
                  style={styles.signout}
                >
                  <Text style={[styles.lightText,{color:"#D9E9FF"}]}>Sign out</Text>
                </Pressable>
              )}
            </View>

            {!token ? (
              <>
                <View style={styles.loginHero}>
                  <Text style={styles.heroTitle}>Sign in</Text>
                </View>
                <View style={styles.card}>
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
                    <TextInput keyboardAppearance={dark?"dark":"light"}
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
                </View>
              </>
            ) : (
              <>
                {tab !== "duty" && (
                  <View style={styles.hero}>
                    <View style={styles.between}>
                      <View style={styles.connection}>
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: live ? "#75E0B6" : "#2563EB" },
                          ]}
                        />
                        <Text style={styles.connectionText}>
                          {live ? "Online" : "Connecting"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.dashboardTitle}>
                      {tab === "new"
                        ? "Report an incident"
                        : tab === "reports"
                          ? "Reports"
                          : supervisor
                            ? "Site overview"
                            : "My dashboard"}
                    </Text>
                  </View>
                )}
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
                {tab === "duty" && (
                  <OperationsPanel
                    key={token}
                    role={APP_ROLE}
                    request={request}
                  />
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
                        <Text style={styles.quickTitle}>New incident</Text>
                        <Text style={styles.muted}>Report an issue</Text>
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
                {tab === "duty" ? null : tab === "new" ? (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Incident details</Text>

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
                      onPress={() =>
                        Alert.alert("Add photo", undefined, [
                          {
                            text: "Take photo",
                            onPress: () => void pick(true),
                          },
                          { text: "Photo library", onPress: () => void pick() },
                          { text: "Cancel", style: "cancel" },
                        ])
                      }
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
                            JPEG, PNG or WebP · Up to 3 MB
                          </Text>
                        </>
                      )}
                      <Text style={styles.link}>
                        {photo ? "Replace photo" : "Camera or gallery"}
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
                    {tab === "reports" && (
                      <TextInput keyboardAppearance={dark?"dark":"light"}
                        accessibilityLabel="Search reports"
                        placeholder="Search reports"
                        value={search}
                        onChangeText={setSearch}
                        style={styles.input}
                      />
                    )}
                    {!displayReports.length && (
                      <View style={[styles.card, styles.empty]}>
                        <Text style={styles.emptyIcon}>◎</Text>
                        <Text style={styles.sectionTitle}>No reports yet</Text>
                        <Text style={styles.muted}>
                          Your submitted incidents will appear here.
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
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={"Open report: " + report.title}
                          onPress={() => setSelectedReport(report)}
                          style={{ minHeight: 44, justifyContent: "center" }}
                        >
                          <Text style={styles.reportTitle}>
                            {report.title} ›
                          </Text>
                        </Pressable>
                        <Text numberOfLines={3} style={styles.body}>
                          {report.description}
                        </Text>
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
              </>
            )}
          </ScrollView>
          {token && (
            <View style={styles.nav}>
              {([
                ["duty", "⌂", supervisor ? "Duty" : "Attendance"],
                ["new", "＋", "Report"],
                ["reports", "≡", "Reports"],
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
  const styles=useThemedStyles(baseStyles)
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
        <ActivityIndicator color="#EFF6FF" />
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
  const styles=useThemedStyles(baseStyles)
  const {dark}=useTheme()
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput keyboardAppearance={dark?"dark":"light"}
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
  const styles=useThemedStyles(baseStyles)
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{number}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}
const baseStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#EFF6FF",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  flex: { flex: 1 },
  page: { padding: 20, paddingBottom: 24, gap: 16 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  brandRow: {
    backgroundColor: "#172343",
    borderLeftWidth: 3,
    borderLeftColor: "#F08A3E",
    borderRadius: 18,
    paddingHorizontal: 14,
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 10,
  },
  brandMark: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  brandLetter: { fontSize: 26, fontWeight: "900", color: "#EFF6FF" },
  brand: {
    fontSize: 18,
    fontWeight: "800",
    color: "#EFF6FF",
    letterSpacing: -0.4,
  },
  brandSub: {
    fontSize: 9,
    fontWeight: "600",
    color: "#A4B8C0",
    letterSpacing: 2.3,
    marginTop: 3,
  },
  signout: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  lightText: { color: "#52718b", fontSize: 12, fontWeight: "500" },
  loginHero: { paddingTop: 28, paddingBottom: 4, gap: 8 },
  eyebrow: {
    color: "#2563EB",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 36,
    color: "#12304a",
    fontWeight: "800",
    letterSpacing: -1.5,
  },
  heroCopy: { fontSize: 14, lineHeight: 22, color: "#52718b" },
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
  card: { backgroundColor: "#ffffff", padding: 18, borderRadius: 18, gap: 14 },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#12304a",
    letterSpacing: -0.5,
  },
  muted: { fontSize: 12, lineHeight: 19, color: "#61777F" },
  small: { fontSize: 11, lineHeight: 17, color: "#6A7F86" },
  label: { fontSize: 12, fontWeight: "700", color: "#334E58", marginBottom: 3 },
  field: { gap: 6 },
  input: {
    backgroundColor: "#f4f8fc",
    borderWidth: 1,
    borderColor: "#d6e5f0",
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderRadius: 14,
    fontSize: 14,
    color: "#12304a",
    minHeight: 50,
  },
  textarea: { minHeight: 130 },
  link: { fontSize: 12, fontWeight: "700", color: "#2563EB" },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  action: {
    backgroundColor: "#C94E18",
    borderRadius: 15,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  actionText: { fontSize: 14, fontWeight: "800", color: "#ffffff" },
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
    fontSize: 26,
    lineHeight: 32,
    color: "#12304a",
    fontWeight: "800",
    letterSpacing: -1,
  },
  connection: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  connectionText: { fontSize: 10, color: "#52718b" },
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
    backgroundColor: "#ffffff",
    padding: 14,
    borderRadius: 18,
    gap: 6,
  },
  statValue: { fontSize: 25, fontWeight: "800", color: "#2563EB" },
  statLabel: { fontSize: 10, color: "#52718b" },
  quickAction: {
    backgroundColor: "#E9F1FF",
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
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  plusText: { fontSize: 26, color: "#FFF" },
  quickTitle: { fontSize: 14, fontWeight: "700", color: "#203D47" },
  arrow: { fontSize: 24, color: "#2563EB" },
  siteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: "#e0eaf2",
  },
  siteIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "#E9F1FF",
    alignItems: "center",
    justifyContent: "center",
  },
  siteName: { fontSize: 13, color: "#304E57", flex: 1 },
  count: { color: "#2563EB", fontSize: 12, fontWeight: "800" },
  sectionOnDark: { fontSize: 18, color: "#12304a", fontWeight: "700" },
  siteChoices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  siteChoice: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D8E3DE",
    minHeight: 44,
  },
  siteChoiceSelected: { backgroundColor: "#E9F1FF", borderColor: "#2563EB" },
  selectedText: { fontSize: 12, fontWeight: "700", color: "#2563EB" },
  upload: {
    padding: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#A6C3B6",
    borderRadius: 18,
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f4f8fc",
  },
  uploadIcon: { fontSize: 30, color: "#2563EB" },
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
    color: "#12304a",
    lineHeight: 23,
  },
  body: { fontSize: 13, lineHeight: 21, color: "#597078" },
  location: { borderTopWidth: 1, borderColor: "#e0eaf2", paddingTop: 12 },
  review: { gap: 10, paddingTop: 8 },
  statusAction: {
    padding: 12,
    backgroundColor: "#E9F1FF",
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
  navActive: { backgroundColor: "#ECE8FF" },
  navIcon: { fontSize: 23, color: "#81958F" },
  navLabel: { fontSize: 10, fontWeight: "600", color: "#6E837C" },
  navSelected: { color: "#2563EB" },
})
