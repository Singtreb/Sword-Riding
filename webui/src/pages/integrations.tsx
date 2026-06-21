import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ExternalLink,
  Mail,
  MessageSquare,
  Plug,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useAgentMail,
  useEnvironmentSettings,
  useRateLimit,
  useVersion,
} from "@/api/queries";
import { cn } from "@/lib/utils";

type Integration = {
  key: string;
  name: string;
  description: string;
  category: "AI" | "Email" | "Notifications" | "Engagement";
  icon: typeof Plug;
  configurePath?: string;
  configureLabel?: string;
  external?: string;
  isConfigured: boolean;
  detail?: string;
};

export default function IntegrationsPage() {
  const mail = useAgentMail();
  const rate = useRateLimit();
  const version = useVersion();
  const environment = useEnvironmentSettings();
  const ai = version.data?.ai;
  const usesVercelGateway = ai?.gateway === "vercel";
  const discordWebhook = environment.data?.variables.find(
    (variable) => variable.key === "XALGORIX_DISCORD_WEBHOOK",
  );

  const integrations: Integration[] = [
    {
      key: "llm-provider",
      name: usesVercelGateway ? "Vercel AI Gateway" : "LLM提供商",
      description: usesVercelGateway
        ? "通过Vercel AI Gateway为安全代理提供多提供商LLM访问。"
        : "安全代理用于规划、测试和报告的直接模型提供商。",
      category: "AI",
      icon: Sparkles,
      configurePath: "/settings?tab=llm",
      configureLabel: "打开设置",
      external: usesVercelGateway ? "https://vercel.com/docs/ai-gateway" : undefined,
      isConfigured: Boolean(ai?.configured),
      detail: ai
        ? `${ai.provider}${ai.model ? ` · ${ai.model}` : ""}`
        : "正在加载提供商状态...",
    },
    {
      key: "agentmail",
      name: "AgentMail",
      description:
        "入站邮件分类：转发安全邮箱，让代理分类、优先级排序和响应。",
      category: "Email",
      icon: Mail,
      configurePath: "/settings?tab=email",
      configureLabel: "配置",
      external: "https://agentmail.to",
      isConfigured: Boolean(mail.data?.hasApiKey && mail.data?.pod),
      detail: mail.data?.pod ? `Pod: ${mail.data.pod}` : "未连接",
    },
    {
      key: "discord",
      name: "Discord webhook",
      description:
        "将严重发现和扫描摘要实时流式传输到Discord频道。",
      category: "Notifications",
      icon: MessageSquare,
      configurePath: "/settings?tab=notifications",
      configureLabel: "配置",
      external: "https://discord.com/developers/docs/resources/webhook",
      isConfigured: Boolean(discordWebhook?.hasValue),
      detail: discordWebhook?.hasValue
        ? "已配置全局webhook"
        : "全局默认值，支持每个扫描覆盖。",
    },
    {
      key: "rate-limit",
      name: "出站速率限制器",
      description:
        "限制代理以使其保持在目标SLA和赏金任务规则范围内。",
      category: "Engagement",
      icon: ShieldCheck,
      configurePath: "/settings?tab=engagement",
      configureLabel: "调整",
      isConfigured: Boolean(rate.data?.requests),
      detail: rate.data
        ? `${rate.data.requests} 请求 / ${rate.data.window}秒窗口`
        : "正在加载...",
    },
  ];

  const byCategory = groupBy(integrations, (i) => i.category);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">集成</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          代理可以连接的服务。配置一次，在每次扫描中重复使用。
        </p>
      </div>

      {(["AI", "Email", "Notifications", "Engagement"] as const).map((cat) => {
        const items = byCategory[cat] ?? [];
        if (!items.length) return null;
        const catLabel = cat === "AI" ? "AI" : cat === "Email" ? "邮件" : cat === "Notifications" ? "通知" : "任务";
        return (
          <section key={cat} className="space-y-3">
            <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {catLabel}
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((it) => (
                <IntegrationCard key={it.key} integration={it} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function IntegrationCard({ integration }: { integration: Integration }) {
  const Icon = integration.icon;
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border",
              integration.isConfigured
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-border bg-muted text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-foreground">
                {integration.name}
              </h3>
              {integration.isConfigured ? (
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                  <CheckCircle2 className="h-3 w-3" /> 已连接
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  未连接
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground text-pretty">
              {integration.description}
            </p>
            {integration.detail && (
              <p className="mt-2 mono text-[11px] text-muted-foreground">
                {integration.detail}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          {integration.external && (
            <Button asChild size="sm" variant="ghost">
              <a href={integration.external} target="_blank" rel="noreferrer">
                文档 <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
          {integration.configurePath && (
            <Button asChild size="sm" variant="outline">
              <Link to={integration.configurePath}>
                {integration.configureLabel || "配置"}
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function groupBy<T, K extends string>(arr: T[], key: (t: T) => K) {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {});
}
