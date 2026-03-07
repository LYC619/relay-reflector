import { useState, useEffect } from "react";
import { fetchLogs, exportLogs, LogEntry } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Search, Clock, Cpu, MessageSquare,
  Download, ChevronDown, Brain, Wrench, Copy, FileDown, AlertTriangle
} from "lucide-react";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface LogsPageProps {
  initialExpandId?: number | null;
  onConsumeExpandId?: () => void;
}

function statusColorClass(code: number | null | undefined): string {
  if (!code) return "bg-muted text-muted-foreground";
  if (code >= 200 && code < 300) return "bg-emerald-500/20 text-emerald-400";
  if (code >= 400 && code < 500) return "bg-amber-500/20 text-amber-400";
  if (code >= 500) return "bg-destructive/20 text-destructive";
  return "bg-muted text-muted-foreground";
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
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchLogs({
        model, start_time: startTime, end_time: endTime,
        status_code: statusFilter ? parseInt(statusFilter) : undefined,
        upstream_name: upstreamFilter || undefined,
        keyword: keyword || undefined,
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

  useEffect(() => { loadLogs(); }, [page]);

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
              {expandedId === log.id && (
                <div className="pt-2 border-t border-border">
                  <LogDetail log={log} parseMessages={parseMessages} parseToolCalls={parseToolCalls}
                    onExportConversation={() => handleExportConversation(log)} />
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
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">时间</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">模型</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">上游</th>
                  <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Token</th>
                  <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">耗时</th>
                  <th className="text-center px-4 py-2.5 text-muted-foreground font-medium">状态</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">API Key</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">加载中...</td></tr>
                )}
                {!loading && logs.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">暂无记录</td></tr>
                )}
                {logs.map((log) => (
                  <LogRow key={log.id} log={log} expanded={expandedId === log.id}
                    onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    parseMessages={parseMessages} parseToolCalls={parseToolCalls}
                    onExportConversation={() => handleExportConversation(log)} />
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

function LogRow({ log, expanded, onToggle, parseMessages, parseToolCalls, onExportConversation }: {
  log: LogEntry;
  expanded: boolean;
  onToggle: () => void;
  parseMessages: (s: string) => { role: string; content: unknown }[];
  parseToolCalls: (s: string | null) => unknown[];
  onExportConversation: () => void;
}) {
  return (
    <>
      <tr onClick={onToggle}
        className="border-b border-border hover:bg-secondary/30 cursor-pointer transition-colors"
      >
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
        <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">
          {log.api_key_hint?.slice(-8) || "—"}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-secondary/20 px-4 py-4">
            <LogDetail log={log} parseMessages={parseMessages} parseToolCalls={parseToolCalls}
              onExportConversation={onExportConversation} />
          </td>
        </tr>
      )}
    </>
  );
}

function MessageContent({ content }: { content: unknown }) {
  if (typeof content === "string") return <span>{content}</span>;
  if (Array.isArray(content)) {
    return (
      <div className="space-y-2">
        {content.map((item: { type: string; text?: string; image_url?: { url: string } }, i: number) => {
          if (item.type === "text") return <span key={i}>{item.text}</span>;
          if (item.type === "image_url" && item.image_url?.url) {
            return (
              <a key={i} href={item.image_url.url} target="_blank" rel="noopener noreferrer">
                <img src={item.image_url.url} alt="image" className="max-w-[120px] max-h-[80px] rounded border border-border object-cover inline-block" />
              </a>
            );
          }
          return <span key={i}>[{item.type}]</span>;
        })}
      </div>
    );
  }
  return <span>{String(content)}</span>;
}

function isHtmlContent(text: string): boolean {
  return text.trim().startsWith("<");
}

function LogDetail({ log, parseMessages, parseToolCalls, onExportConversation }: {
  log: LogEntry;
  parseMessages: (s: string) => { role: string; content: unknown }[];
  parseToolCalls: (s: string | null) => unknown[];
  onExportConversation: () => void;
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
      toast({ title: "已复制上下文到剪贴板" });
    } catch {
      toast({ title: "复制失败", variant: "destructive" });
    }
  };

  const hasError = log.status_code && log.status_code !== 200;

  return (
    <div className="space-y-3 max-w-3xl">
      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={handleCopyContext}>
          <Copy className="h-3.5 w-3.5 mr-1" /> 复制上下文
        </Button>
        <Button variant="outline" size="sm" onClick={onExportConversation}>
          <FileDown className="h-3.5 w-3.5 mr-1" /> 导出当前对话
        </Button>
      </div>

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
              {/* If original error was HTML, show collapsible raw view */}
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
