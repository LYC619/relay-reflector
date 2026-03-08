import { useState } from "react";
import { LogEntry } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tag, StickyNote, X, Plus, Check } from "lucide-react";

export const PRESET_TAGS = ["写作类", "代码类", "角色扮演", "翻译", "分析", "创意"];

export function statusColorClass(code: number | null | undefined): string {
  if (!code) return "bg-muted text-muted-foreground";
  if (code >= 200 && code < 300) return "bg-emerald-500/20 text-emerald-400";
  if (code >= 400 && code < 500) return "bg-amber-500/20 text-amber-400";
  if (code >= 500) return "bg-destructive/20 text-destructive";
  return "bg-muted text-muted-foreground";
}

export function MessageContent({ content }: { content: unknown }) {
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

export function TagEditor({ log, onUpdateTags, availableTags }: {
  log: LogEntry;
  onUpdateTags: (logId: number, tags: string) => void;
  availableTags: string[];
}) {
  const currentTags = log.tags ? log.tags.split(",").filter(Boolean) : [];
  const [newTag, setNewTag] = useState("");
  const [showInput, setShowInput] = useState(false);

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (!t || currentTags.includes(t)) return;
    onUpdateTags(log.id, [...currentTags, t].join(","));
    setNewTag("");
    setShowInput(false);
  };

  const removeTag = (tag: string) => {
    onUpdateTags(log.id, currentTags.filter(t => t !== tag).join(","));
  };

  const unusedTags = availableTags.filter(t => !currentTags.includes(t));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
        {currentTags.map(t => (
          <Badge key={t} variant="secondary" className="gap-1 text-xs">
            {t}
            <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeTag(t)} />
          </Badge>
        ))}
        {showInput ? (
          <div className="flex items-center gap-1">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag(newTag)}
              placeholder="输入标签..."
              className="h-6 w-24 text-xs bg-secondary border-border"
              autoFocus
            />
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => addTag(newTag)}>
              <Check className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowInput(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground" onClick={() => setShowInput(true)}>
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>
      {showInput && unusedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {unusedTags.map(t => (
            <Badge key={t} variant="outline"
              className="text-[10px] cursor-pointer hover:bg-secondary"
              onClick={() => addTag(t)}
            >{t}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function NoteEditor({ log, onUpdateNote }: {
  log: LogEntry;
  onUpdateNote: (logId: number, note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(log.note || "");

  const save = () => {
    onUpdateNote(log.id, draft);
    setEditing(false);
  };

  if (!editing && !log.note) {
    return (
      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={() => setEditing(true)}>
        <StickyNote className="h-3.5 w-3.5" /> 添加备注
      </Button>
    );
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="记录一下这条 Prompt 好在哪，或从哪个场景抓到的..."
          className="min-h-[60px] text-sm bg-secondary border-border"
          autoFocus
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={save} className="text-xs">保存</Button>
          <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setDraft(log.note || ""); }} className="text-xs">取消</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-yellow-500/5 border border-yellow-500/20 px-3 py-2 space-y-1 cursor-pointer" onClick={() => setEditing(true)}>
      <div className="flex items-center gap-1.5 text-xs text-yellow-500/70 font-medium">
        <StickyNote className="h-3 w-3" /> 备注
      </div>
      <p className="text-sm text-foreground/80 whitespace-pre-wrap">{log.note}</p>
    </div>
  );
}