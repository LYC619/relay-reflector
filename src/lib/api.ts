const API_BASE = import.meta.env.DEV ? "http://localhost:7891" : "";

let adminPassword = sessionStorage.getItem("admin_password") || "";

export function setAdminPassword(pw: string) {
  adminPassword = pw;
  sessionStorage.setItem("admin_password", pw);
}

export function getAdminPassword() {
  return adminPassword;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("x-admin-password", adminPassword);
  const resp = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (resp.status === 401) throw new Error("Unauthorized");
  if (resp.status === 429) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.detail || "Too many requests");
  }
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function login(password: string) {
  const resp = await fetch(`${API_BASE}/admin/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (resp.status === 429) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.detail || "Too many attempts");
  }
  if (!resp.ok) throw new Error("Wrong password");
  setAdminPassword(password);
  return true;
}

// ─── Log types ──────────────────────────────────────────────

export interface LogEntry {
  id: number;
  timestamp: string;
  model: string;
  messages: string;
  assistant_reply: string;
  thinking_content: string | null;
  tool_calls: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  duration_ms: number;
  client_ip: string;
  api_key_hint: string;
  path: string;
  method: string;
  upstream_name: string | null;
  status_code: number | null;
  error_message: string | null;
  is_starred: number;
  tags: string;
  note: string;
}

export async function fetchLogs(params: {
  model?: string;
  start_time?: string;
  end_time?: string;
  status_code?: number;
  upstream_name?: string;
  keyword?: string;
  starred?: boolean;
  tag?: string;
  page?: number;
}) {
  const qs = new URLSearchParams();
  if (params.model) qs.set("model", params.model);
  if (params.start_time) qs.set("start_time", params.start_time);
  if (params.end_time) qs.set("end_time", params.end_time);
  if (params.status_code) qs.set("status_code", String(params.status_code));
  if (params.upstream_name) qs.set("upstream_name", params.upstream_name);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.starred) qs.set("starred", "true");
  if (params.tag) qs.set("tag", params.tag);
  if (params.page) qs.set("page", String(params.page));
  return apiFetch(`/admin/api/logs?${qs.toString()}`) as Promise<{
    logs: LogEntry[];
    total: number;
    page: number;
    page_size: number;
  }>;
}

export async function exportLogs(params: {
  model?: string;
  start_time?: string;
  end_time?: string;
  status_code?: number;
  upstream_name?: string;
  keyword?: string;
}) {
  const qs = new URLSearchParams();
  if (params.model) qs.set("model", params.model);
  if (params.start_time) qs.set("start_time", params.start_time);
  if (params.end_time) qs.set("end_time", params.end_time);
  if (params.status_code) qs.set("status_code", String(params.status_code));
  if (params.upstream_name) qs.set("upstream_name", params.upstream_name);
  if (params.keyword) qs.set("keyword", params.keyword);
  return apiFetch(`/admin/api/logs/export?${qs.toString()}`);
}

// ─── Dashboard ──────────────────────────────────────────────

export interface DashboardStats {
  today_requests: number;
  today_tokens: number;
  avg_duration: number;
  error_rate: number;
  month_requests: number;
  month_tokens: number;
  hourly: { hour: string; count: number; tokens: number }[];
  daily_7d: { day: string; count: number }[];
  top_models: { model: string; count: number }[];
  recent: {
    id: number;
    timestamp: string;
    model: string;
    total_tokens: number;
    duration_ms: number;
    status_code: number;
    api_key_hint: string;
    upstream_name: string;
  }[];
}

export async function fetchDashboard() {
  return apiFetch("/admin/api/dashboard") as Promise<DashboardStats>;
}

// ─── Upstreams ──────────────────────────────────────────────

export interface Upstream {
  id: number;
  name: string;
  url: string;
  is_active: number;
  total_requests: number;
  last_used_at: string | null;
  created_at: string;
  custom_headers: string;
}

export async function fetchUpstreams() {
  return apiFetch("/admin/api/upstreams") as Promise<Upstream[]>;
}

export async function addUpstream(name: string, url: string, custom_headers: string = "{}") {
  return apiFetch("/admin/api/upstreams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, url, custom_headers }),
  });
}

export async function updateUpstream(id: number, name: string, url: string, custom_headers?: string) {
  return apiFetch(`/admin/api/upstreams/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, url, custom_headers }),
  });
}

export async function deleteUpstream(id: number) {
  return apiFetch(`/admin/api/upstreams/${id}`, { method: "DELETE" });
}

export async function activateUpstream(id: number) {
  return apiFetch(`/admin/api/upstreams/${id}/activate`, { method: "POST" });
}

export async function testUpstream(id: number) {
  return apiFetch(`/admin/api/upstreams/${id}/test`, { method: "POST" }) as Promise<{
    status: number;
    ok: boolean;
    body: string;
    latency_ms: number;
  }>;
}

// ─── API Keys ───────────────────────────────────────────────

export interface ApiKey {
  id: number;
  key_hint: string;
  note: string;
  first_seen_at: string;
  last_seen_at: string | null;
  total_requests: number;
  total_tokens: number;
  last_upstream: string;
}

export async function fetchApiKeys() {
  return apiFetch("/admin/api/keys") as Promise<ApiKey[]>;
}

export async function updateApiKeyNote(id: number, note: string) {
  return apiFetch(`/admin/api/keys/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
}

// ─── Settings ───────────────────────────────────────────────

export interface AppSettings {
  log_enabled: boolean;
  log_retention_days: number;
  log_only_errors: boolean;
  db_size: number;
  version: string;
  uptime_seconds: number;
}

export async function fetchSettings() {
  return apiFetch("/admin/api/settings") as Promise<AppSettings>;
}

export async function updateSettings(data: Partial<{
  log_enabled: boolean;
  log_retention_days: number;
  log_only_errors: boolean;
}>) {
  return apiFetch("/admin/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function changePassword(password: string) {
  return apiFetch("/admin/api/settings/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

export async function clearAllLogs() {
  return apiFetch("/admin/api/settings/clear-logs", { method: "POST" });
}

export async function downloadBackup() {
  const headers = new Headers();
  headers.set("x-admin-password", adminPassword);
  const resp = await fetch(`${API_BASE}/admin/api/settings/backup`, { headers });
  if (!resp.ok) throw new Error("Backup failed");
  return resp.blob();
}
