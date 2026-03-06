import { useState } from "react";
import { getAdminPassword } from "@/lib/api";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import LogsPage from "@/pages/LogsPage";
import UpstreamsPage from "@/pages/UpstreamsPage";
import KeysPage from "@/pages/KeysPage";
import SettingsPage from "@/pages/SettingsPage";
import {
  LayoutDashboard, ScrollText, Globe, Key, Settings, LogOut, Activity
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";

type Tab = "dashboard" | "logs" | "upstreams" | "keys" | "settings";

const navItems: { id: Tab; title: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", title: "仪表盘", icon: LayoutDashboard },
  { id: "logs", title: "请求日志", icon: ScrollText },
  { id: "upstreams", title: "上游管理", icon: Globe },
  { id: "keys", title: "Key 统计", icon: Key },
  { id: "settings", title: "系统设置", icon: Settings },
];

const Index = () => {
  const [authed, setAuthed] = useState(!!getAdminPassword());
  const [tab, setTab] = useState<Tab>("dashboard");

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
  }

  const renderPage = () => {
    switch (tab) {
      case "dashboard": return <DashboardPage />;
      case "logs": return <LogsPage />;
      case "upstreams": return <UpstreamsPage />;
      case "keys": return <KeysPage />;
      case "settings": return <SettingsPage />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarContent>
            {/* Logo area */}
            <div className="px-4 py-4 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                  <Activity className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-sm font-bold text-sidebar-foreground truncate">Relay Reflector</span>
              </div>
            </div>

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => setTab(item.id)}
                        isActive={tab === item.id}
                        tooltip={item.title}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Logout at bottom */}
            <div className="mt-auto px-2 py-3 border-t border-sidebar-border">
              <SidebarMenuButton
                onClick={() => {
                  sessionStorage.removeItem("admin_password");
                  setAuthed(false);
                }}
                tooltip="退出登录"
              >
                <LogOut className="h-4 w-4" />
                <span>退出登录</span>
              </SidebarMenuButton>
            </div>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border px-4 bg-card flex-shrink-0">
            <SidebarTrigger className="mr-3" />
            <h1 className="text-sm font-semibold text-foreground">
              {navItems.find((n) => n.id === tab)?.title}
            </h1>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {renderPage()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
