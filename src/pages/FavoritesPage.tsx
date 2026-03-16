import { useState, useEffect } from "react";
import { fetchLogs, LogEntry, toggleLogStar, updateLogTags, updateLogNote, fetchTags } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Clock, Cpu, MessageSquare,
  Star, StickyNote, Copy, FileDown,
  ChevronDown, Brain, Wrench, AlertTriangle, Search
} from "lucide-react";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { statusColorClass, PRESET_TAGS, MessageContent, TagEditor, NoteEditor } from "@/components/log-shared";
import { useI18n } from "@/lib/i18n";

const FavoritesPage = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [tagFilter, setTagFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const isMobile = useIsMobile();
  const { t } = useI18n();

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchLogs({
        starred: true,
        tag: tagFilter || undefined,
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

  const loadTags = async () => {
    try {
      const tags = await fetchTags();
      setAllTags(tags);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadLogs(); }, [page, tagFilter]);
  useEffect(() => { loadTags(); }, []);

  const totalPages = Math.ceil(total / pageSize);

  const parseMessages = (messagesJson: string) => {
    try { return JSON.parse(messagesJson); } catch { return []; }
  };

  const parseToolCalls = (tcJson: string | null) => {
    if (!tcJson) return [];
    try { return JSON.parse(tcJson); } catch { return []; }
  };

  const handleToggleStar = async (log: LogEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleLogStar(log.id, false);
      setLogs(prev => prev.filter(l => l.id !== log.id));
      setTotal(prev => prev - 1);
      toast({ title: t("fav.unstarred") });
    } catch { toast({ title: t("logs.operation_failed"), variant: "destructive" }); }
  };

  const handleUpdateTags = async (logId: number, tags: string) => {
    try {
      await updateLogTags(logId, tags);
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, tags } : l));
      loadTags();
    } catch { toast({ title: t("logs.update_failed"), variant: "destructive" }); }
  };

  const handleUpdateNote = async (logId: number, note: string) => {
    try {
      await updateLogNote(logId, note);
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, note } : l));
      toast({ title: t("logs.note_saved") });
    } catch { toast({ title: t("logs.save_failed"), variant: "destructive" }); }
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

  const availableTags = [...new Set([...allTags, ...PRESET_TAGS])].sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
          {t("fav.title")}
        </h2>
        <span className="text-sm text-muted-foreground">{t("fav.total", { count: total })}</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("fav.search_placeholder")} value={keyword} onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadLogs()}
            className="w-48 bg-secondary border-border" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant={tagFilter === "" ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => { setTagFilter(""); setPage(1); }}
          >{t("fav.all")}</Badge>
          {allTags.map(tVal => (
            <Badge
              key={tVal}
              variant={tagFilter === tVal ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => { setTagFilter(tVal); setPage(1); }}
            >{tVal}</Badge>
          ))}
        </div>
        <Button size="sm" onClick={() => { setPage(1); loadLogs(); }}>{t("fav.search")}</Button>
      </div>

      {/* Empty state */}
      {!loading && logs.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <Star className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground">{t("fav.empty_title")}</p>
          <p className="text-xs text-muted-foreground/70">{t("fav.empty_hint")}</p>
        </div>
      )}

      {loading && <p className="text-center py-8 text-muted-foreground">{t("common.loading")}</p>}

      {/* Cards layout */}
      {!loading && logs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-1">
          {logs.map((log) => (
            <FavoriteCard
              key={log.id}
              log={log}
              expanded={expandedId === log.id}
              onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
              onUnstar={handleToggleStar}
              onUpdateTags={handleUpdateTags}
              onUpdateNote={handleUpdateNote}
              onExportConversation={handleExportConversation}
              parseMessages={parseMessages}
              parseToolCalls={parseToolCalls}
              availableTags={availableTags}
              isMobile={isMobile}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

function FavoriteCard({ log, expanded, onToggle, onUnstar, onUpdateTags, onUpdateNote, onExportConversation, parseMessages, parseToolCalls, availableTags, isMobile }: {
  log: LogEntry;
  expanded: boolean;
  onToggle: () => void;
  onUnstar: (log: LogEntry, e: React.MouseEvent) => void;
  onUpdateTags: (logId: number, tags: string) => void;
  onUpdateNote: (logId: number, note: string) => void;
  onExportConversation: (log: LogEntry) => void;
  parseMessages: (s: string) => { role: string; content: unknown }[];
  parseToolCalls: (s: string | null) => unknown[];
  availableTags: string[];
  isMobile: boolean;
}) {
  const messages = log.messages ? parseMessages(log.messages) : [];
  const firstUser = messages.find((m: { role: string }) => m.role === "user");
  const previewText = firstUser
    ? (typeof firstUser.content === "string" ? firstUser.content : JSON.stringify(firstUser.content))
    : "";
  const { t } = useI18n();

  const handleCopyPrompt = () => {
    const parts = messages.map((m: { role: string; content: unknown }) =>
      `[${m.role}]\n${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`
    ).join("\n\n");
    navigator.clipboard.writeText(parts);
    toast({ title: t("fav.copied_prompt") });
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden transition-shadow hover:shadow-md">
      <div className="p-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1 text-primary font-medium text-sm">
                <Cpu className="h-3.5 w-3.5" />{log.model || "—"}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-mono ${statusColorClass(log.status_code)}`}>
                {log.status_code || "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                {log.total_tokens || 0} tokens · {log.duration_ms}ms
              </span>
            </div>
            <p className="text-sm text-foreground/80 line-clamp-2">{previewText || t("fav.no_user_msg")}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">
                {new Date(log.timestamp).toLocaleString()}
              </span>
              {log.tags && log.tags.split(",").filter(Boolean).map(tVal => (
                <Badge key={tVal} variant="secondary" className="text-[10px] px-1.5 py-0">{tVal}</Badge>
              ))}
              {log.note && (
                <span className="text-xs text-muted-foreground/70 flex items-center gap-0.5">
                  <StickyNote className="h-3 w-3" /> {t("fav.has_note")}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); handleCopyPrompt(); }}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Star
              className="h-4 w-4 fill-yellow-400 text-yellow-400 cursor-pointer hover:text-muted-foreground transition-colors"
              onClick={(e) => onUnstar(log, e)}
            />
          </div>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border bg-secondary/20 p-4">
          <FavoriteDetail
            log={log}
            parseMessages={parseMessages}
            parseToolCalls={parseToolCalls}
            onExportConversation={() => onExportConversation(log)}
            onUpdateTags={onUpdateTags}
            onUpdateNote={onUpdateNote}
            availableTags={availableTags}
          />
        </div>
      )}
    </div>
  );
}

function FavoriteDetail({ log, parseMessages, parseToolCalls, onExportConversation, onUpdateTags, onUpdateNote, availableTags }: {
  log: LogEntry;
  parseMessages: (s: string) => { role: string; content: unknown }[];
  parseToolCalls: (s: string | null) => unknown[];
  onExportConversation: () => void;
  onUpdateTags: (logId: number, tags: string) => void;
  onUpdateNote: (logId: number, note: string) => void;
  availableTags: string[];
}) {
  const messages = log.messages ? parseMessages(log.messages) : [];
  const toolCalls = parseToolCalls(log.tool_calls);
  const { t } = useI18n();

  const handleCopyPrompt = () => {
    const parts = messages.map((m: { role: string; content: unknown }) =>
      `[${m.role}]\n${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`
    ).join("\n\n");
    navigator.clipboard.writeText(parts);
    toast({ title: t("fav.copied_prompt") });
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(log.messages || "");
    toast({ title: t("fav.copied_json") });
  };

  return (
    <div className="space-y-4">
      {/* Tags & Note */}
      <div className="space-y-2">
        <TagEditor log={log} onUpdateTags={onUpdateTags} availableTags={availableTags} />
        <NoteEditor log={log} onUpdateNote={onUpdateNote} />
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>Key: {log.api_key_hint || "—"}</span>
        <span>IP: {log.client_ip}</span>
        <span>{t("fav.path")}: {log.method} {log.path}</span>
        {log.upstream_name && <span>{t("fav.upstream")}: {log.upstream_name}</span>}
        {log.prompt_tokens != null && <span>Prompt: {log.prompt_tokens} tok</span>}
        {log.completion_tokens != null && <span>Completion: {log.completion_tokens} tok</span>}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleCopyPrompt}>
          <Copy className="h-3 w-3" /> {t("logs.copy_prompt")}
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleCopyJson}>
          <Copy className="h-3 w-3" /> {t("logs.copy_json")}
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onExportConversation}>
          <FileDown className="h-3 w-3" /> {t("logs.export_conv")}
        </Button>
      </div>

      {/* Error */}
      {log.error_message && (
        <div className="flex items-start gap-2 text-destructive bg-destructive/10 rounded p-2 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>{log.error_message}</span>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("fav.conversation")}</h4>
        {messages.map((msg: { role: string; content: unknown }, i: number) => (
          <div key={i} className={`rounded p-3 text-xs ${
            msg.role === "system" ? "bg-accent/30 border border-accent/50" :
            msg.role === "user" ? "bg-primary/10 border border-primary/20" :
            "bg-secondary border border-border"
          }`}>
            <span className="font-bold text-foreground capitalize">{msg.role}</span>
            <div className="mt-1 text-foreground/80 whitespace-pre-wrap break-words">
              <MessageContent content={msg.content} />
            </div>
          </div>
        ))}
      </div>

      {/* Assistant reply */}
      {log.assistant_reply && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-3.5 w-3.5" /> {t("fav.assistant_reply")}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 rounded bg-secondary border border-border p-3 text-xs whitespace-pre-wrap break-words text-foreground/80">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{log.assistant_reply}</ReactMarkdown>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Thinking */}
      {log.thinking_content && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <Brain className="h-3.5 w-3.5" /> {t("fav.thinking")}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 rounded bg-accent/20 border border-accent/30 p-3 text-xs whitespace-pre-wrap break-words text-foreground/70">
            {log.thinking_content}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Tool calls */}
      {toolCalls.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <Wrench className="h-3.5 w-3.5" /> {t("fav.tool_calls")} ({toolCalls.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 rounded bg-secondary border border-border p-3 text-xs">
            <pre className="whitespace-pre-wrap break-words text-foreground/70">{JSON.stringify(toolCalls, null, 2)}</pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export default FavoritesPage;
