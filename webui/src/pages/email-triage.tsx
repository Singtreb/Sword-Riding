import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Inbox, Mail, Radio, ShieldAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states";
import { useAgentMail } from "@/api/queries";
import { useWSStore, type FeedEvent } from "@/store/ws";
import { timeAgo } from "@/lib/utils";

const AGENTMAIL_EVENT_TYPES = new Set([
  "agentmail",
  "agentmail_event",
  "agentmail_message",
  "agentmail_received",
  "email_received",
]);

const AGENTMAIL_ACTIONS = new Set([
  "create_inbox",
  "list_inboxes",
  "get_inbox",
  "list_messages",
  "get_message",
  "wait_for_email",
]);

function isAgentMailEvent(event: FeedEvent): boolean {
  const type = (event.type || "").trim().toLowerCase();
  const toolName = (event.tool_name || "").trim().toLowerCase();
  const action = (event.tool_args?.action || "").trim().toLowerCase();

  if (toolName === "agentmail") return true;
  if (AGENTMAIL_EVENT_TYPES.has(type)) return true;
  return type.startsWith("agentmail_") || AGENTMAIL_ACTIONS.has(action);
}

function eventTitle(event: FeedEvent): string {
  const action = event.tool_args?.action;
  if (event.tool_name === "agentmail" && action) {
    return action.replaceAll("_", " ");
  }
  return event.type || "event";
}

export default function EmailTriagePage() {
  const { data: mail } = useAgentMail();
  const events = useWSStore((s) => s.events);

  const emailEvents = useMemo<FeedEvent[]>(
    () => events.filter((e: FeedEvent) => isAgentMailEvent(e)),
    [events],
  );

  const configured = !!mail?.pod && !!mail?.hasApiKey;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-sans text-2xl font-semibold tracking-tight">
          邮件分类
        </h1>
        <p className="text-sm text-muted-foreground">
          实时AgentMail事件和摄入状态。
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Inbox className="h-4 w-4" /> AgentMail pod
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-sm text-foreground">
              {mail?.pod || (
                <span className="text-muted-foreground">未配置</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldAlert className="h-4 w-4" /> API密钥
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mail?.hasApiKey ? (
              <Badge variant="success">
                <CheckCircle2 className="mr-1 h-3 w-3" /> 已设置
              </Badge>
            ) : (
              <Badge variant="muted">缺失</Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Radio className="h-4 w-4" /> 状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            {configured ? (
              <Badge variant="success">监听中</Badge>
            ) : (
              <Badge variant="warning">需要设置</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" /> 实时事件
            </CardTitle>
            <CardDescription>
              来自全局代理流的仅AgentMail事件。分类决策将在发生时显示在这里。
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/settings">配置</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {emailEvents.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="暂无邮件事件"
                description={
                  configured
                    ? "通过AgentMail路由的入站消息将显示在这里。"
                    : "在设置中添加pod和API密钥以开始摄入。"
                }
                icon={<Mail className="h-6 w-6" />}
                action={
                  !configured ? (
                    <Button asChild size="sm">
                      <Link to="/settings">设置AgentMail</Link>
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {emailEvents.slice(0, 60).map((evt: FeedEvent) => {
                const text = evt.content || evt.output || evt.tool_name || "";
                return (
                  <li
                    key={evt._key}
                    className="flex items-start gap-3 px-4 py-3 text-sm hover:bg-muted/30"
                  >
                    <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-success" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {eventTitle(evt)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(evt.timestamp)}
                        </span>
                      </div>
                      {text && (
                        <p className="mt-1 truncate font-mono text-xs text-foreground/90">
                          {text}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
