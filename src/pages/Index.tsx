import { useState, lazy, Suspense, useCallback } from "react";
import { getAdminPassword } from "@/lib/api";
import LoginPage from "@/pages/LoginPage";
import {
  LayoutDashboard, ScrollText, Globe, Key, Settings, LogOut, Activity, Star, Languages
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useI18n, type TransKey } from "@/lib/i18n";

// Lazy load pages for code splitting
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const LogsPage = lazy(() => import("@/pages/LogsPage"));
const FavoritesPage = lazy(() => import("@/pages/FavoritesPage"));
const UpstreamsPage = lazy(() => import("@/pages/UpstreamsPage"));
const KeysPage = lazy(() => import("@/pages/KeysPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));

type Tab = "dashboard" | "logs" | "favorites" | "upstreams" | "keys" | "settings";

const navItems: { id: Tab; titleKey: TransKey; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", titleKey: "nav.dashboard", icon: LayoutDashboard },
  { id: "logs", titleKey: "nav.logs", icon: ScrollText },
  { id: "favorites", titleKey: "nav.favorites", icon: Star },
  { id: "upstreams", titleKey: "nav.upstreams", icon: Globe },
  { id: "keys", titleKey: "nav.keys", icon: Key },
  { id: "settings", titleKey: "nav.settings", icon: Settings },
];

const Index = () => {
  const [authed, setAuthed] = useState(!!getAdminPassword());
  const [tab, setTab] = useState<Tab>("dashboard");
  const [expandLogId, setExpandLogId] = useState<number | null>(null);
  const isMobile = useIsMobile();
  const { t, lang, setLang } = useI18n();

  const navigateToLog = useCallback((logId: number) => {
    setExpandLogId(logId);
    setTab("logs");
  }, []);

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
  }

  const renderPage = () => {
    switch (tab) {
      case "dashboard": return <DashboardPage onNavigateToLog={navigateToLog} />;
      case "logs": return <LogsPage initialExpandId={expandLogId} onConsumeExpandId={() => setExpandLogId(null)} />;
      case "favorites": return <FavoritesPage />;
      case "upstreams": return <UpstreamsPage />;
      case "keys": return <KeysPage />;
      case "settings": return <SettingsPage />;
    }
  };

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar collapsible={isMobile ? "offcanvas" : "icon"}>
          <SidebarContent>
            {/* Logo area */}
            <div className="px-4 py-4 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                  <Activity className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-sm font-bold text-sidebar-foreground truncate">API Log</span>
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
                        tooltip={t(item.titleKey)}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{t(item.titleKey)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Language toggle & logout at bottom */}
            <div className="mt-auto border-t border-sidebar-border">
              <div className="px-2 py-2">
                <SidebarMenuButton
                  onClick={() => setLang(lang === "zh" ? "en" : "zh")}
                  tooltip={lang === "zh" ? "English" : "中文"}
                >
                  <Languages className="h-4 w-4" />
                  <span>{lang === "zh" ? "English" : "中文"}</span>
                </SidebarMenuButton>
              </div>
              <div className="px-2 pb-3">
                <SidebarMenuButton
                  onClick={() => {
                    sessionStorage.removeItem("admin_password");
                    setAuthed(false);
                  }}
                  tooltip={t("nav.logout")}
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t("nav.logout")}</span>
                </SidebarMenuButton>
              </div>
            </div>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border px-4 bg-card flex-shrink-0">
            <SidebarTrigger className="mr-3" />
            <h1 className="text-sm font-semibold text-foreground">
              {t(navItems.find((n) => n.id === tab)?.titleKey || "nav.dashboard")}
            </h1>
          </header>
          <main className="flex-1 p-4 sm:p-6 overflow-auto">
            <Suspense fallback={<p className="text-muted-foreground text-center py-12">{t("common.loading")}</p>}>
              {renderPage()}
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
