import { useState, useEffect } from "react";
import { fetchDashboard, DashboardStats } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Zap, Clock, AlertTriangle, Cpu, Calendar, TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts";
import { useI18n } from "@/lib/i18n";

const COLORS = ["hsl(160,70%,45%)", "hsl(200,60%,50%)", "hsl(280,60%,55%)", "hsl(30,80%,55%)", "hsl(340,65%,50%)"];

interface DashboardPageProps {
  onNavigateToLog?: (logId: number) => void;
}

const chartGridStroke = "hsl(var(--border))";
const chartTickFill = "hsl(var(--muted-foreground))";
const chartTooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
};

const DashboardPage = ({ onNavigateToLog }: DashboardPageProps) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    fetchDashboard()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return <p className="text-muted-foreground text-center py-12">{t("common.loading")}</p>;
  }

  const summaryCards = [
    { title: t("dash.today_requests"), value: stats.today_requests, icon: Activity, color: "text-primary" },
    { title: t("dash.today_tokens"), value: stats.today_tokens.toLocaleString(), icon: Zap, color: "text-accent" },
    { title: t("dash.avg_response"), value: `${stats.avg_duration}ms`, icon: Clock, color: "text-foreground" },
    { title: t("dash.error_rate"), value: `${stats.error_rate}%`, icon: AlertTriangle, color: "text-destructive" },
    { title: t("dash.month_requests"), value: stats.month_requests.toLocaleString(), icon: Calendar, color: "text-primary" },
    { title: t("dash.month_tokens"), value: stats.month_tokens.toLocaleString(), icon: TrendingUp, color: "text-accent" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">{t("dash.title")}</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {summaryCards.map((c) => (
          <Card key={c.title}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{c.title}</p>
                  <p className="text-2xl font-bold mt-1">{c.value}</p>
                </div>
                <c.icon className={`h-8 w-8 ${c.color} opacity-70`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">{t("dash.hourly_requests")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={stats.hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: chartTickFill }}
                  tickFormatter={(v) => v.slice(11, 16)} />
                <YAxis tick={{ fontSize: 10, fill: chartTickFill }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="count" stroke="hsl(160,70%,45%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">{t("dash.hourly_tokens")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={stats.hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: chartTickFill }}
                  tickFormatter={(v) => v.slice(11, 16)} />
                <YAxis tick={{ fontSize: 10, fill: chartTickFill }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="tokens" stroke="hsl(200,60%,50%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">{t("dash.daily_7d")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.daily_7d}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: chartTickFill }}
                  tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: chartTickFill }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="count" fill="hsl(160,70%,45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">{t("dash.top_models")}</CardTitle></CardHeader>
          <CardContent>
            {stats.top_models.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">{t("dash.no_data")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={stats.top_models} dataKey="count" nameKey="model"
                    cx="50%" cy="50%" outerRadius={70} label={({ model, percent }) =>
                      `${model} ${(percent * 100).toFixed(0)}%`
                    } labelLine={false}
                  >
                    {stats.top_models.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">{t("dash.recent")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {stats.recent.length === 0 && (
                <p className="text-muted-foreground text-center py-8">{t("dash.no_data")}</p>
              )}
              {stats.recent.map((r) => (
                <div key={r.id}
                  className="flex items-center justify-between px-4 py-2 text-sm hover:bg-secondary/30 cursor-pointer transition-colors"
                  onClick={() => onNavigateToLog?.(r.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Cpu className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span className="truncate font-medium">{r.model || "—"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                    <span>{r.total_tokens || 0} tok</span>
                    <span>{r.duration_ms}ms</span>
                    <span className={r.status_code === 200 ? "text-primary" : "text-destructive"}>
                      {r.status_code || "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
