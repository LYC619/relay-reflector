import { useState, useEffect } from "react";
import {
  fetchUpstreams, addUpstream, updateUpstream, deleteUpstream,
  activateUpstream, testUpstream, Upstream
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Plus, Power, Pencil, Trash2, Wifi, Loader2, Globe, Timer
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

const UpstreamsPage = () => {
  const [upstreams, setUpstreams] = useState<Upstream[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [customHeaders, setCustomHeaders] = useState("{}");
  const [testing, setTesting] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, { ok: boolean; latency_ms: number }>>({});
  const { t } = useI18n();

  const load = () => {
    fetchUpstreams().then(setUpstreams).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      try {
        JSON.parse(customHeaders);
      } catch {
        toast({ title: t("up.headers_invalid"), description: t("up.headers_invalid_desc"), variant: "destructive" });
        return;
      }

      if (editingId) {
        await updateUpstream(editingId, name, url, customHeaders);
      } else {
        await addUpstream(name, url, customHeaders);
      }
      setDialogOpen(false);

      if (!editingId) {
        load();
        const upstreamList = await fetchUpstreams();
        const newUpstream = upstreamList.find(u => u.name === name && u.url === url);
        if (newUpstream) {
          handleTest(newUpstream.id);
        }
      } else {
        load();
      }
      setEditingId(null);
      setName("");
      setUrl("");
      setCustomHeaders("{}");
    } catch (e) {
      console.error(e);
    }
  };

  const handleEdit = (u: Upstream) => {
    setEditingId(u.id);
    setName(u.name);
    setUrl(u.url);
    setCustomHeaders(u.custom_headers || "{}");
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    await deleteUpstream(id);
    load();
  };

  const handleActivate = async (id: number) => {
    await activateUpstream(id);
    load();
  };

  const handleTest = async (id: number) => {
    setTesting(id);
    try {
      const result = await testUpstream(id);
      setTestResults(prev => ({ ...prev, [id]: { ok: result.ok, latency_ms: result.latency_ms } }));
      toast({
        title: result.ok ? t("up.connected") : t("up.conn_failed"),
        description: result.ok
          ? `Status: ${result.status}, Latency: ${result.latency_ms}ms`
          : result.body.slice(0, 200),
        variant: result.ok ? "default" : "destructive",
      });
    } catch (e) {
      toast({ title: t("up.test_failed"), description: String(e), variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  if (loading) return <p className="text-muted-foreground text-center py-12">{t("common.loading")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">{t("up.title")}</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) { setEditingId(null); setName(""); setUrl(""); setCustomHeaders("{}"); }
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> {t("up.add")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? t("up.edit") : t("up.add")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("up.name")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("up.name_placeholder")} />
              </div>
              <div className="space-y-2">
                <Label>{t("up.url")}</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://127.0.0.1:3000" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>{t("up.headers")}</Label>
                <Textarea value={customHeaders} onChange={(e) => setCustomHeaders(e.target.value)}
                  placeholder='{"X-Custom-Header": "value"}' className="font-mono text-xs h-20" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSave} disabled={!name || !url}>{t("up.save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {upstreams.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{t("up.empty_title")}</p>
          <p className="text-xs mt-1">{t("up.empty_hint")}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {upstreams.map((u) => (
          <Card key={u.id} className={u.is_active ? "border-primary/50" : ""}>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{u.name}</h3>
                    {u.is_active ? (
                      <span className="text-[10px] uppercase bg-primary/20 text-primary px-2 py-0.5 rounded font-semibold">
                        {t("up.active")}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs font-mono text-muted-foreground mt-1">{u.url}</p>
                </div>
                {testResults[u.id] && (
                  <div className="flex items-center gap-1 text-xs">
                    <Timer className="h-3 w-3" />
                    <span className={testResults[u.id].ok ? "text-primary" : "text-destructive"}>
                      {testResults[u.id].latency_ms}ms
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{t("up.requests")}: {u.total_requests}</span>
                <span>{t("up.last_used")}: {u.last_used_at ? new Date(u.last_used_at).toLocaleString() : "—"}</span>
              </div>
              <div className="flex gap-2 pt-1 flex-wrap">
                {!u.is_active && (
                  <Button variant="outline" size="sm" onClick={() => handleActivate(u.id)}>
                    <Power className="h-3.5 w-3.5 mr-1" /> {t("up.activate")}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => handleEdit(u)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> {t("up.edit_btn")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleTest(u.id)} disabled={testing === u.id}>
                  {testing === u.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Wifi className="h-3.5 w-3.5 mr-1" />}
                  {t("up.test")}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("up.confirm_delete")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("up.delete_desc", { name: u.name })}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("up.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(u.id)}>{t("up.delete")}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default UpstreamsPage;
