import { useState, useEffect } from "react";
import { fetchLogs, exportLogs, LogEntry, toggleLogStar, updateLogTags, updateLogNote, fetchTags } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Search, Clock, Cpu, MessageSquare,
  Download, ChevronDown, Brain, Wrench, Copy, FileDown, AlertTriangle,
  Star, StickyNote
} from "lucide-react";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { statusColorClass, PRESET_TAGS, MessageContent, TagEditor, NoteEditor } from "@/components/log-shared";

interface LogsPageProps {
  initialExpandId?: number | null;
  onConsumeExpandId?: () => void;
}

const LogsPage = ({ initialExpandId, onConsumeExpandId }: LogsPageProps) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [model, setModel] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [upstreamFilter, setUpstreamFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const isMobile = useIsMobile();

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchLogs({
        model, start_time: startTime, end_time: endTime,
        status_code: statusFilter ? parseInt(statusFilter) : undefined,
        upstream_name: upstreamFilter || undefined,
        keyword: keyword || undefined,
        starred: starredOnly || undefined,
        tag: tagFilter || undefined,
        page,
      });
      setLogs(data.logs);
      setTotal(data.total);
      setPageSize(data.page_size);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const tags = await fetchTags();
      setAllTags(tags);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadLogs(); }, [page]);
  useEffect(() => { loadTags(); }, []);

  useEffect(() => {
    if (initialExpandId) {
      setExpandedId(initialExpandId);
      onConsumeExpandId?.();
    }
  }, [initialExpandId]);

  const totalPages = Math.ceil(total / pageSize);

  const parseMessages = (messagesJson: string) => {
    try { return JSON.parse(messagesJson); } catch { return []; }
  };

  const parseToolCalls = (tcJson: string | null) => {
    if (!tcJson) return [];
    try { return JSON.parse(tcJson); } catch { return []; }
  };

  const handleExport = async () => {
    try {
      const data = await exportLogs({
        model, start_time: startTime, end_time: endTime,
        status_code: statusFilter ? parseInt(statusFilter) : undefined,
        upstream_name: upstreamFilter || undefined,
        keyword: keyword || undefined,
      });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `logs_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportConversation = (log: LogEntry) => {
    const messages = log.messages ? parseMessages(log.messages) : [];
    const exportData = {
      messages,
      assistant_reply: log.assistant_reply,
      model: log.model,
      timestamp: log.timestamp,
      total_tokens: log.total_tokens,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation_${log.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleStar = async (log: LogEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    const newVal = !log.is_starred;
    try {
      await toggleLogStar(log.id, newVal);
      setLogs(prev => prev.map(l => l.id === log.id ? { ...l, is_starred: newVal ? 1 : 0 } : l));
    } catch { toast({ title: "操作失败", variant: "destructive" }); }
  };

  const handleUpdateTags = async (logId: number, tags: string) => {
    try {
      await updateLogTags(logId, tags);
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, tags } : l));
      loadTags();
    } catch { toast({ title: "更新失败", variant: "destructive" }); }
  };

  const handleUpdateNote = async (logId: number, note: string) => {
    try {
      await updateLogNote(logId, note);
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, note } : l));
      toast({ title: "备注已保存" });
    } catch { toast({ title: "保存失败", variant: "destructive" }); }
  };

  // Unique tags from allTags + PRESET_TAGS
  const availableTags = [...new Set([...allTags, ...PRESET_TAGS])].sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-foreground">请求日志</h2>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> 导出筛选结果
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="模型名称" value={model} onChange={(e) => setModel(e.target.value)}
            className="w-36 bg-secondary border-border" />
        </div>
        <Input placeholder="全文搜索..." value={keyword} onChange={(e) => setKeyword(e.target.value)}
          className="w-40 bg-secondary border-border" />
        {!isMobile && (
          <>
            <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)}
              className="w-48 bg-secondary border-border" />
            <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)}
              className="w-48 bg-secondary border-border" />
          </>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-28 bg-secondary border-border">
            <SelectValue placeholder="状态码" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="200">200</SelectItem>
            <SelectItem value="400">400</SelectItem>
            <SelectItem value="401">401</SelectItem>
            <SelectItem value="429">429</SelectItem>
            <SelectItem value="500">500</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="上游" value={upstreamFilter} onChange={(e) => setUpstreamFilter(e.target.value)}
          className="w-28 bg-secondary border-border" />
        <Button
          variant={starredOnly ? "default" : "outline"}
          size="sm"
          onClick={() => { setStarredOnly(!starredOnly); setPage(1); }}
          className="gap-1"
        >
          <Star className={`h-3.5 w-3.5 ${starredOnly ? "fill-current" : ""}`} /> 收藏
        </Button>
        {allTags.length > 0 && (
          <Select value={tagFilter} onValueChange={(v) => { setTagFilter(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-28 bg-secondary border-border">
              <SelectValue placeholder="标签" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部标签</SelectItem>
              {allTags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button onClick={() => { setPage(1); loadLogs(); }}>筛选</Button>
      </div>

      {/* Table / Cards */}
      {isMobile ? (
        <div className="space-y-3">
          {loading && <p className="text-center py-8 text-muted-foreground">加载中...</p>}
          {!loading && logs.length === 0 && <p className="text-center py-8 text-muted-foreground">暂无记录</p>}
          {logs.map((log) => (
            <div key={log.id}
              className="rounded-lg border border-border bg-card p-4 space-y-2 cursor-pointer"
              onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
            >
              <div className="flex items-center justify-between">
                <span className="text-primary font-medium text-sm flex items-center gap-1">
                  <Star
                    className={`h-3.5 w-3.5 cursor-pointer transition-colors ${log.is_starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`}
                    onClick={(e) => handleToggleStar(log, e)}
                  />
                  <Cpu className="h-3.5 w-3.5" />{log.model || "—"}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-mono ${statusColorClass(log.status_code)}`}>
                  {log.status_code || "—"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{new Date(log.timestamp).toLocaleString()}</span>
                <span>{log.duration_ms}ms</span>
                <span>{log.total_tokens || 0} tok</span>
              </div>
              {log.tags && (
                <div className="flex flex-wrap gap-1">
                  {log.tags.split(",").filter(Boolean).map(t => (
                    <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                  ))}
                </div>
              )}
              {expandedId === log.id && (
                <div className="pt-2 border-t border-border">
                  <LogDetail log={log} parseMessages={parseMessages} parseToolCalls={parseToolCalls}
                    onExportConversation={() => handleExportConversation(log)}
                    onUpdateTags={handleUpdateTags} onUpdateNote={handleUpdateNote}
                    availableTags={availableTags} />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-center px-2 py-2.5 text-muted-foreground font-medium w-8">★</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">时间</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">模型</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">上游</th>
                  <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Token</th>
                  <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">耗时</th>
                  <th className="text-center px-4 py-2.5 text-muted-foreground font-medium">状态</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">标签</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">加载中...</td></tr>
                )}
                {!loading && logs.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">暂无记录</td></tr>
                )}
                {logs.map((log) => (
                  <LogRow key={log.id} log={log} expanded={expandedId === log.id}
                    onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    parseMessages={parseMessages} parseToolCalls={parseToolCalls}
                    onExportConversation={() => handleExportConversation(log)}
                    onToggleStar={handleToggleStar}
                    onUpdateTags={handleUpdateTags} onUpdateNote={handleUpdateNote}
                    availableTags={availableTags} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}（共 {total} 条）</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

function LogRow({ log, expanded, onToggle, parseMessages, parseToolCalls, onExportConversation, onToggleStar, onUpdateTags, onUpdateNote, availableTags }: {
  log: LogEntry;
  expanded: boolean;
  onToggle: () => void;
  parseMessages: (s: string) => { role: string; content: unknown }[];
  parseToolCalls: (s: string | null) => unknown[];
  onExportConversation: () => void;
  onToggleStar: (log: LogEntry, e: React.MouseEvent) => void;
  onUpdateTags: (logId: number, tags: string) => void;
  onUpdateNote: (logId: number, note: string) => void;
  availableTags: string[];
}) {
  return (
    <>
      <tr onClick={onToggle}
        className="border-b border-border hover:bg-secondary/30 cursor-pointer transition-colors"
      >
        <td className="px-2 py-2.5 text-center">
          <Star
            className={`h-4 w-4 cursor-pointer transition-colors ${log.is_starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`}
            onClick={(e) => onToggleStar(log, e)}
          />
        </td>
        <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap">
          {new Date(log.timestamp).toLocaleString()}
        </td>
        <td className="px-4 py-2.5">
          <span className="flex items-center gap-1 text-primary font-medium">
            <Cpu className="h-3.5 w-3.5" />{log.model || "—"}
          </span>
        </td>
        <td className="px-4 py-2.5 text-xs text-muted-foreground">{log.upstream_name || "—"}</td>
        <td className="px-4 py-2.5 text-right text-xs">
          {log.total_tokens ? (
            <span className="flex items-center justify-end gap-1">
              <MessageSquare className="h-3 w-3" /> {log.total_tokens}
            </span>
          ) : "—"}
        </td>
        <td className="px-4 py-2.5 text-right text-xs">
          <span className="flex items-center justify-end gap-1">
            <Clock className="h-3 w-3" /> {log.duration_ms}ms
          </span>
        </td>
        <td className="px-4 py-2.5 text-center">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${statusColorClass(log.status_code)}`}>
            {log.status_code || "—"}
          </span>
        </td>
        <td className="px-4 py-2.5">
          <div className="flex flex-wrap gap-1">
            {log.tags && log.tags.split(",").filter(Boolean).map(t => (
              <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
            ))}
            {log.note && <StickyNote className="h-3 w-3 text-yellow-500/70" />}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="bg-secondary/20 px-4 py-4">
            <LogDetail log={log} parseMessages={parseMessages} parseToolCalls={parseToolCalls}
              onExportConversation={onExportConversation}
              onUpdateTags={onUpdateTags} onUpdateNote={onUpdateNote}
              availableTags={availableTags} />
          </td>
        </tr>
      )}
    </>
  );
}

function LogDetail({ log, parseMessages, parseToolCalls, onExportConversation, onUpdateTags, onUpdateNote, availableTags }: {
  log: LogEntry;
  parseMessages: (s: string) => { role: string; content: unknown }[];
  parseToolCalls: (s: string | null) => unknown[];
  onExportConversation: () => void;
  onUpdateTags: (logId: number, tags: string) => void;
  onUpdateNote: (logId: number, note: string) => void;
  availableTags: string[];
}) {
  const messages = log.messages ? parseMessages(log.messages) : [];
  const systemMessages = messages.filter((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");
  const toolCalls = parseToolCalls(log.tool_calls);
  const [showRawError, setShowRawError] = useState(false);

  const handleCopyContext = () => {
    try {
      const formatted = JSON.stringify(messages, null, 2);
      navigator.clipboard.writeText(formatted);
      toast({ title: "已复制完整上下文到剪贴板" });
    } catch {
      toast({ title: "复制失败", variant: "destructive" });
    }
  };

  const handleCopyPrompt = () => {
    try {
      const promptParts: string[] = [];
      for (const msg of messages) {
        const content = typeof msg.content === "string"
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.filter((c: { type: string }) => c.type === "text").map((c: { text?: string }) => c.text).join("\n")
            : String(msg.content);
        promptParts.push(`[${msg.role}]\n${content}`);
      }
      navigator.clipboard.writeText(promptParts.join("\n\n"));
      toast({ title: "已复制 Prompt 到剪贴板" });
    } catch {
      toast({ title: "复制失败", variant: "destructive" });
    }
  };

  const hasError = log.status_code && log.status_code !== 200;

  return (
    <div className="space-y-3 max-w-3xl">
      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={handleCopyPrompt}>
          <Copy className="h-3.5 w-3.5 mr-1" /> 复制 Prompt
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopyContext}>
          <Copy className="h-3.5 w-3.5 mr-1" /> 复制 JSON
        </Button>
        <Button variant="outline" size="sm" onClick={onExportConversation}>
          <FileDown className="h-3.5 w-3.5 mr-1" /> 导出对话
        </Button>
      </div>

      {/* Tags */}
      <TagEditor log={log} onUpdateTags={onUpdateTags} availableTags={availableTags} />

      {/* Note */}
      <NoteEditor log={log} onUpdateNote={onUpdateNote} />

      {/* Error alert box for non-200 */}
      {hasError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-destructive font-medium text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>请求失败 — HTTP {log.status_code}</span>
          </div>
          {log.error_message && (
            <>
              <p className="text-sm text-destructive/80">{log.error_message}</p>
              {log.error_message.length < 200 && (
                <Collapsible open={showRawError} onOpenChange={setShowRawError}>
                  <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <ChevronDown className="h-3 w-3" /> 查看原始错误
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <pre className="rounded bg-secondary px-3 py-2 text-xs overflow-x-auto max-h-48 text-muted-foreground">
                      {log.error_message}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </>
          )}
        </div>
      )}

      {/* System prompt */}
      {systemMessages.map((msg, i) => (
        <div key={i} className="rounded-lg bg-system-bubble px-4 py-2.5 text-sm whitespace-pre-wrap">
          <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1 font-semibold">system</div>
          <MessageContent content={msg.content} />
        </div>
      ))}

      {/* Chat bubbles */}
      {chatMessages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
            msg.role === "user" ? "bg-user-bubble" : "bg-assistant-bubble"
          }`}>
            <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1 font-semibold">{msg.role}</div>
            <MessageContent content={msg.content} />
          </div>
        </div>
      ))}

      {/* Assistant reply with Markdown (only for successful responses) */}
      {log.assistant_reply && !hasError && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-xl px-4 py-2.5 text-sm bg-assistant-bubble">
            <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1 font-semibold">assistant (response)</div>
            <div className="prose prose-invert prose-sm max-w-none [&_pre]:bg-secondary [&_pre]:rounded-lg [&_pre]:p-3 [&_code]:text-xs [&_table]:text-xs">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {log.assistant_reply}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Thinking */}
      {log.thinking_content && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Brain className="h-4 w-4" />
            <span>Thinking / Reasoning</span>
            <ChevronDown className="h-3 w-3" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 rounded-lg bg-secondary px-4 py-3 text-sm whitespace-pre-wrap text-muted-foreground">
            {log.thinking_content}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Tool calls */}
      {toolCalls.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Wrench className="h-4 w-4" /> Tool Calls
          </div>
          <pre className="rounded-lg bg-secondary px-4 py-3 text-xs overflow-x-auto font-mono text-muted-foreground">
            {JSON.stringify(toolCalls, null, 2)}
          </pre>
        </div>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
        <span>Path: {log.path}</span>
        <span>Method: {log.method}</span>
        <span>IP: {log.client_ip}</span>
        {log.prompt_tokens && <span>Prompt: {log.prompt_tokens}</span>}
        {log.completion_tokens && <span>Completion: {log.completion_tokens}</span>}
      </div>
    </div>
  );
}

export default LogsPage;