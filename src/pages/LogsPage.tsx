import { useState, useEffect } from "react";
import { fetchLogs, exportLogs, LogEntry } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Search, Clock, Cpu, MessageSquare,
  Download, ChevronDown, ChevronUp, Brain, Wrench
} from "lucide-react";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

const LogsPage = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [model, setModel] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [upstreamFilter, setUpstreamFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchLogs({
        model, start_time: startTime, end_time: endTime,
        status_code: statusFilter ? parseInt(statusFilter) : undefined,
        upstream_name: upstreamFilter || undefined,
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
      const data = await exportLogs({ model, start_time: startTime, end_time: endTime });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">请求日志</h2>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> 导出 JSON
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="模型名称" value={model} onChange={(e) => setModel(e.target.value)}
            className="w-40 bg-secondary border-border" />
        </div>
        <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)}
          className="w-48 bg-secondary border-border" />
        <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)}
          className="w-48 bg-secondary border-border" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 bg-secondary border-border">
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
        <Input placeholder="上游名称" value={upstreamFilter} onChange={(e) => setUpstreamFilter(e.target.value)}
          className="w-36 bg-secondary border-border" />
        <Button onClick={() => { setPage(1); loadLogs(); }}>筛选</Button>
      </div>

      {/* Table */}
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
                <>
                  <tr key={log.id}
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
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
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${
                        log.status_code === 200 ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
                      }`}>
                        {log.status_code || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">
                      {log.api_key_hint?.slice(-8) || "—"}
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr key={`${log.id}-detail`}>
                      <td colSpan={7} className="bg-secondary/20 px-4 py-4">
                        <LogDetail log={log} parseMessages={parseMessages} parseToolCalls={parseToolCalls} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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

function LogDetail({ log, parseMessages, parseToolCalls }: {
  log: LogEntry;
  parseMessages: (s: string) => { role: string; content: string }[];
  parseToolCalls: (s: string | null) => unknown[];
}) {
  const messages = log.messages ? parseMessages(log.messages) : [];
  const systemMessages = messages.filter((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");
  const toolCalls = parseToolCalls(log.tool_calls);

  return (
    <div className="space-y-3 max-w-3xl">
      {/* Error */}
      {log.error_message && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-2 text-sm text-destructive">
          <strong>错误：</strong> {log.error_message}
        </div>
      )}

      {/* System prompt */}
      {systemMessages.map((msg, i) => (
        <div key={i} className="rounded-lg bg-system-bubble px-4 py-2.5 text-sm whitespace-pre-wrap">
          <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1 font-semibold">system</div>
          {msg.content}
        </div>
      ))}

      {/* Chat bubbles */}
      {chatMessages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
            msg.role === "user" ? "bg-user-bubble" : "bg-assistant-bubble"
          }`}>
            <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1 font-semibold">{msg.role}</div>
            {msg.content}
          </div>
        </div>
      ))}

      {/* Assistant reply */}
      {log.assistant_reply && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-xl px-4 py-2.5 text-sm bg-assistant-bubble whitespace-pre-wrap">
            <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1 font-semibold">assistant (response)</div>
            {log.assistant_reply}
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
