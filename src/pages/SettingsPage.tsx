import { useState, useEffect } from "react";
import { fetchSettings, updateSettings, changePassword, clearAllLogs, AppSettings } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Settings, Save, Trash2, Database, Lock, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const SettingsPage = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [logEnabled, setLogEnabled] = useState(true);
  const [retentionDays, setRetentionDays] = useState(0);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    fetchSettings().then((s) => {
      setSettings(s);
      setLogEnabled(s.log_enabled);
      setRetentionDays(s.log_retention_days);
      setLoading(false);
    });
  }, []);

  const handleSaveSettings = async () => {
    await updateSettings({ log_enabled: logEnabled, log_retention_days: retentionDays });
    toast({ title: "设置已保存" });
  };

  const handleChangePassword = async () => {
    if (!newPassword) return;
    await changePassword(newPassword);
    setNewPassword("");
    toast({ title: "密码已修改" });
  };

  const handleClearLogs = async () => {
    await clearAllLogs();
    toast({ title: "日志已清空" });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) return <p className="text-muted-foreground text-center py-12">加载中...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-foreground">系统设置</h2>

      {/* Logging settings */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Settings className="h-4 w-4" /> 日志设置</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>启用日志记录</Label>
            <Switch checked={logEnabled} onCheckedChange={setLogEnabled} />
          </div>
          <div className="space-y-2">
            <Label>日志保留天数（0 = 永久保留）</Label>
            <Input type="number" value={retentionDays} onChange={(e) => setRetentionDays(parseInt(e.target.value) || 0)}
              className="w-32 bg-secondary" />
          </div>
          <Button onClick={handleSaveSettings} size="sm">
            <Save className="h-4 w-4 mr-1" /> 保存
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Lock className="h-4 w-4" /> 修改密码</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            placeholder="输入新密码" className="bg-secondary" />
          <Button onClick={handleChangePassword} size="sm" disabled={!newPassword}>
            <CheckCircle className="h-4 w-4 mr-1" /> 修改密码
          </Button>
        </CardContent>
      </Card>

      {/* Database */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" /> 数据库</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">数据库大小</span>
            <span className="text-sm font-mono">{settings ? formatSize(settings.db_size) : "—"}</span>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-1" /> 清空所有日志
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认清空</AlertDialogTitle>
                <AlertDialogDescription>此操作将删除所有请求日志，不可恢复。确定继续？</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearLogs}>确认清空</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
