import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, RefreshCw, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/states";
import {
  useAgentMail,
  useAuthProfiles,
  useDeleteAuthProfile,
  useEnvironmentSettings,
  useLLMSettings,
  useProviders,
  useRateLimit,
  useRefreshAuthProfile,
  useUpdateAgentMail,
  useUpdateEnvironmentSettings,
  useUpdateLLMSettings,
  useUpdateRateLimit,
  useAuthStatus,
} from "@/api/queries";
import { useAuth } from "@/store/auth";
import type {
  AuthProfile,
  CatalogEntry,
  EnvironmentSettings,
  EnvironmentVariableSetting,
  LLMSettingsRequest,
} from "@/types/api";
import OAuthModal from "./settings/oauth-modal";

const settingsTabs = [
  "llm",
  "engagement",
  "notifications",
  "email",
  "environment",
  "account",
] as const;

type SettingsTab = (typeof settingsTabs)[number];

// LLMFormState mirrors the catalog-aware POST shape. We keep the
// numeric / Gemini fields here too so the bottom row of inputs
// (max retries, memory timeout, max iterations, Gemini search key)
// continues to live on the same tab. Empty string sentinels make
// the diff against the loaded settings state explicit.
interface LLMFormState {
  provider: string;
  authMethod: "" | "api_key" | "oauth" | "none";
  profileId: string;
  apiKey: string;
  apiBase: string;
  apiBaseOverride: string;
  model: string;
  reasoningEffort: string;
  llmMaxRetries: number;
  memoryCompressorTimeout: number;
  maxIterations: number;
  geminiApiKey: string;
  hasApiKey: boolean;
  hasGeminiApiKey: boolean;
  envFile: string;
  activeProfileKey: string;
}

const emptyLLMForm: LLMFormState = {
  provider: "",
  authMethod: "",
  profileId: "default",
  apiKey: "",
  apiBase: "",
  apiBaseOverride: "",
  model: "",
  reasoningEffort: "high",
  llmMaxRetries: 5,
  memoryCompressorTimeout: 30,
  maxIterations: 0,
  geminiApiKey: "",
  hasApiKey: false,
  hasGeminiApiKey: false,
  envFile: "",
  activeProfileKey: "",
};

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") as SettingsTab | null;
  const activeTab = settingsTabs.includes(requestedTab as SettingsTab)
    ? (requestedTab as SettingsTab)
    : "llm";

  const rate = useRateLimit();
  const updateRate = useUpdateRateLimit();
  const mail = useAgentMail();
  const updateMail = useUpdateAgentMail();
  const llm = useLLMSettings();
  const updateLLM = useUpdateLLMSettings();
  const environment = useEnvironmentSettings();
  const updateEnvironment = useUpdateEnvironmentSettings();
  const auth = useAuthStatus();
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();

  const providers = useProviders();
  const profiles = useAuthProfiles();
  const refreshProfile = useRefreshAuthProfile();
  const deleteProfile = useDeleteAuthProfile();

  const [rateForm, setRateForm] = useState({ requests: 10, window: 1 });
  const [mailForm, setMailForm] = useState({ pod: "", apiKey: "" });
  const [llmForm, setLLMForm] = useState<LLMFormState>(emptyLLMForm);
  const [oauthOpen, setOAuthOpen] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    webhook: "",
    minSeverity: "",
  });
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [envChanges, setEnvChanges] = useState<Record<string, string>>({});
  const [envFilter, setEnvFilter] = useState("");
  const [envRestartRequired, setEnvRestartRequired] = useState(false);
  const [savedRate, setSavedRate] = useState(false);
  const [savedMail, setSavedMail] = useState(false);
  const [savedLLM, setSavedLLM] = useState(false);
  const [savedNotifications, setSavedNotifications] = useState(false);
  const [savedEnvironment, setSavedEnvironment] = useState(false);

  useEffect(() => {
    if (rate.data) {
      setRateForm({
        requests: rate.data.requests ?? 10,
        window: rate.data.window ?? 1,
      });
    }
  }, [rate.data]);

  useEffect(() => {
    if (mail.data) {
      setMailForm({
        pod: mail.data.pod ?? "",
        apiKey: mail.data.apiKey ?? "",
      });
    }
  }, [mail.data]);

  useEffect(() => {
    if (!llm.data) return;
    // Derive the form state from the settings response. We keep
    // both the legacy fields (model/apiBase/apiKey) and the new
    // catalog fields (provider/authMethod/activeProfileKey) so a
    // user who picks a provider but doesn't change anything else
    // still sees the saved values in the lower-row inputs.
    setLLMForm({
      provider: llm.data.provider ?? "",
      authMethod: (llm.data.authMethod as LLMFormState["authMethod"]) ?? "",
      profileId: "default",
      apiKey: llm.data.apiKey ?? "",
      apiBase: llm.data.apiBase ?? "",
      apiBaseOverride: "",
      model: llm.data.model ?? "",
      reasoningEffort: llm.data.reasoningEffort || "high",
      llmMaxRetries: llm.data.llmMaxRetries ?? 5,
      memoryCompressorTimeout: llm.data.memoryCompressorTimeout ?? 30,
      maxIterations: llm.data.maxIterations ?? 0,
      geminiApiKey: llm.data.geminiApiKey ?? "",
      hasApiKey: llm.data.hasApiKey ?? false,
      hasGeminiApiKey: llm.data.hasGeminiApiKey ?? false,
      envFile: llm.data.envFile ?? "",
      activeProfileKey: llm.data.activeProfileKey ?? "",
    });
  }, [llm.data]);

  useEffect(() => {
    const webhook = envValue(environment.data, "XALGORIX_DISCORD_WEBHOOK");
    const minSeverity = envValue(environment.data, "XALGORIX_DISCORD_MIN_SEVERITY");
    setNotificationForm({ webhook, minSeverity });
  }, [environment.data]);

  useEffect(() => {
    if (!environment.data) return;
    setEnvValues(
      Object.fromEntries(
        environment.data.variables.map((variable) => [
          variable.key,
          variable.value ?? "",
        ]),
      ),
    );
    setEnvChanges({});
  }, [environment.data]);

  // Sort providers alphabetically by displayName, with the
  // "custom" sentinel pinned last because it represents free-form
  // user-supplied endpoints rather than a discrete provider.
  const sortedProviders = useMemo<CatalogEntry[]>(() => {
    const list = providers.data ?? [];
    return [...list].sort((a, b) => {
      if (a.id === "custom") return 1;
      if (b.id === "custom") return -1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [providers.data]);

  const selectedProvider = useMemo<CatalogEntry | undefined>(() => {
    if (!llmForm.provider) return undefined;
    return sortedProviders.find((p) => p.id === llmForm.provider);
  }, [sortedProviders, llmForm.provider]);

  // Auth methods come straight from the catalog entry. Custom
  // provider always supports api_key (it's just a free-form base
  // URL + key); local-runtime providers (Ollama, LM Studio) only
  // expose "none". The default selection is the first method in
  // AuthMethods, falling back to api_key.
  const availableAuthMethods = useMemo<string[]>(() => {
    if (!selectedProvider) return [];
    return selectedProvider.id === "custom"
      ? ["api_key"]
      : selectedProvider.authMethods ?? ["api_key"];
  }, [selectedProvider]);

  // Filter the profile list to the selected provider for the
  // saved-credentials picker. The dashboard never sees plaintext
  // credentials — only the masked envelope.
  const providerProfiles = useMemo<AuthProfile[]>(() => {
    if (!llmForm.provider) return [];
    return (profiles.data ?? []).filter((p) => p.provider === llmForm.provider);
  }, [profiles.data, llmForm.provider]);

  function changeTab(value: string) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next, { replace: true });
  }

  function changeProvider(providerId: string) {
    const entry = sortedProviders.find((p) => p.id === providerId);
    const methods = entry?.authMethods ?? ["api_key"];
    const firstModel = entry?.models?.[0] ?? "";
    setLLMForm((current) => ({
      ...current,
      provider: providerId,
      authMethod: (methods[0] as LLMFormState["authMethod"]) ?? "api_key",
      // Prefill the model field with the catalog suggestion so the
      // user sees a working default. They can still override it.
      model: firstModel ? `${providerId}/${firstModel}` : current.model,
      // apiBase resets to the catalog default; "custom" leaves the
      // current free-text base intact.
      apiBase: entry?.id === "custom" ? current.apiBase : entry?.baseURL ?? "",
    }));
  }

  function updateEnvValue(variable: EnvironmentVariableSetting, value: string) {
    setEnvValues((current) => ({ ...current, [variable.key]: value }));
    setEnvChanges((current) => {
      const next = { ...current };
      if (value === (variable.value ?? "")) {
        delete next[variable.key];
      } else {
        next[variable.key] = value;
      }
      return next;
    });
  }

  async function saveLLMSettings() {
    setSavedLLM(false);
    const profileId = llmForm.profileId || "default";
    const req: LLMSettingsRequest = {
      provider: llmForm.provider,
      authMethod: (llmForm.authMethod || "api_key") as
        | "api_key"
        | "oauth"
        | "none",
      profileId,
      model: llmForm.model,
      reasoningEffort: llmForm.reasoningEffort,
      llmMaxRetries: llmForm.llmMaxRetries,
      memoryCompressorTimeout: llmForm.memoryCompressorTimeout,
      maxIterations: llmForm.maxIterations,
    };
    if (llmForm.authMethod === "api_key") {
      // Only send the apiKey when the user actually typed
      // something — the masked **** value means "leave the
      // saved key alone" (matches the legacy POST contract).
      if (!isMaskedSettingValue(llmForm.apiKey)) {
        req.apiKey = llmForm.apiKey;
      }
      if (llmForm.apiBaseOverride) {
        req.apiBaseOverride = llmForm.apiBaseOverride;
      }
      if (selectedProvider?.id === "custom" && llmForm.apiBase) {
        req.apiBase = llmForm.apiBase;
      }
    }
    if (llmForm.authMethod === "oauth" && llmForm.provider) {
      // OAuth providers (e.g. Codex ChatGPT subscription) finish their
      // sign-in through the OAuth modal, which persists a profile keyed
      // "<provider>:<profileId>". Saving the LLM tab must point the active
      // credential pointer (XALGORIX_LLM_PROFILE) at that profile —
      // otherwise the backend keeps the previous (legacy) provider and only
      // the model changes. Prefer an explicitly-selected profile key.
      req.activeProfileKey =
        llmForm.activeProfileKey || `${llmForm.provider}:${profileId}`;
    }
    if (!isMaskedSettingValue(llmForm.geminiApiKey)) {
      req.geminiApiKey = llmForm.geminiApiKey;
    }
    await updateLLM.mutateAsync(req);
    setSavedLLM(true);
    setTimeout(() => setSavedLLM(false), 2500);
  }

  async function setActiveProfile(profile: AuthProfile) {
    await updateLLM.mutateAsync({
      activeProfileKey: profile.key ?? `${profile.provider}:${profile.profileId}`,
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-sans text-2xl font-semibold tracking-tight">
          设置
        </h1>
        <p className="text-sm text-muted-foreground">
          LLM 提供者、环境变量、集成和账户访问。
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={changeTab}>
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="llm">LLM 设置</TabsTrigger>
          <TabsTrigger value="engagement">扫描频率</TabsTrigger>
          <TabsTrigger value="notifications">通知设置</TabsTrigger>
          <TabsTrigger value="email">AgentMail</TabsTrigger>
          <TabsTrigger value="environment">环境变量</TabsTrigger>
          <TabsTrigger value="account">账户</TabsTrigger>
        </TabsList>

        <TabsContent value="llm">
          {llm.isLoading || providers.isLoading ? (
            <Skeleton className="h-96" />
          ) : llm.error ? (
            <ErrorState
              title="加载 LLM 设置失败"
              description={llm.error instanceof Error ? llm.error.message : "未知错误"}
              action={
                <Button size="sm" variant="outline" onClick={() => llm.refetch()}>
                  重试
                </Button>
              }
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>LLM 提供者</CardTitle>
                <CardDescription>
                  保存到 {llmForm.envFile || "~/.xalgorix.env"} 并用于新扫描。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="llm-provider">提供者</Label>
                    <Select
                      value={llmForm.provider || "__unset__"}
                      onValueChange={(value) =>
                        changeProvider(value === "__unset__" ? "" : value)
                      }
                    >
                      <SelectTrigger id="llm-provider">
                        <SelectValue placeholder="选择提供者" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unset__">未选择</SelectItem>
                        {sortedProviders.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedProvider && availableAuthMethods.length > 1 && (
                    <div className="space-y-2">
                      <Label>认证方式</Label>
                      <div className="flex flex-wrap gap-2 rounded-md border border-border bg-muted/30 p-1">
                        {availableAuthMethods.map((method) => (
                          <Button
                            key={method}
                            type="button"
                            size="sm"
                            variant={
                              llmForm.authMethod === method ? "default" : "ghost"
                            }
                            onClick={() =>
                              setLLMForm({
                                ...llmForm,
                                authMethod: method as LLMFormState["authMethod"],
                              })
                            }
                          >
                            {prettyAuthMethod(method)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {selectedProvider?.notes && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    {selectedProvider.notes}
                  </div>
                )}

                {/* Auth-method-specific form */}
                {selectedProvider && llmForm.authMethod === "api_key" && (
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="llm-api-key">API 密钥</Label>
                      <Input
                        id="llm-api-key"
                        value={llmForm.apiKey}
                        onChange={(e) =>
                          setLLMForm({ ...llmForm, apiKey: e.target.value })
                        }
                        placeholder={llmForm.hasApiKey ? "**** (已保存)" : "sk-..."}
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        保持掩码值以保留已保存的密钥。
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="llm-model">模型</Label>
                      <Input
                        id="llm-model"
                        value={llmForm.model}
                        onChange={(e) =>
                          setLLMForm({ ...llmForm, model: e.target.value })
                        }
                        placeholder={selectedProvider.models?.[0] ?? "provider/model"}
                        className="font-mono"
                      />
                    </div>
                    {selectedProvider.id === "custom" ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="llm-api-base">基础 URL</Label>
                          <Input
                            id="llm-api-base"
                            value={llmForm.apiBase}
                            onChange={(e) =>
                              setLLMForm({ ...llmForm, apiBase: e.target.value })
                            }
                            placeholder="https://api.example.com/v1"
                            className="font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="llm-header-style">请求头格式</Label>
                          <Select
                            value={llmForm.apiBase ? "openai" : "openai"}
                            onValueChange={() => {}}
                            disabled
                          >
                            <SelectTrigger id="llm-header-style">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="openai">openai</SelectItem>
                              <SelectItem value="anthropic">anthropic</SelectItem>
                              <SelectItem value="gemini">gemini</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            自定义提供者默认使用 OpenAI 格式请求。如果您的端点使用 Anthropic 或 Gemini，请在环境变量标签页中切换。
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2 lg:col-span-2">
                        <Label htmlFor="llm-api-base-override">
                          API 基础地址覆盖（可选）
                        </Label>
                        <Input
                          id="llm-api-base-override"
                          value={llmForm.apiBaseOverride}
                          onChange={(e) =>
                            setLLMForm({
                              ...llmForm,
                              apiBaseOverride: e.target.value,
                            })
                          }
                          placeholder={selectedProvider.baseURL}
                          className="font-mono"
                        />
                        <p className="text-xs text-muted-foreground">
                          留空使用提供者默认值。
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {selectedProvider && llmForm.authMethod === "oauth" && (
                  <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
                    <p className="text-sm">
                      使用 {selectedProvider.displayName} 登录以创建新的 OAuth 配置文件。仪表板会轮询直到新凭证出现在下面的保存列表中。
                    </p>
                    <Button
                      type="button"
                      onClick={() => setOAuthOpen(true)}
                      disabled={!selectedProvider.flow}
                    >
                      使用 OAuth 登录
                    </Button>
                    {!selectedProvider.flow && (
                      <p className="text-xs text-muted-foreground">
                        此提供者尚未配置 OAuth。
                      </p>
                    )}
                  </div>
                )}

                {selectedProvider && llmForm.authMethod === "none" && (
                  <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
                    <p className="text-sm">
                      {selectedProvider.displayName} 运行在本地 — 无需凭证。只需确认下方的模型即可。
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="llm-model-local">模型</Label>
                      <Input
                        id="llm-model-local"
                        value={llmForm.model}
                        onChange={(e) =>
                          setLLMForm({ ...llmForm, model: e.target.value })
                        }
                        placeholder={selectedProvider.models?.[0] ?? "model"}
                        className="font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Saved-credentials picker for the active provider. */}
                {selectedProvider && providerProfiles.length > 0 && (
                  <div className="space-y-2">
                    <Label>已保存凭证</Label>
                    <div className="divide-y divide-border rounded-md border border-border">
                      {providerProfiles.map((profile) => {
                        const key =
                          profile.key ??
                          `${profile.provider}:${profile.profileId}`;
                        const active = key === llmForm.activeProfileKey;
                        return (
                          <div
                            key={key}
                            className="flex flex-wrap items-center gap-3 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                {profile.profileId}
                                <Badge variant="muted">{profile.type}</Badge>
                                {active && (
                                  <CheckCircle2 className="h-4 w-4 text-success" />
                                )}
                                {profile.requiresReauth && (
                                  <Badge variant="warning">
                                    <AlertTriangle className="mr-1 h-3 w-3" />
                                    需要重新认证
                                  </Badge>
                                )}
                              </div>
                              <div className="font-mono text-xs text-muted-foreground">
                                {profile.type === "oauth"
                                  ? maskedTokenLabel(profile)
                                  : maskedAPIKeyLabel(profile)}
                              </div>
                              {profile.expiresAt && (
                                <div className="text-xs text-muted-foreground">
                                  过期时间 {profile.expiresAt}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {!active && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={updateLLM.isPending}
                                  onClick={() => setActiveProfile(profile)}
                                >
                                  设置为活跃
                                </Button>
                              )}
                              {profile.type === "oauth" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={refreshProfile.isPending}
                                  onClick={() =>
                                    refreshProfile.mutateAsync(key)
                                  }
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={deleteProfile.isPending}
                                onClick={() => deleteProfile.mutateAsync(key)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Bottom row: numeric tuning that applies regardless
                    of provider / auth method. */}
                <div className="grid gap-3 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="llm-retries">LLM 最大重试次数</Label>
                    <Input
                      id="llm-retries"
                      type="number"
                      min={0}
                      max={20}
                      value={llmForm.llmMaxRetries}
                      onChange={(e) =>
                        setLLMForm({
                          ...llmForm,
                          llmMaxRetries: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="llm-memory-timeout">内存压缩超时</Label>
                    <Input
                      id="llm-memory-timeout"
                      type="number"
                      min={5}
                      max={600}
                      value={llmForm.memoryCompressorTimeout}
                      onChange={(e) =>
                        setLLMForm({
                          ...llmForm,
                          memoryCompressorTimeout: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="llm-max-iterations">最大迭代次数</Label>
                    <Input
                      id="llm-max-iterations"
                      type="number"
                      min={0}
                      max={1000}
                      value={llmForm.maxIterations}
                      onChange={(e) =>
                        setLLMForm({
                          ...llmForm,
                          maxIterations: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gemini-api-key">Gemini 搜索密钥</Label>
                    <Input
                      id="gemini-api-key"
                      value={llmForm.geminiApiKey}
                      onChange={(e) =>
                        setLLMForm({ ...llmForm, geminiApiKey: e.target.value })
                      }
                      placeholder={
                        llmForm.hasGeminiApiKey ? "**** (已保存)" : "AIza..."
                      }
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>推理强度</Label>
                    <Select
                      value={llmForm.reasoningEffort || "high"}
                      onValueChange={(value) =>
                        setLLMForm({ ...llmForm, reasoningEffort: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["low", "medium", "high", "xhigh"].map((value) => (
                          <SelectItem key={value} value={value}>
                            {value === "low" ? "低" : value === "medium" ? "中" : value === "high" ? "高" : "极高"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />
                <div className="flex items-center justify-end gap-3">
                  {savedLLM && <span className="text-xs text-success">已保存</span>}
                  <Button
                    onClick={saveLLMSettings}
                    disabled={updateLLM.isPending || !llmForm.provider}
                  >
                    {updateLLM.isPending ? "保存中..." : "保存 LLM 设置"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* OAuth modal — opens when the user clicks "Sign in with
              OAuth". Polls /api/auth/profiles until a new entry for
              this provider appears. */}
          {selectedProvider && (
            <OAuthModal
              open={oauthOpen}
              provider={selectedProvider.id}
              displayName={selectedProvider.displayName}
              existingKeys={(profiles.data ?? []).map(
                (p) => p.key ?? `${p.provider}:${p.profileId}`,
              )}
              onClose={() => setOAuthOpen(false)}
            />
          )}
        </TabsContent>

        <TabsContent value="engagement">
          {rate.isLoading ? (
            <Skeleton className="h-72" />
          ) : rate.error ? (
            <ErrorState
              title="加载速率限制失败"
              description={rate.error instanceof Error ? rate.error.message : "未知错误"}
              action={
                <Button size="sm" variant="outline" onClick={() => rate.refetch()}>
                  重试
                </Button>
              }
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>速率限制</CardTitle>
                <CardDescription>
                  应用于代理发出的出站请求，并持久化到环境变量文件。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="requests">每窗口期请求数</Label>
                    <Input
                      id="requests"
                      type="number"
                      min={1}
                      max={1000}
                      value={rateForm.requests}
                      onChange={(e) =>
                        setRateForm({
                          ...rateForm,
                          requests: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="window">窗口期（秒）</Label>
                    <Input
                      id="window"
                      type="number"
                      min={1}
                      max={600}
                      value={rateForm.window}
                      onChange={(e) =>
                        setRateForm({
                          ...rateForm,
                          window: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3">
                  {savedRate && (
                    <span className="text-xs text-success">已保存</span>
                  )}
                  <Button
                    onClick={async () => {
                      setSavedRate(false);
                      await updateRate.mutateAsync(rateForm);
                      setSavedRate(true);
                      setTimeout(() => setSavedRate(false), 2500);
                    }}
                    disabled={updateRate.isPending}
                  >
                    {updateRate.isPending ? "保存中..." : "保存"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notifications">
          {environment.isLoading ? (
            <Skeleton className="h-72" />
          ) : environment.error ? (
            <ErrorState
              title="加载通知设置失败"
              description={environment.error instanceof Error ? environment.error.message : "未知错误"}
              action={
                <Button size="sm" variant="outline" onClick={() => environment.refetch()}>
                  重试
                </Button>
              }
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Discord 通知</CardTitle>
                <CardDescription>
                  全局默认值，除非扫描提供自己的 webhook。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                  <div className="space-y-2">
                    <Label htmlFor="discord-webhook">Discord webhook</Label>
                    <Input
                      id="discord-webhook"
                      value={notificationForm.webhook}
                      onChange={(e) =>
                        setNotificationForm({
                          ...notificationForm,
                          webhook: e.target.value,
                        })
                      }
                      placeholder="https://discord.com/api/webhooks/..."
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      保持掩码值以保留已保存的 webhook。
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>最低严重性</Label>
                    <Select
                      value={notificationForm.minSeverity || "__unset__"}
                      onValueChange={(value) =>
                        setNotificationForm({
                          ...notificationForm,
                          minSeverity: value === "__unset__" ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unset__">默认</SelectItem>
                        {["info", "low", "medium", "high", "critical"].map((value) => (
                          <SelectItem key={value} value={value}>
                            {value === "info" ? "信息" : value === "low" ? "低危" : value === "medium" ? "中危" : value === "high" ? "高危" : "严重"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-end gap-3">
                  {savedNotifications && (
                    <span className="text-xs text-success">已保存</span>
                  )}
                  <Button
                    onClick={async () => {
                      setSavedNotifications(false);
                      await updateEnvironment.mutateAsync({
                        XALGORIX_DISCORD_WEBHOOK: notificationForm.webhook,
                        XALGORIX_DISCORD_MIN_SEVERITY: notificationForm.minSeverity,
                      });
                      setSavedNotifications(true);
                      setTimeout(() => setSavedNotifications(false), 2500);
                    }}
                    disabled={updateEnvironment.isPending}
                  >
                    {updateEnvironment.isPending ? "保存中..." : "保存通知设置"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="email">
          {mail.isLoading ? (
            <Skeleton className="h-72" />
          ) : mail.error ? (
            <ErrorState
              title="加载 AgentMail 设置失败"
              description={mail.error instanceof Error ? mail.error.message : "未知错误"}
              action={
                <Button size="sm" variant="outline" onClick={() => mail.refetch()}>
                  重试
                </Button>
              }
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>AgentMail</CardTitle>
                <CardDescription>
                  入站分类需要配置的 pod 和 API 密钥。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="pod">Pod</Label>
                  <Input
                    id="pod"
                    value={mailForm.pod}
                    onChange={(e) =>
                      setMailForm({ ...mailForm, pod: e.target.value })
                    }
                    placeholder="xalgorix-prod"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apikey">API 密钥</Label>
                  <Input
                    id="apikey"
                    value={mailForm.apiKey}
                    onChange={(e) =>
                      setMailForm({ ...mailForm, apiKey: e.target.value })
                    }
                    placeholder={mail.data?.hasApiKey ? "**** (已保存)" : "ak_..."}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    保持掩码值不变以保留现有密钥。
                  </p>
                </div>
                <Separator />
                <div className="flex items-center justify-end gap-3">
                  {savedMail && (
                    <span className="text-xs text-success">已保存</span>
                  )}
                  <Button
                    onClick={async () => {
                      setSavedMail(false);
                      await updateMail.mutateAsync(mailForm);
                      setSavedMail(true);
                      setTimeout(() => setSavedMail(false), 2500);
                    }}
                    disabled={updateMail.isPending}
                  >
                    {updateMail.isPending ? "保存中..." : "保存"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="environment">
          {environment.isLoading ? (
            <Skeleton className="h-96" />
          ) : environment.error ? (
            <ErrorState
              title="加载环境变量设置失败"
              description={environment.error instanceof Error ? environment.error.message : "未知错误"}
              action={
                <Button size="sm" variant="outline" onClick={() => environment.refetch()}>
                  重试
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              <Card>
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-medium">环境变量</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        编辑 {environment.data?.envFile || "~/.xalgorix.env"}。掩码的秘密除非替换或清除否则会保留。
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {envRestartRequired && (
                        <Badge variant="warning">部分更改需要重启</Badge>
                      )}
                      {Object.keys(envChanges).length > 0 && (
                        <Badge variant="outline">
                          {Object.keys(envChanges).length} 未保存
                        </Badge>
                      )}
                      {savedEnvironment && (
                        <span className="text-xs text-success">已保存</span>
                      )}
                      <Button
                        onClick={async () => {
                          setSavedEnvironment(false);
                          const response = await updateEnvironment.mutateAsync(envChanges);
                          setEnvRestartRequired(Boolean(response.restartRequired));
                          setEnvChanges({});
                          setSavedEnvironment(true);
                          setTimeout(() => setSavedEnvironment(false), 2500);
                        }}
                        disabled={
                          updateEnvironment.isPending ||
                          Object.keys(envChanges).length === 0
                        }
                      >
                        {updateEnvironment.isPending ? "保存中..." : "保存更改"}
                      </Button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={envFilter}
                      onChange={(e) => setEnvFilter(e.target.value)}
                      placeholder="搜索变量..."
                      className="pl-8"
                    />
                  </div>
                </CardContent>
              </Card>

              {Object.entries(filterEnvironment(environment.data, envFilter)).map(
                ([category, variables]) => (
                  <Card key={category} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{category}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-border">
                        {variables.map((variable) => (
                          <EnvironmentRow
                            key={variable.key}
                            variable={variable}
                            value={envValues[variable.key] ?? variable.value ?? ""}
                            changed={Object.prototype.hasOwnProperty.call(
                              envChanges,
                              variable.key,
                            )}
                            onChange={(value) => updateEnvValue(variable, value)}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ),
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>账户</CardTitle>
              <CardDescription>会话和访问权限。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <Field
                  label="认证"
                  value={
                    auth.data?.auth_enabled
                      ? auth.data.authenticated
                        ? "已认证"
                        : "已登出"
                      : "已禁用"
                  }
                />
                <Field
                  label="会话"
                  value={auth.data?.authenticated ? "活跃" : "无"}
                />
              </div>
              {auth.data?.auth_enabled && (
                <>
                  <Separator />
                  <div className="flex justify-end">
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        await logout();
                        navigate("/login", { replace: true });
                      }}
                    >
                      登出
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EnvironmentRow({
  variable,
  value,
  changed,
  onChange,
}: {
  variable: EnvironmentVariableSetting;
  value: string;
  changed: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(240px,360px)_1fr] lg:items-center">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-xs text-foreground">{variable.key}</p>
          {changed && <Badge variant="outline">已编辑</Badge>}
          {variable.requiresRestart && <Badge variant="warning">需要重启</Badge>}
          {!variable.hasValue && variable.defaultValue && (
            <Badge variant="muted">默认 {variable.defaultValue}</Badge>
          )}
        </div>
        <p className="text-sm font-medium">{variable.label}</p>
        <p className="text-xs text-muted-foreground">{variable.description}</p>
      </div>
      <EnvironmentControl variable={variable} value={value} onChange={onChange} />
    </div>
  );
}

function EnvironmentControl({
  variable,
  value,
  onChange,
}: {
  variable: EnvironmentVariableSetting;
  value: string;
  onChange: (value: string) => void;
}) {
  if (variable.inputType === "boolean") {
    return (
      <Select
        value={value === "" ? "__unset__" : value}
        onValueChange={(next) => onChange(next === "__unset__" ? "" : next)}
      >
        <SelectTrigger className="font-mono">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__unset__">默认/未设置</SelectItem>
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (variable.inputType === "select") {
    return (
      <Select
        value={value === "" ? "__unset__" : value}
        onValueChange={(next) => onChange(next === "__unset__" ? "" : next)}
      >
        <SelectTrigger className="font-mono">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__unset__">默认/未设置</SelectItem>
          {(variable.options ?? [])
            .filter((option) => option !== "")
            .map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      type={variable.inputType === "number" ? "number" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={variable.placeholder || variable.defaultValue || ""}
      className="font-mono"
    />
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}

function envValue(data: EnvironmentSettings | undefined, key: string) {
  return data?.variables.find((variable) => variable.key === key)?.value ?? "";
}

function filterEnvironment(
  data: EnvironmentSettings | undefined,
  filter: string,
) {
  const needle = filter.trim().toLowerCase();
  const variables = data?.variables ?? [];
  const filtered = needle
    ? variables.filter((variable) =>
        [
          variable.key,
          variable.label,
          variable.category,
          variable.description,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
    : variables;
  return groupBy(filtered, (variable) => variable.category);
}

function groupBy<T, K extends string>(items: T[], getKey: (item: T) => K) {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = getKey(item);
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
}

function isMaskedSettingValue(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("****") || trimmed.includes("••••");
}

function prettyAuthMethod(method: string): string {
  switch (method) {
    case "api_key":
      return "API 密钥";
    case "oauth":
      return "OAuth";
    case "none":
      return "无需凭证";
    default:
      return method;
  }
}

function maskedAPIKeyLabel(profile: AuthProfile): string {
  if (profile.apiKey) return profile.apiKey;
  return "(no key)";
}

function maskedTokenLabel(profile: AuthProfile): string {
  if (profile.accessToken) return profile.accessToken;
  return "(no token)";
}
