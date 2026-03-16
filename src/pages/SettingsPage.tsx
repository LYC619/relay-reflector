import { useState, useEffect } from "react";
import { fetchSettings, updateSettings, changePassword, clearAllLogs, downloadBackup, AppSettings } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Settings, Save, Trash2, Database, Lock, CheckCircle, Download, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

const SettingsPage = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [logEnabled, setLogEnabled] = useState(true);
  const [logOnlyErrors, setLogOnlyErrors] = useState(false);
  const [retentionDays, setRetentionDays] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const { t, lang } = useI18n();

  useEffect(() => {
    fetchSettings().then((s) => {
      setSettings(s);
      setLogEnabled(s.log_enabled);
      setLogOnlyErrors(s.log_only_errors);
      setRetentionDays(s.log_retention_days);
      setLoading(false);
    });
  }, []);

  const handleSaveSettings = async () => {
    await updateSettings({ log_enabled: logEnabled, log_retention_days: retentionDays, log_only_errors: logOnlyErrors });
    toast({ title: t("set.saved") });
  };

  const handleChangePassword = async () => {
    if (!newPassword) return;
    await changePassword(newPassword);
    setNewPassword("");
    toast({ title: t("set.password_changed") });
  };

  const handleClearLogs = async () => {
    await clearAllLogs();
    toast({ title: t("set.logs_cleared") });
  };

  const handleBackup = async () => {
    try {
      const blob = await downloadBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proxy_backup_${new Date().toISOString().slice(0, 10)}.db`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: t("set.backup_started") });
    } catch {
      toast({ title: t("set.backup_failed"), variant: "destructive" });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}${t("time.days")} ${h}${t("time.hours")}`;
    if (h > 0) return `${h}${t("time.hours")} ${m}${t("time.minutes")}`;
    return `${m}${t("time.minutes")}`;
  };

  if (loading) return <p className="text-muted-foreground text-center py-12">{t("common.loading")}</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-foreground">{t("set.title")}</h2>

      {/* Version & uptime */}
      {settings && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4" /> {t("set.sys_info")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("set.version")}</span>
              <span className="text-sm font-mono">API Log v{settings.version}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("set.uptime")}</span>
              <span className="text-sm font-mono">{formatUptime(settings.uptime_seconds)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logging settings */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Settings className="h-4 w-4" /> {t("set.log_settings")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>{t("set.log_enabled")}</Label>
            <Switch checked={logEnabled} onCheckedChange={setLogEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t("set.log_errors_only")}</Label>
            <Switch checked={logOnlyErrors} onCheckedChange={setLogOnlyErrors} />
          </div>
          <div className="space-y-2">
            <Label>{t("set.log_retention")}</Label>
            <Input type="number" value={retentionDays} onChange={(e) => setRetentionDays(parseInt(e.target.value) || 0)}
              className="w-32 bg-secondary" />
          </div>
          <Button onClick={handleSaveSettings} size="sm">
            <Save className="h-4 w-4 mr-1" /> {t("set.save")}
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Lock className="h-4 w-4" /> {t("set.change_password")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t("set.new_password")} className="bg-secondary" />
          <Button onClick={handleChangePassword} size="sm" disabled={!newPassword}>
            <CheckCircle className="h-4 w-4 mr-1" /> {t("set.change_password")}
          </Button>
        </CardContent>
      </Card>

      {/* Database */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" /> {t("set.database")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("set.db_size")}</span>
            <span className="text-sm font-mono">{settings ? formatSize(settings.db_size) : "—"}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleBackup}>
              <Download className="h-4 w-4 mr-1" /> {t("set.backup")}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" /> {t("set.clear_logs")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("set.confirm_clear")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("set.clear_desc")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("set.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearLogs}>{t("set.confirm")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
