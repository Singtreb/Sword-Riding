import { cn } from "@/lib/utils";

// Xalgorix 22-phase methodology. The backend reports `current_phase` and
// `phases` as 1-based ids into this list, and the New Scan form lets the
// operator opt into any subset. Keeping a single source of truth here
// prevents the dashboard from drifting out of sync with the scan form.
export const PHASES: { id: number; name: string }[] = [
  { id: 1, name: "侦察与攻击面映射" },
  { id: 2, name: "手动漏洞发现" },
  { id: 3, name: "目录与文件发现" },
  { id: 4, name: "CORS与Cookie分析" },
  { id: 5, name: "认证与会话测试" },
  { id: 6, name: "注入测试" },
  { id: 7, name: "SSRF测试" },
  { id: 8, name: "IDOR与访问控制" },
  { id: 9, name: "API与GraphQL测试" },
  { id: 10, name: "文件上传测试" },
  { id: 11, name: "反序列化与RCE" },
  { id: 12, name: "竞态与业务逻辑" },
  { id: 13, name: "子域名接管" },
  { id: 14, name: "开放重定向" },
  { id: 15, name: "邮件安全测试" },
  { id: 16, name: "云与基础设施" },
  { id: 17, name: "WebSocket测试" },
  { id: 18, name: "CMS专项测试" },
  { id: 19, name: "链接劫持与内容欺骗" },
  { id: 20, name: "漏洞验证" },
  { id: 21, name: "零日漏洞发现" },
  { id: 22, name: "最终报告" },
];

export function PhaseProgress({
  current,
  selected,
  status,
  className,
}: {
  current?: number;
  selected?: number[];
  status?: string;
  className?: string;
}) {
  const isRunning = (status || "").toLowerCase() === "running";
  const selectedSet = new Set(
    selected && selected.length ? selected : PHASES.map((p) => p.id),
  );
  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={PHASES.length}
      aria-valuenow={current ?? undefined}
      aria-label="Scan phase progress"
    >
      {PHASES.map((p) => {
        const isSelected = selectedSet.has(p.id);
        const isCurrent = isRunning && current === p.id;
        const isPassed = current ? p.id < current : false;
        return (
          <div
            key={p.id}
            title={`${p.id}. ${p.name}`}
            className={cn(
              "h-1.5 flex-1 rounded-sm transition-colors",
              !isSelected && "bg-muted/40",
              isSelected && !isPassed && !isCurrent && "bg-muted",
              isPassed && "bg-emerald-500/70",
              isCurrent && "bg-amber-400 pulse-dot",
            )}
          />
        );
      })}
    </div>
  );
}
