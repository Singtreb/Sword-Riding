import { NavLink } from "react-router-dom";
import {
  Activity,
  AlertOctagon,
  Clock,
  FileText,
  LayoutGrid,
  Mail,
  Plug,
  Plus,
  Radio,
  Server,
  Settings,
  ShieldAlert,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useVersion } from "@/api/queries";

const NAV: { to: string; label: string; icon: typeof LayoutGrid; end?: boolean }[] = [
  { to: "/", label: "概览", icon: LayoutGrid, end: true },
  { to: "/scans/new", label: "新建扫描", icon: Plus },
  { to: "/scans", label: "扫描记录", icon: Target },
  { to: "/schedules", label: "定时任务", icon: Clock },
  { to: "/instances", label: "运行实例", icon: Server },
  { to: "/findings", label: "发现结果", icon: ShieldAlert },
  { to: "/live", label: "实时流", icon: Radio },
  { to: "/email", label: "邮件分类", icon: Mail },
  { to: "/reports", label: "报告", icon: FileText },
  { to: "/integrations", label: "集成", icon: Plug },
  { to: "/settings", label: "设置", icon: Settings },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { data: version } = useVersion();
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
          <img src="/logo.png" alt="" className="h-full w-full object-cover" aria-hidden />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">Sword-Riding</span>
          <span className="text-[10px] text-muted-foreground mono">
            {version?.version ? `v${version.version}` : "安全扫描器"}
          </span>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3" aria-label="Primary">
        <ul className="space-y-0.5 px-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                    )
                  }
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-border px-4 py-3 text-[10px] text-muted-foreground mono">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3 w-3" aria-hidden />
          <span>本地扫描器</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 opacity-70">
          <AlertOctagon className="h-3 w-3" aria-hidden />
          <span>Ctrl+K 打开操作面板</span>
        </div>
      </div>
    </aside>
  );
}
