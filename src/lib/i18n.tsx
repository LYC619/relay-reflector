import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type Lang = "zh" | "en";

const translations = {
  // ─── Nav & Layout ─────────────────────────────────────────
  "nav.dashboard": { zh: "仪表盘", en: "Dashboard" },
  "nav.logs": { zh: "请求日志", en: "Request Logs" },
  "nav.favorites": { zh: "Prompt 收藏", en: "Prompt Favorites" },
  "nav.upstreams": { zh: "上游管理", en: "Upstreams" },
  "nav.keys": { zh: "Key 统计", en: "Key Stats" },
  "nav.settings": { zh: "系统设置", en: "Settings" },
  "nav.logout": { zh: "退出登录", en: "Log out" },
  "common.loading": { zh: "加载中...", en: "Loading..." },

  // ─── Login ────────────────────────────────────────────────
  "login.subtitle": { zh: "AI API 对话记录器", en: "AI API Conversation Logger" },
  "login.placeholder": { zh: "输入管理密码", en: "Enter admin password" },
  "login.button": { zh: "登录", en: "Log in" },
  "login.loading": { zh: "验证中...", en: "Verifying..." },
  "login.error": { zh: "密码错误", en: "Wrong password" },

  // ─── Dashboard ────────────────────────────────────────────
  "dash.title": { zh: "仪表盘", en: "Dashboard" },
  "dash.today_requests": { zh: "今日请求", en: "Today Requests" },
  "dash.today_tokens": { zh: "今日 Token", en: "Today Tokens" },
  "dash.avg_response": { zh: "平均响应", en: "Avg Response" },
  "dash.error_rate": { zh: "错误率", en: "Error Rate" },
  "dash.month_requests": { zh: "本月请求", en: "Monthly Requests" },
  "dash.month_tokens": { zh: "本月 Token", en: "Monthly Tokens" },
  "dash.hourly_requests": { zh: "最近 24 小时请求量", en: "Requests (Last 24h)" },
  "dash.hourly_tokens": { zh: "最近 24 小时 Token 消耗", en: "Token Usage (Last 24h)" },
  "dash.daily_7d": { zh: "最近 7 天每日请求量", en: "Daily Requests (Last 7 Days)" },
  "dash.top_models": { zh: "热门模型 Top 5", en: "Top 5 Models" },
  "dash.recent": { zh: "最近请求", en: "Recent Requests" },
  "dash.no_data": { zh: "暂无数据", en: "No data" },

  // ─── Logs ─────────────────────────────────────────────────
  "logs.title": { zh: "请求日志", en: "Request Logs" },
  "logs.export": { zh: "导出筛选结果", en: "Export Results" },
  "logs.model_placeholder": { zh: "模型名称", en: "Model name" },
  "logs.keyword_placeholder": { zh: "全文搜索...", en: "Full-text search..." },
  "logs.status_placeholder": { zh: "状态码", en: "Status" },
  "logs.status_all": { zh: "全部", en: "All" },
  "logs.upstream_placeholder": { zh: "上游", en: "Upstream" },
  "logs.starred": { zh: "收藏", en: "Starred" },
  "logs.tag_placeholder": { zh: "标签", en: "Tag" },
  "logs.tag_all": { zh: "全部标签", en: "All Tags" },
  "logs.filter": { zh: "筛选", en: "Filter" },
  "logs.no_records": { zh: "暂无记录", en: "No records" },
  "logs.time": { zh: "时间", en: "Time" },
  "logs.model": { zh: "模型", en: "Model" },
  "logs.upstream": { zh: "上游", en: "Upstream" },
  "logs.token": { zh: "Token", en: "Token" },
  "logs.duration": { zh: "耗时", en: "Duration" },
  "logs.status": { zh: "状态", en: "Status" },
  "logs.tags": { zh: "标签", en: "Tags" },
  "logs.page_info": { zh: "（共 {total} 条）", en: "({total} total)" },
  "logs.copy_prompt": { zh: "复制 Prompt", en: "Copy Prompt" },
  "logs.copy_json": { zh: "复制 JSON", en: "Copy JSON" },
  "logs.export_conv": { zh: "导出对话", en: "Export Conversation" },
  "logs.copied_context": { zh: "已复制完整上下文到剪贴板", en: "Full context copied to clipboard" },
  "logs.copied_prompt": { zh: "已复制 Prompt 到剪贴板", en: "Prompt copied to clipboard" },
  "logs.copy_failed": { zh: "复制失败", en: "Copy failed" },
  "logs.request_failed": { zh: "请求失败", en: "Request Failed" },
  "logs.view_raw_error": { zh: "查看原始错误", en: "View raw error" },
  "logs.operation_failed": { zh: "操作失败", en: "Operation failed" },
  "logs.update_failed": { zh: "更新失败", en: "Update failed" },
  "logs.note_saved": { zh: "备注已保存", en: "Note saved" },
  "logs.save_failed": { zh: "保存失败", en: "Save failed" },

  // ─── Favorites ────────────────────────────────────────────
  "fav.title": { zh: "Prompt 收藏夹", en: "Prompt Favorites" },
  "fav.total": { zh: "共 {count} 条收藏", en: "{count} favorites" },
  "fav.search_placeholder": { zh: "搜索收藏...", en: "Search favorites..." },
  "fav.all": { zh: "全部", en: "All" },
  "fav.search": { zh: "搜索", en: "Search" },
  "fav.empty_title": { zh: "还没有收藏的 Prompt", en: "No favorites yet" },
  "fav.empty_hint": { zh: "在请求日志中点击 ⭐ 收藏感兴趣的对话", en: "Star conversations in Request Logs to save them here" },
  "fav.unstarred": { zh: "已取消收藏", en: "Removed from favorites" },
  "fav.no_user_msg": { zh: "（无用户消息）", en: "(No user message)" },
  "fav.has_note": { zh: "有备注", en: "Has note" },
  "fav.copied_prompt": { zh: "已复制 Prompt", en: "Prompt copied" },
  "fav.copied_json": { zh: "已复制 JSON", en: "JSON copied" },
  "fav.conversation": { zh: "对话内容", en: "Conversation" },
  "fav.assistant_reply": { zh: "助手回复", en: "Assistant Reply" },
  "fav.thinking": { zh: "思考过程", en: "Thinking Process" },
  "fav.tool_calls": { zh: "工具调用", en: "Tool Calls" },
  "fav.path": { zh: "路径", en: "Path" },
  "fav.upstream": { zh: "上游", en: "Upstream" },

  // ─── Upstreams ────────────────────────────────────────────
  "up.title": { zh: "上游管理", en: "Upstream Management" },
  "up.add": { zh: "添加上游", en: "Add Upstream" },
  "up.edit": { zh: "编辑上游", en: "Edit Upstream" },
  "up.name": { zh: "名称", en: "Name" },
  "up.url": { zh: "URL", en: "URL" },
  "up.name_placeholder": { zh: "如：主站 New API", en: "e.g. Main API" },
  "up.headers": { zh: "自定义请求头 (JSON)", en: "Custom Headers (JSON)" },
  "up.save": { zh: "保存", en: "Save" },
  "up.empty_title": { zh: "还没有添加任何上游地址", en: "No upstreams configured yet" },
  "up.empty_hint": { zh: "点击「添加上游」开始配置", en: "Click \"Add Upstream\" to get started" },
  "up.active": { zh: "激活", en: "Active" },
  "up.activate": { zh: "激活", en: "Activate" },
  "up.edit_btn": { zh: "编辑", en: "Edit" },
  "up.test": { zh: "测试", en: "Test" },
  "up.requests": { zh: "请求", en: "Requests" },
  "up.last_used": { zh: "最后使用", en: "Last used" },
  "up.confirm_delete": { zh: "确认删除", en: "Confirm Delete" },
  "up.delete_desc": { zh: "确定要删除上游「{name}」吗？此操作不可恢复。", en: "Delete upstream \"{name}\"? This cannot be undone." },
  "up.cancel": { zh: "取消", en: "Cancel" },
  "up.delete": { zh: "删除", en: "Delete" },
  "up.connected": { zh: "连接成功", en: "Connected" },
  "up.conn_failed": { zh: "连接失败", en: "Connection failed" },
  "up.test_failed": { zh: "测试失败", en: "Test failed" },
  "up.headers_invalid": { zh: "自定义请求头格式错误", en: "Invalid custom headers format" },
  "up.headers_invalid_desc": { zh: "请输入有效的 JSON 格式", en: "Please enter valid JSON" },

  // ─── Keys ─────────────────────────────────────────────────
  "keys.title": { zh: "Key 统计", en: "Key Stats" },
  "keys.filter_placeholder": { zh: "按上游筛选...", en: "Filter by upstream..." },
  "keys.empty": { zh: "还没有记录到任何 API Key", en: "No API keys recorded yet" },
  "keys.no_note": { zh: "无备注", en: "No note" },
  "keys.api_key": { zh: "API Key", en: "API Key" },
  "keys.note": { zh: "备注", en: "Note" },
  "keys.upstream": { zh: "常用上游", en: "Common Upstream" },
  "keys.first_seen": { zh: "首次使用", en: "First Seen" },
  "keys.last_seen": { zh: "最后使用", en: "Last Seen" },
  "keys.requests": { zh: "请求数", en: "Requests" },
  "keys.tokens": { zh: "Token", en: "Tokens" },

  // ─── Settings ─────────────────────────────────────────────
  "set.title": { zh: "系统设置", en: "System Settings" },
  "set.sys_info": { zh: "系统信息", en: "System Info" },
  "set.version": { zh: "版本", en: "Version" },
  "set.uptime": { zh: "运行时长", en: "Uptime" },
  "set.log_settings": { zh: "日志设置", en: "Log Settings" },
  "set.log_enabled": { zh: "启用日志记录", en: "Enable Logging" },
  "set.log_errors_only": { zh: "仅记录失败请求", en: "Log Failed Requests Only" },
  "set.log_retention": { zh: "日志保留天数（0 = 永久保留）", en: "Log retention days (0 = forever)" },
  "set.save": { zh: "保存", en: "Save" },
  "set.saved": { zh: "设置已保存", en: "Settings saved" },
  "set.change_password": { zh: "修改密码", en: "Change Password" },
  "set.new_password": { zh: "输入新密码", en: "Enter new password" },
  "set.password_changed": { zh: "密码已修改", en: "Password changed" },
  "set.database": { zh: "数据库", en: "Database" },
  "set.db_size": { zh: "数据库大小", en: "Database Size" },
  "set.backup": { zh: "备份下载", en: "Download Backup" },
  "set.clear_logs": { zh: "清空所有日志", en: "Clear All Logs" },
  "set.confirm_clear": { zh: "确认清空", en: "Confirm Clear" },
  "set.clear_desc": { zh: "此操作将删除所有请求日志，不可恢复。确定继续？", en: "This will delete all request logs permanently. Continue?" },
  "set.cancel": { zh: "取消", en: "Cancel" },
  "set.confirm": { zh: "确认清空", en: "Confirm" },
  "set.logs_cleared": { zh: "日志已清空", en: "Logs cleared" },
  "set.backup_started": { zh: "备份下载已开始", en: "Backup download started" },
  "set.backup_failed": { zh: "备份失败", en: "Backup failed" },
  "set.language": { zh: "语言", en: "Language" },

  // ─── Shared log components ────────────────────────────────
  "shared.add_note": { zh: "添加备注", en: "Add note" },
  "shared.note": { zh: "备注", en: "Note" },
  "shared.note_save": { zh: "保存", en: "Save" },
  "shared.note_cancel": { zh: "取消", en: "Cancel" },
  "shared.note_placeholder": { zh: "记录一下这条 Prompt 好在哪，或从哪个场景抓到的...", en: "Note why this prompt is interesting or where it came from..." },
  "shared.tag_placeholder": { zh: "输入标签...", en: "Enter tag..." },

  // ─── Uptime formatting ────────────────────────────────────
  "time.days": { zh: "天", en: "d" },
  "time.hours": { zh: "小时", en: "h" },
  "time.minutes": { zh: "分钟", en: "m" },
} as const;

export type TransKey = keyof typeof translations;

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TransKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("app_lang") as Lang | null;
    return saved === "en" ? "en" : "zh";
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("app_lang", l);
  }, []);

  const t = useCallback((key: TransKey, vars?: Record<string, string | number>): string => {
    const entry = translations[key];
    if (!entry) return key;
    let str: string = entry[lang] || entry.zh;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
