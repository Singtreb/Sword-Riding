import { useNavigate } from "react-router-dom";
import { useMemo, useState, type FormEvent } from "react";
import {
  ChevronLeft,
  ImageIcon,
  Loader2,
  Play,
  Radar,
  Save,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PHASES } from "@/components/phase-progress";
import { api } from "@/api/client";
import { useAuthProfiles, useLLMSettings, useProviders, useStartScan } from "@/api/queries";
import { cn } from "@/lib/utils";

const SCAN_MODES = [
  {
    value: "single",
    label: "单一目标",
    hint: "仅测试您提供的内容。不进行子域名枚举。",
  },
  {
    value: "wildcard",
    label: "通配符/多目标",
    hint: "枚举子域名，然后扫描每个子域名。",
  },
  {
    value: "dast",
    label: "DAST",
    hint: "使用浏览器驱动探测进行认证应用测试。",
  },
];

const SEVERITIES = ["info", "low", "medium", "high", "critical"];
type ActivityMode = "active" | "passive";

const ACTIVITY_OPTIONS: Array<{
  value: ActivityMode;
  label: string;
  hint: string;
}> = [
  {
    value: "passive",
    label: "仅被动",
    hint: "公共来源和现有证据。不进行直接目标请求。",
  },
  {
    value: "active",
    label: "允许主动",
    hint: "允许直接范围内探测和验证。",
  },
];

export default function NewScanPage() {
  const nav = useNavigate();
  const startScan = useStartScan();
  const llmQuery = useLLMSettings();

  const [targetsText, setTargetsText] = useState("");
  const [name, setName] = useState("");
  const [scanMode, setScanMode] = useState("single");
  const [reconMode, setReconMode] = useState<ActivityMode>("active");
  const [scanIntensity, setScanIntensity] = useState<ActivityMode>("active");
  const [instruction, setInstruction] = useState("");
  const [selectedPhases, setSelectedPhases] = useState<number[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [model, setModel] = useState("");
  // Optional "<provider>:<profileId>" key naming a stored AuthProfile
  // (provider-catalog-and-oauth, R11.1, R14.4). Empty string ("default"
  // option) means "let the server pick" — don't send provider_profile
  // and the legacy / catalog-default path resolves the credentials.
  const [providerProfile, setProviderProfile] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [logoPath, setLogoPath] = useState("");
  const [logoFileName, setLogoFileName] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targets = useMemo(
    () =>
      targetsText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [targetsText],
  );

  // Profile picker source. Profiles drive the picker; the catalog
  // (separate query) supplies the human-readable displayName per
  // entry. Both queries fail open: when neither has loaded yet (or
  // the user has no profiles configured) the picker collapses to
  // the single "Server default" option.
  const profilesQuery = useAuthProfiles();
  const catalogQuery = useProviders();
  const profileOptions = useMemo(() => {
    const profiles = profilesQuery.data ?? [];
    const catalog = catalogQuery.data ?? [];
    const byID = new Map(catalog.map((e) => [e.id, e]));
    return profiles.map((p) => {
      const entry = byID.get(p.provider);
      const display = entry?.displayName ?? p.provider;
      return {
        value: `${p.provider}:${p.profileId}`,
        label: `${display} · ${p.profileId}`,
      };
    });
  }, [profilesQuery.data, catalogQuery.data]);

  function togglePhase(id: number) {
    setSelectedPhases((cur) =>
      cur.includes(id)
        ? cur.filter((p) => p !== id)
        : [...cur, id].sort((a, b) => a - b),
    );
  }
  function toggleSeverity(s: string) {
    setSeverityFilter((cur) =>
      cur.includes(s) ? cur.filter((p) => p !== s) : [...cur, s],
    );
  }
  function updateScanIntensity(value: ActivityMode) {
    setScanIntensity(value);
    if (value === "passive") setReconMode("passive");
  }

  async function uploadReportLogo(file?: File) {
    if (!file) return;
    setError(null);
    if (!/\.(png|jpe?g)$/i.test(file.name)) {
      setError("Report logos must be PNG or JPEG.");
      return;
    }
    setLogoUploading(true);
    try {
      const res = await api.uploadLogo(file);
      setLogoPath(res.path);
      setLogoFileName(res.filename || file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload logo");
    } finally {
      setLogoUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await submitScan(false);
  }

  async function submitScan(saveOnly: boolean) {
    setError(null);
    if (!targets.length) {
      setError("At least one target is required.");
      return;
    }
    try {
      const res = await startScan.mutateAsync({
        targets,
        name: name.trim() || undefined,
        scan_mode: scanMode,
        instruction: instruction.trim() || undefined,
        phases: selectedPhases.length ? selectedPhases : undefined,
        recon_mode: reconMode,
        scan_intensity: scanIntensity,
        severity_filter: severityFilter.length ? severityFilter : undefined,
        model: model.trim() || undefined,
        provider_profile: providerProfile || undefined,
        company_name: companyName.trim() || undefined,
        logo_path: logoPath || undefined,
        save_only: saveOnly || undefined,
      });
      const id =
        (res as { id?: string; instance_id?: string })?.instance_id ||
        (res as { id?: string })?.id;
      if (id) nav(`/scans/${id}`);
      else nav("/scans");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : saveOnly
            ? "Failed to save scan"
            : "Failed to start scan",
      );
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => nav(-1)}
          className="text-muted-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> 返回
        </Button>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">
          开始新的扫描
        </h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          配置目标、范围和方法论阶段。Xalgorix编排侦察和主动探测，然后与代理综合生成发现结果。
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">目标</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="targets">目标 *</Label>
              <Textarea
                id="targets"
                required
                placeholder={"example.com\nhttps://app.example.com"}
                value={targetsText}
                onChange={(e) => setTargetsText(e.target.value)}
                rows={3}
                className="mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                每行一个，或用逗号分隔。可以是域名、主机或URL。
              </p>
              {targets.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  {targets.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="mono text-[10px]"
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">显示名称（可选）</Label>
              <Input
                id="name"
                placeholder="如果为空则从目标自动生成"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">目标访问</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Radar className="h-3.5 w-3.5 text-muted-foreground" />
                侦察阶段
              </Label>
              <div className="grid gap-2">
                {ACTIVITY_OPTIONS.map((option) => {
                  const active = reconMode === option.value;
                  const disabled =
                    scanIntensity === "passive" && option.value === "active";
                  return (
                    <button
                      type="button"
                      key={option.value}
                      disabled={disabled}
                      onClick={() => setReconMode(option.value)}
                      className={cn(
                        "rounded-md border border-border bg-card p-3 text-left transition-colors",
                        "hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-50",
                        active &&
                          "border-primary/70 bg-primary/5 ring-1 ring-primary/30",
                      )}
                    >
                      <div className="text-sm font-medium">{option.label}</div>
                      <p className="mt-1 text-[11px] text-muted-foreground text-pretty">
                        {option.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                测试阶段
              </Label>
              <div className="grid gap-2">
                {ACTIVITY_OPTIONS.map((option) => {
                  const active = scanIntensity === option.value;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => updateScanIntensity(option.value)}
                      className={cn(
                        "rounded-md border border-border bg-card p-3 text-left transition-colors",
                        "hover:border-foreground/30",
                        active &&
                          "border-primary/70 bg-primary/5 ring-1 ring-primary/30",
                      )}
                    >
                      <div className="text-sm font-medium">{option.label}</div>
                      <p className="mt-1 text-[11px] text-muted-foreground text-pretty">
                        {option.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">报告品牌</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[1fr_220px]">
            <div className="space-y-2">
              <Label htmlFor="companyName">目标品牌名称</Label>
              <Input
                id="companyName"
                placeholder="显示在PDF封面"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>目标品牌标志</Label>
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                  {logoPath ? (
                    <img
                      src={logoPath}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="reportLogo"
                      className={cn(
                        "inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-transparent px-3 text-xs font-medium transition-colors hover:bg-accent",
                        logoUploading && "pointer-events-none opacity-60",
                      )}
                    >
                      {logoUploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      上传
                    </label>
                    <Input
                      id="reportLogo"
                      type="file"
                      accept="image/png,image/jpeg"
                      disabled={logoUploading}
                      className="hidden"
                      onChange={(e) => {
                        void uploadReportLogo(e.currentTarget.files?.[0]);
                        e.currentTarget.value = "";
                      }}
                    />
                    {logoPath && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setLogoPath("");
                          setLogoFileName("");
                        }}
                        aria-label="Remove report logo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {logoFileName && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {logoFileName}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">扫描模式</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {SCAN_MODES.map((m) => (
                <button
                  type="button"
                  key={m.value}
                  onClick={() => setScanMode(m.value)}
                  className={cn(
                    "rounded-md border border-border bg-card p-3 text-left transition-colors",
                    "hover:border-foreground/30",
                    scanMode === m.value &&
                      "border-primary/70 bg-primary/5 ring-1 ring-primary/30",
                  )}
                >
                  <div className="text-sm font-medium">{m.label}</div>
                  <p className="mt-1 text-[11px] text-muted-foreground text-pretty">
                    {m.hint}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              方法论阶段
              <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                {selectedPhases.length
                  ? `已选择 ${selectedPhases.length} 个`
                  : "所有阶段（默认）"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {PHASES.map((p) => {
                const active = selectedPhases.includes(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => togglePhase(p.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-left text-xs transition-colors",
                      "hover:border-foreground/30",
                      active &&
                        "border-primary/70 bg-primary/5 text-foreground",
                      !active && "text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "mono inline-flex h-5 w-7 shrink-0 items-center justify-center rounded text-[10px]",
                        active
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {String(p.id).padStart(2, "0")}
                    </span>
                    <span className="truncate">{p.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSelectedPhases([])}
              >
                所有阶段
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSelectedPhases([1, 22])}
              >
                仅侦察+报告
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">优化</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>严重程度过滤</Label>
              <div className="flex flex-wrap gap-1.5">
                {SEVERITIES.map((s) => {
                  const active = severityFilter.includes(s);
                  const label = s === "critical" ? "严重" : s === "high" ? "高危" : s === "medium" ? "中危" : s === "low" ? "低危" : "信息";
                  return (
                    <button
                      type="button"
                      key={s}
                      onClick={() => toggleSeverity(s)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] capitalize transition-colors",
                        active
                          ? "border-primary/60 bg-primary/10 text-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                仅报告选定严重程度及以上级别的发现。留空则包含所有级别。
              </p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="instr">自定义指令</Label>
              <Textarea
                id="instr"
                placeholder="例如：重点关注/checkout的支付流程，跳过/static/。"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">模型覆盖</Label>
              <Input
                id="model"
                placeholder={llmQuery.data?.model || "provider/model-name"}
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                覆盖此扫描使用的模型。留空则使用服务器默认设置{llmQuery.data?.model ? ` (${llmQuery.data.model})` : ""}。
              </p>
            </div>
            <div className="space-y-2">
              <Label>提供商配置</Label>
              <Select
                value={providerProfile || "default"}
                onValueChange={(v) =>
                  setProviderProfile(v === "default" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">服务器默认</SelectItem>
                  {profileOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                选择一个存储的凭证配置来路由此扫描。在"设置 → 提供商"下管理配置。
              </p>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="outline" onClick={() => nav(-1)}>
            取消
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!targets.length || startScan.isPending}
            onClick={() => void submitScan(true)}
          >
            {startScan.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            保存备用
          </Button>
          <Button
            type="submit"
            disabled={!targets.length || startScan.isPending}
          >
            {startScan.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            开始扫描
          </Button>
        </div>
      </form>
    </div>
  );
}
