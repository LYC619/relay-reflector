import { useState, useEffect } from "react";
import { fetchApiKeys, updateApiKeyNote, ApiKey } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Key, Check, Pencil } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const KeysPage = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [upstreamFilter, setUpstreamFilter] = useState("");
  const isMobile = useIsMobile();

  const load = () => {
    fetchApiKeys().then(setKeys).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSaveNote = async (id: number) => {
    await updateApiKeyNote(id, noteValue);
    setEditingId(null);
    load();
  };

  const filteredKeys = upstreamFilter
    ? keys.filter(k => k.last_upstream?.includes(upstreamFilter))
    : keys;

  if (loading) return <p className="text-muted-foreground text-center py-12">加载中...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-foreground">Key 统计</h2>
        <Input placeholder="按上游筛选..." value={upstreamFilter}
          onChange={(e) => setUpstreamFilter(e.target.value)}
          className="w-40 bg-secondary border-border" />
      </div>

      {filteredKeys.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Key className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>还没有记录到任何 API Key</p>
        </div>
      ) : isMobile ? (
        <div className="space-y-3">
          {filteredKeys.map((k) => (
            <div key={k.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs">{k.key_hint}</span>
                <span className="text-xs text-muted-foreground">{k.total_requests} 次</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{k.total_tokens.toLocaleString()} tok</span>
                <span>{k.last_upstream || "—"}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {k.note || "无备注"}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">API Key</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">备注</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">常用上游</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">首次使用</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">最后使用</th>
                  <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">请求数</th>
                  <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Token</th>
                </tr>
              </thead>
              <tbody>
                {filteredKeys.map((k) => (
                  <tr key={k.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs">{k.key_hint}</td>
                    <td className="px-4 py-2.5">
                      {editingId === k.id ? (
                        <div className="flex items-center gap-1">
                          <Input value={noteValue} onChange={(e) => setNoteValue(e.target.value)}
                            className="h-7 text-xs w-32 bg-secondary" />
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleSaveNote(k.id)}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">{k.note || "—"}</span>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                            onClick={() => { setEditingId(k.id); setNoteValue(k.note || ""); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{k.last_upstream || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {new Date(k.first_seen_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {k.last_seen_at ? new Date(k.last_seen_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-medium">{k.total_requests}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-medium">{k.total_tokens.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeysPage;
