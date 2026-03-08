import { useState, useEffect } from "react";
import { fetchDashboard, DashboardStats } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Zap, Clock, AlertTriangle, Cpu, Calendar, TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts";

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

  useEffect(() => {
    fetchDashboard()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return <p className="text-muted-foreground text-center py-12">加载中...</p>;
  }

  const summaryCards = [
    { title: "今日请求", value: stats.today_requests, icon: Activity, color: "text-primary" },
    { title: "今日 Token", value: stats.today_tokens.toLocaleString(), icon: Zap, color: "text-accent" },
    { title: "平均响应", value: `${stats.avg_duration}ms`, icon: Clock, color: "text-foreground" },
    { title: "错误率", value: `${stats.error_rate}%`, icon: AlertTriangle, color: "text-destructive" },
    { title: "本月请求", value: stats.month_requests.toLocaleString(), icon: Calendar, color: "text-primary" },
    { title: "本月 Token", value: stats.month_tokens.toLocaleString(), icon: TrendingUp, color: "text-accent" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">仪表盘</h2>

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
          <CardHeader><CardTitle className="text-sm">最近 24 小时请求量</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-sm">最近 24 小时 Token 消耗</CardTitle></CardHeader>
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
        {/* 7-day bar chart */}
        <Card>
          <CardHeader><CardTitle className="text-sm">最近 7 天每日请求量</CardTitle></CardHeader>
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

        {/* Top models */}
        <Card>
          <CardHeader><CardTitle className="text-sm">热门模型 Top 5</CardTitle></CardHeader>
          <CardContent>
            {stats.top_models.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">暂无数据</p>
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

        {/* Recent requests */}
        <Card>
          <CardHeader><CardTitle className="text-sm">最近请求</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {stats.recent.length === 0 && (
                <p className="text-muted-foreground text-center py-8">暂无数据</p>
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