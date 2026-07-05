package web

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Singtreb/Sword-Riding/v4/internal/auth"
)

type envSettingDefinition struct {
	Key             string   `json:"key"`
	Label           string   `json:"label"`
	Category        string   `json:"category"`
	Description     string   `json:"description"`
	DefaultValue    string   `json:"defaultValue,omitempty"`
	Placeholder     string   `json:"placeholder,omitempty"`
	InputType       string   `json:"inputType"`
	Options         []string `json:"options,omitempty"`
	Sensitive       bool     `json:"sensitive"`
	RequiresRestart bool     `json:"requiresRestart"`
}

type envSettingValue struct {
	envSettingDefinition
	Value    string `json:"value"`
	HasValue bool   `json:"hasValue"`
}

type environmentSettingsResponse struct {
	EnvFile         string            `json:"envFile"`
	Variables       []envSettingValue `json:"variables"`
	RestartRequired bool              `json:"restartRequired,omitempty"`
}

type llmSettingsResponse struct {
	Model                     string `json:"model"`
	APIBase                   string `json:"apiBase"`
	APIKey                    string `json:"apiKey"`
	HasAPIKey                 bool   `json:"hasApiKey"`
	ReasoningEffort           string `json:"reasoningEffort"`
	LLMMaxRetries             int    `json:"llmMaxRetries"`
	MemoryCompressorTimeout   int    `json:"memoryCompressorTimeout"`
	MaxIterations             int    `json:"maxIterations"`
	GeminiAPIKey              string `json:"geminiApiKey"`
	HasGeminiAPIKey           bool   `json:"hasGeminiApiKey"`
	EnvFile                   string `json:"envFile"`
	EnvironmentRestartWarning bool   `json:"environmentRestartWarning"`
	// v4.4.22: catalog-aware fields driving the new LLM Settings
	// tab. Provider mirrors the active provider id derived from
	// LLMProfile (or the legacy XALGORIX_LLM "<provider>/<model>"
	// prefix when no profile is active). AuthMethod tracks which
	// branch the resolver currently dispatches through. Profiles
	// is the masked list of saved profiles for the active
	// provider only — see handleLLMSettings GET for filtering.
	Provider         string              `json:"provider"`
	AuthMethod       string              `json:"authMethod"`
	ActiveProfileKey string              `json:"activeProfileKey"`
	Profiles         []llmProfileSummary `json:"profiles"`
}

// llmProfileSummary is the masked, dashboard-friendly view of one
// auth.Profile filtered to the active provider in the LLM tab.
// Wire shape mirrors maskedProfile in handlers_profiles.go but is
// declared independently so we never import handlers_profiles types.
type llmProfileSummary struct {
	Key             string `json:"key"`
	Provider        string `json:"provider"`
	ProfileID       string `json:"profileId"`
	Type            string `json:"type"`
	HasAccessToken  bool   `json:"hasAccessToken"`
	HasAPIKey       bool   `json:"hasApiKey"`
	APIBaseOverride string `json:"apiBaseOverride,omitempty"`
	ExpiresAt       string `json:"expiresAt,omitempty"`
	RequiresReauth  bool   `json:"requiresReauth,omitempty"`
}

// llmSettingsRequest is the shared decoded shape of POST
// /api/settings/llm. Both the legacy field set
// (model/apiBase/apiKey/...) and the v4.4.22 field set
// (provider/authMethod/profileId/activeProfileKey/...) decode into
// this struct; handleLLMSettings sniffs which branch to take by
// presence of provider/authMethod/activeProfileKey.
type llmSettingsRequest struct {
	// Legacy fields (kept for backwards compat).
	Model                   string `json:"model"`
	APIBase                 string `json:"apiBase"`
	APIKey                  string `json:"apiKey"`
	ReasoningEffort         string `json:"reasoningEffort"`
	LLMMaxRetries           int    `json:"llmMaxRetries"`
	MemoryCompressorTimeout int    `json:"memoryCompressorTimeout"`
	MaxIterations           int    `json:"maxIterations"`
	GeminiAPIKey            string `json:"geminiApiKey"`

	// v4.4.22 fields.
	Provider         string `json:"provider"`
	AuthMethod       string `json:"authMethod"`
	ProfileID        string `json:"profileId"`
	APIBaseOverride  string `json:"apiBaseOverride"`
	ActiveProfileKey string `json:"activeProfileKey"`
}

var envSettingKeyRe = regexp.MustCompile(`^[A-Z_][A-Z0-9_]*$`)

func allEnvSettingDefinitions() []envSettingDefinition {
	autoInstallDefault := "false"
	if os.Getuid() == 0 {
		autoInstallDefault = "true"
	}
	return []envSettingDefinition{
		{Key: "XALGORIX_LLM", Label: "LLM 模型", Category: "LLM", Description: "扫描和扫描后聊天使用的默认模型。", Placeholder: "minimax/MiniMax-M2.7", InputType: "text"},
		{Key: "XALGORIX_API_KEY", Label: "LLM API 密钥", Category: "LLM", Description: "已配置模型的提供者 API 密钥。", Placeholder: "sk-...", InputType: "secret", Sensitive: true},
		{Key: "XALGORIX_API_BASE", Label: "API 基础 URL", Category: "LLM", Description: "可选的自定义提供者端点。留空使用提供者默认值。", Placeholder: "https://api.openai.com/v1", InputType: "url"},
		{Key: "XALGORIX_LLM_PROFILE", Label: "活跃 LLM 配置", Category: "LLM", Description: "活跃凭证指针（\"<provider>:<profileId>\"）。由 LLM 设置标签页设置；存在时优先于 XALGORIX_API_KEY/XALGORIX_LLM。", Placeholder: "openai:default", InputType: "text"},
		{Key: "XALGORIX_REASONING_EFFORT", Label: "推理强度", Category: "LLM", Description: "支持推理的提供者的推理深度。", DefaultValue: "high", InputType: "select", Options: []string{"low", "medium", "high", "xhigh"}},
		{Key: "XALGORIX_LLM_MAX_RETRIES", Label: "LLM 最大重试次数", Category: "LLM", Description: "临时 LLM 提供者失败时的重试次数。", DefaultValue: "5", InputType: "number"},
		{Key: "XALGORIX_MEMORY_COMPRESSOR_TIMEOUT", Label: "内存压缩超时", Category: "LLM", Description: "上下文压缩的超时时间（秒）。", DefaultValue: "30", InputType: "number"},
		{Key: "XALGORIX_MAX_ITERATIONS", Label: "最大迭代次数", Category: "运行时", Description: "每次扫描的最大代理迭代次数。0 表示无限制。", DefaultValue: "0", InputType: "number"},
		{Key: "GEMINI_API_KEY", Label: "Gemini 搜索密钥", Category: "LLM", Description: "用于网络搜索增强的可选 Gemini 密钥。", Placeholder: "AIza...", InputType: "secret", Sensitive: true},

		{Key: "XALGORIX_DISCORD_WEBHOOK", Label: "Discord webhook", Category: "通知", Description: "当扫描未提供自己的 webhook 时使用的全局 Discord webhook。", Placeholder: "https://discord.com/api/webhooks/...", InputType: "secret", Sensitive: true},
		{Key: "XALGORIX_DISCORD_MIN_SEVERITY", Label: "Discord 最低严重性", Category: "通知", Description: "发送到 Discord 的最低严重性。", InputType: "select", Options: []string{"", "info", "low", "medium", "high", "critical"}},

		{Key: "AGENTMAIL_POD", Label: "AgentMail Pod", Category: "AgentMail", Description: "AgentMail pod 标识符。", Placeholder: "am_us_pod_47", InputType: "text"},
		{Key: "AGENTMAIL_API_KEY", Label: "AgentMail API 密钥", Category: "AgentMail", Description: "用于入站邮件分类的 AgentMail API 密钥。", Placeholder: "ak_...", InputType: "secret", Sensitive: true},

		{Key: "XALGORIX_RATE_LIMIT_REQUESTS", Label: "速率限制请求数", Category: "速率限制", Description: "仪表板速率限制窗口期内允许的请求数。", DefaultValue: "60", InputType: "number"},
		{Key: "XALGORIX_RATE_LIMIT_WINDOW", Label: "速率限制窗口", Category: "速率限制", Description: "速率限制窗口（秒）。", DefaultValue: "60", InputType: "number"},
		{Key: "XALGORIX_RATE_RPS", Label: "出站请求速率", Category: "速率限制", Description: "每个域名的持续出站请求速率。", DefaultValue: "10", InputType: "number"},
		{Key: "XALGORIX_RATE_BURST", Label: "出站突发大小", Category: "速率限制", Description: "每个域名的出站突发大小。", DefaultValue: "20", InputType: "number"},

		{Key: "XALGORIX_USE_PROXY", Label: "使用代理", Category: "代理", Description: "启用出站流量的代理路由。", DefaultValue: "false", InputType: "boolean"},
		{Key: "XALGORIX_PROXY_URL", Label: "代理 URL", Category: "代理", Description: "单个代理 URL。设置后会覆盖代理文件。", Placeholder: "socks5://user:pass@127.0.0.1:1080", InputType: "secret", Sensitive: true},
		{Key: "XALGORIX_PROXY_FILE", Label: "代理文件", Category: "代理", Description: "每行一个代理的文件路径。", Placeholder: "/path/to/proxies.txt", InputType: "path"},
		{Key: "XALGORIX_PROXY_ROTATION", Label: "代理轮换策略", Category: "代理", Description: "代理轮换策略。", DefaultValue: "roundrobin", InputType: "select", Options: []string{"roundrobin", "random"}},
		{Key: "XALGORIX_TLS_SKIP_VERIFY", Label: "跳过 TLS 验证", Category: "代理", Description: "允许对代理/测试流量进行不安全的 TLS 验证。", DefaultValue: "false", InputType: "boolean"},

		{Key: "XALGORIX_WORKSPACE", Label: "工作目录", Category: "运行时", Description: "扫描执行的工作目录根目录。", InputType: "path", RequiresRestart: true},
		{Key: "XALGORIX_DISABLE_BROWSER", Label: "禁用浏览器", Category: "运行时", Description: "禁用浏览器自动化工具。", DefaultValue: "false", InputType: "boolean"},
		{Key: "XALGORIX_BROWSER_PATH", Label: "浏览器路径", Category: "运行时", Description: "自定义 Chrome/Chromium 可执行文件路径。", InputType: "path"},
		{Key: "XALGORIX_ALLOW_AUTO_INSTALL", Label: "允许自动安装", Category: "运行时", Description: "允许代理自动安装缺失的软件包。", DefaultValue: autoInstallDefault, InputType: "boolean"},
		{Key: "XALGORIX_AUTO_INSTALL_SUDO", Label: "允许 sudo 自动安装", Category: "运行时", Description: "允许使用 sudo 前缀的自动安装。", DefaultValue: "false", InputType: "boolean"},
		{Key: "XALGORIX_ALLOW_ABSOLUTE_FILEEDIT", Label: "允许绝对路径编辑", Category: "运行时", Description: "允许文件编辑工具写入绝对路径。", DefaultValue: "false", InputType: "boolean"},

		{Key: "XALGORIX_USERNAME", Label: "仪表板用户名", Category: "安全", Description: "仪表板登录用户名。", InputType: "text", RequiresRestart: true},
		{Key: "XALGORIX_PASSWORD", Label: "仪表板密码", Category: "安全", Description: "明文仪表板密码。建议使用 XALGORIX_PASSWORD_HASH。", InputType: "secret", Sensitive: true, RequiresRestart: true},
		{Key: "XALGORIX_PASSWORD_HASH", Label: "仪表板密码哈希", Category: "安全", Description: "Bcrypt 仪表板密码哈希。", InputType: "secret", Sensitive: true, RequiresRestart: true},
		{Key: "XALGORIX_BIND", Label: "绑定地址", Category: "安全", Description: "Web 服务器监听地址。", DefaultValue: "127.0.0.1", Placeholder: "127.0.0.1", InputType: "text", RequiresRestart: true},

		{Key: "CAIDO_PORT", Label: "Caido 端口", Category: "集成", Description: "Caido 代理端口。0 表示自动检测。", DefaultValue: "0", InputType: "number"},
		{Key: "CAIDO_API_TOKEN", Label: "Caido API 令牌", Category: "集成", Description: "用于代理集成的 Caido API 令牌。", InputType: "secret", Sensitive: true},
		{Key: "XALGORIX_TELEMETRY", Label: "遥测", Category: "集成", Description: "启用 OpenTelemetry 导出。", DefaultValue: "true", InputType: "boolean"},
		{Key: "XALGORIX_OTEL_ENDPOINT", Label: "OTel 端点", Category: "集成", Description: "OpenTelemetry 收集器端点。", InputType: "url"},

		{Key: "XALGORIX_CPU_CAUTION_PCT", Label: "CPU 警告阈值", Category: "资源", Description: "CPU 负载警告阈值。", DefaultValue: "70", InputType: "number", RequiresRestart: true},
		{Key: "XALGORIX_CPU_CRITICAL_PCT", Label: "CPU 严重阈值", Category: "资源", Description: "CPU 负载严重阈值。", DefaultValue: "90", InputType: "number", RequiresRestart: true},
		{Key: "XALGORIX_RAM_CAUTION_MB", Label: "RAM 警告阈值", Category: "资源", Description: "可用 RAM 警告阈值。", InputType: "number", RequiresRestart: true},
		{Key: "XALGORIX_RAM_CRITICAL_MB", Label: "RAM 严重阈值", Category: "资源", Description: "可用 RAM 严重阈值。", InputType: "number", RequiresRestart: true},
		{Key: "XALGORIX_DISK_CAUTION_MB", Label: "磁盘警告阈值", Category: "资源", Description: "可用磁盘警告阈值。", DefaultValue: "2048", InputType: "number", RequiresRestart: true},
		{Key: "XALGORIX_DISK_CRITICAL_MB", Label: "磁盘严重阈值", Category: "资源", Description: "可用磁盘严重阈值。", DefaultValue: "1024", InputType: "number", RequiresRestart: true},
		{Key: "XALGORIX_MAX_INSTANCES", Label: "最大实例数", Category: "资源", Description: "手动设置的最大并发扫描实例数。", InputType: "number", RequiresRestart: true},
		{Key: "XALGORIX_HEAVY_TOOL_CPU_LOAD", Label: "重型工具 CPU 负载", Category: "资源", Description: "每个重型终端工具的预期 CPU 负载。留空表示根据 CPU 核心自动缩放。", Placeholder: "auto", InputType: "number", RequiresRestart: true},
		{Key: "XALGORIX_SCAN_MEMORY_BUDGET_MB", Label: "扫描内存预算", Category: "资源", Description: "每个活跃扫描的内存预算。留空表示根据 RAM 和 CPU 核心自动缩放。", Placeholder: "auto", InputType: "number", RequiresRestart: true},
		{Key: "XALGORIX_SCAN_OVERHEAD_MB", Label: "扫描开销内存", Category: "资源", Description: "每个扫描预留的内存开销。留空表示根据 RAM 自动缩放。", Placeholder: "auto", InputType: "number", RequiresRestart: true},
		{Key: "XALGORIX_HEAVY_TOOL_MEM_LIMIT_MB", Label: "重型工具内存限制", Category: "资源", Description: "重型终端工具的可选硬地址空间限制。留空或 0 表示禁用硬限制；动态准入仍使用实时 RAM 余量。", Placeholder: "disabled", InputType: "number", RequiresRestart: true},
		{Key: "XALGORIX_GO_MEM_LIMIT_MB", Label: "Go 内存限制", Category: "资源", Description: "Xalgorix 父进程的软内存限制。留空表示根据 RAM 自动缩放。", Placeholder: "auto", InputType: "number", RequiresRestart: true},
	}
}

func envDefinitionByKey() map[string]envSettingDefinition {
	defs := allEnvSettingDefinitions()
	out := make(map[string]envSettingDefinition, len(defs))
	for _, def := range defs {
		out[def.Key] = def
	}
	return out
}

func (s *Server) handleLLMSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case http.MethodGet:
		_ = json.NewEncoder(w).Encode(s.llmSettings(r.Context()))
	case http.MethodPost:
		var req llmSettingsRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}

		// Sniff which shape the client sent. Any of provider /
		// authMethod / activeProfileKey present → catalog-aware
		// path. Otherwise → legacy free-text path. The legacy
		// path is kept verbatim (Requirement: backwards-compat
		// for older WebUI builds and for anyone scripting against
		// the API).
		isCatalogShape := strings.TrimSpace(req.Provider) != "" ||
			strings.TrimSpace(req.AuthMethod) != "" ||
			strings.TrimSpace(req.ActiveProfileKey) != ""

		if isCatalogShape {
			if err := s.applyCatalogLLMSettings(r.Context(), req); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			_ = json.NewEncoder(w).Encode(s.llmSettings(r.Context()))
			return
		}

		// Legacy shape — unchanged from v4.4.21.
		req.LLMMaxRetries = clampInt(req.LLMMaxRetries, 0, 20)
		req.MemoryCompressorTimeout = clampInt(req.MemoryCompressorTimeout, 5, 600)
		req.MaxIterations = clampInt(req.MaxIterations, 0, 1000)
		reasoning := strings.ToLower(strings.TrimSpace(req.ReasoningEffort))
		if reasoning == "" {
			reasoning = "high"
		}
		if !oneOf(reasoning, []string{"low", "medium", "high", "xhigh"}) {
			http.Error(w, "invalid reasoning effort", http.StatusBadRequest)
			return
		}

		updates := map[string]string{
			"XALGORIX_LLM":                       strings.TrimSpace(req.Model),
			"XALGORIX_API_BASE":                  strings.TrimSpace(req.APIBase),
			"XALGORIX_REASONING_EFFORT":          reasoning,
			"XALGORIX_LLM_MAX_RETRIES":           strconv.Itoa(req.LLMMaxRetries),
			"XALGORIX_MEMORY_COMPRESSOR_TIMEOUT": strconv.Itoa(req.MemoryCompressorTimeout),
			"XALGORIX_MAX_ITERATIONS":            strconv.Itoa(req.MaxIterations),
		}
		if !isMaskedSettingValue(req.APIKey) {
			updates["XALGORIX_API_KEY"] = strings.TrimSpace(req.APIKey)
		}
		if !isMaskedSettingValue(req.GeminiAPIKey) {
			updates["GEMINI_API_KEY"] = strings.TrimSpace(req.GeminiAPIKey)
		}
		if _, err := s.applyEnvironmentUpdates(updates); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(s.llmSettings(r.Context()))
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// applyCatalogLLMSettings handles the v4.4.22 LLM settings POST
// shape: a (provider, authMethod, ...) bundle that maps onto the
// catalog + Profile_Store. Three sub-branches:
//
//  1. activeProfileKey supplied without new credentials → just
//     write XALGORIX_LLM_PROFILE so the resolver picks up the
//     existing Profile next request.
//  2. authMethod=api_key with apiKey supplied → upsert an
//     auth.Profile{Type: APIKey} for "<provider>:<profileId or
//     'default'>", also write XALGORIX_LLM/XALGORIX_API_KEY/
//     XALGORIX_API_BASE for legacy callers, and finally point
//     XALGORIX_LLM_PROFILE at the new key so the resolver
//     dispatches through the catalog branch.
//  3. authMethod=oauth or none with no profile work → just sync
//     the env-var side-channel (model + provider hint) so the
//     legacy path still has something usable; OAuth profile work
//     happens through /api/auth/profiles/oauth/{start,complete}.
func (s *Server) applyCatalogLLMSettings(ctx context.Context, req llmSettingsRequest) error {
	provider := strings.TrimSpace(req.Provider)
	authMethod := strings.ToLower(strings.TrimSpace(req.AuthMethod))
	activeProfileKey := strings.TrimSpace(req.ActiveProfileKey)
	profileID := strings.TrimSpace(req.ProfileID)
	if profileID == "" {
		profileID = "default"
	}

	// Validate provider against the compiled-in catalog whenever
	// it's supplied. The dashboard never sends a provider that
	// isn't in the dropdown, but a hand-crafted POST can — we
	// reject those with a 400 so the resolver never receives a
	// stale pointer.
	if provider != "" && s.catalog != nil {
		if _, ok, err := s.catalog.Get(ctx, provider); err != nil {
			return fmt.Errorf("catalog lookup: %w", err)
		} else if !ok {
			return fmt.Errorf("unknown provider %q", provider)
		}
	}

	updates := map[string]string{}

	// API_KEY path: persist the credential AS a profile, then point
	// XALGORIX_LLM_PROFILE at it. We also continue to write the
	// legacy XALGORIX_LLM / XALGORIX_API_KEY / XALGORIX_API_BASE
	// trio so anyone still consuming those env vars (legacy
	// scripts, the legacyResolver fallback) keeps working.
	//
	// The pointer must move whenever the operator switches provider —
	// even if they leave the masked **** key in place (the UI tells them
	// to keep it to preserve the saved key). Previously this whole branch
	// was gated on a freshly-typed key, so switching provider with a
	// masked key updated only the model env var and the provider reverted
	// to the stale profile on reload.
	if authMethod == "api_key" && provider != "" {
		if s.profiles == nil {
			return fmt.Errorf("profile store not initialized")
		}
		typedKey := strings.TrimSpace(req.APIKey)
		hasTypedKey := typedKey != "" && !isMaskedSettingValue(req.APIKey)
		if hasTypedKey {
			// New key supplied: create/update the profile for this provider.
			baseOverride := strings.TrimSpace(req.APIBaseOverride)
			if baseOverride == "" {
				baseOverride = strings.TrimSpace(req.APIBase)
			}
			prof := auth.Profile{
				Provider:        provider,
				ProfileID:       profileID,
				Type:            auth.APIKey,
				APIKey:          typedKey,
				APIBaseOverride: baseOverride,
			}
			if err := s.profiles.Put(ctx, prof); err != nil {
				return fmt.Errorf("save profile: %w", err)
			}
			activeProfileKey = prof.Key()
		} else if activeProfileKey == "" {
			// Masked/empty key and no explicit profile selected. Persist the
			// provider switch without rewriting any credential:
			//   1. If a profile already exists for <provider>:<profileId>,
			//      point at it (preserving its stored key/base).
			//   2. Otherwise carry over the current saved key (the masked
			//      value the UI is showing == cfg.APIKey, or the active
			//      profile's key) into a new profile for this provider so the
			//      selection sticks.
			target := auth.Profile{Provider: provider, ProfileID: profileID}
			if existing, ok, err := s.profiles.Get(ctx, target.Key()); err != nil {
				return fmt.Errorf("look up profile %q: %w", target.Key(), err)
			} else if ok {
				activeProfileKey = existing.Key()
			} else {
				carry := strings.TrimSpace(s.cfg.APIKey)
				if carry == "" && strings.TrimSpace(s.cfg.LLMProfile) != "" {
					if prof, ok, err := s.profiles.Get(ctx, strings.TrimSpace(s.cfg.LLMProfile)); err == nil && ok {
						carry = strings.TrimSpace(prof.APIKey)
					}
				}
				if carry != "" {
					baseOverride := strings.TrimSpace(req.APIBaseOverride)
					if baseOverride == "" {
						baseOverride = strings.TrimSpace(req.APIBase)
					}
					prof := auth.Profile{
						Provider:        provider,
						ProfileID:       profileID,
						Type:            auth.APIKey,
						APIKey:          carry,
						APIBaseOverride: baseOverride,
					}
					if err := s.profiles.Put(ctx, prof); err != nil {
						return fmt.Errorf("save profile: %w", err)
					}
					activeProfileKey = prof.Key()
				}
			}
		}
	}

	// activeProfileKey wins as the source of truth for
	// XALGORIX_LLM_PROFILE. Either the api_key branch above set
	// it, or the operator picked an existing profile from the
	// list, or both fields are empty (auth_method=none / oauth-
	// only flow) and we leave the pointer alone.
	if activeProfileKey != "" {
		// Guard against pointing the resolver at a profile that was never
		// persisted (e.g. the operator clicked Save before completing the
		// OAuth sign-in). Without this, XALGORIX_LLM_PROFILE would name a
		// missing profile and every scan would fail the credential lookup.
		if s.profiles != nil {
			if _, ok, err := s.profiles.Get(ctx, activeProfileKey); err != nil {
				return fmt.Errorf("look up profile %q: %w", activeProfileKey, err)
			} else if !ok {
				return fmt.Errorf("no saved credential for %q — complete the OAuth sign-in (or save an API key) before selecting it", activeProfileKey)
			}
		}
		updates["XALGORIX_LLM_PROFILE"] = activeProfileKey
	}

	// Legacy env-var sync. Always written when the operator
	// supplied a model so the legacy path stays runnable.
	if model := strings.TrimSpace(req.Model); model != "" {
		updates["XALGORIX_LLM"] = model
	}

	// Legacy env-var sync: XALGORIX_API_BASE.
	// The WebUI sends apiBase only for the "custom" provider; for
	// catalog providers it sends apiBaseOverride instead. Fall
	// through: req.APIBase → req.APIBaseOverride → catalog entry
	// BaseURL, so switching provider always updates the env file.
	{
		base := strings.TrimSpace(req.APIBase)
		if base == "" {
			base = strings.TrimSpace(req.APIBaseOverride)
		}
		if base == "" && provider != "" && s.catalog != nil {
			if entry, ok, err := s.catalog.Get(ctx, provider); err == nil && ok {
				base = strings.TrimSpace(entry.BaseURL)
			}
		}
		if base != "" {
			updates["XALGORIX_API_BASE"] = base
		}
	}
	if !isMaskedSettingValue(req.APIKey) && strings.TrimSpace(req.APIKey) != "" {
		updates["XALGORIX_API_KEY"] = strings.TrimSpace(req.APIKey)
	}
	if !isMaskedSettingValue(req.GeminiAPIKey) {
		updates["GEMINI_API_KEY"] = strings.TrimSpace(req.GeminiAPIKey)
	}
	// Numeric settings still come through both shapes.
	if req.LLMMaxRetries > 0 {
		updates["XALGORIX_LLM_MAX_RETRIES"] = strconv.Itoa(clampInt(req.LLMMaxRetries, 0, 20))
	}
	if req.MemoryCompressorTimeout > 0 {
		updates["XALGORIX_MEMORY_COMPRESSOR_TIMEOUT"] = strconv.Itoa(clampInt(req.MemoryCompressorTimeout, 5, 600))
	}
	if req.MaxIterations > 0 {
		updates["XALGORIX_MAX_ITERATIONS"] = strconv.Itoa(clampInt(req.MaxIterations, 0, 1000))
	}
	if reasoning := strings.ToLower(strings.TrimSpace(req.ReasoningEffort)); reasoning != "" {
		if !oneOf(reasoning, []string{"low", "medium", "high", "xhigh"}) {
			return fmt.Errorf("invalid reasoning effort %q", req.ReasoningEffort)
		}
		updates["XALGORIX_REASONING_EFFORT"] = reasoning
	}

	if len(updates) == 0 {
		return nil
	}
	if _, err := s.applyEnvironmentUpdates(updates); err != nil {
		return err
	}
	return nil
}

func (s *Server) handleEnvironmentSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case http.MethodGet:
		_ = json.NewEncoder(w).Encode(s.environmentSettings(false))
	case http.MethodPost:
		var req struct {
			Values map[string]string `json:"values"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}
		restartRequired, err := s.applyEnvironmentUpdates(req.Values)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		_ = json.NewEncoder(w).Encode(s.environmentSettings(restartRequired))
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) llmSettings(ctx context.Context) llmSettingsResponse {
	resp := llmSettingsResponse{
		Model:                   s.cfg.LLM,
		APIBase:                 s.cfg.APIBase,
		APIKey:                  maskSecretValue(s.cfg.APIKey),
		HasAPIKey:               s.cfg.APIKey != "",
		ReasoningEffort:         s.cfg.ReasoningEffort,
		LLMMaxRetries:           s.cfg.LLMMaxRetries,
		MemoryCompressorTimeout: s.cfg.MemCompTimeout,
		MaxIterations:           s.cfg.MaxIterations,
		GeminiAPIKey:            maskSecretValue(s.cfg.GeminiAPIKey),
		HasGeminiAPIKey:         s.cfg.GeminiAPIKey != "",
		EnvFile:                 xalgorixEnvFilePath(),
		ActiveProfileKey:        s.cfg.LLMProfile,
		Profiles:                []llmProfileSummary{},
	}

	// Provider derivation: prefer cfg.LLMProfile (the explicit
	// catalog pointer); fall back to parsing the legacy
	// "<provider>/<model>" prefix in cfg.LLM. Both can be empty
	// on a fresh install.
	provider := ""
	if key := strings.TrimSpace(s.cfg.LLMProfile); key != "" {
		if i := strings.Index(key, ":"); i > 0 {
			provider = key[:i]
		}
	}
	if provider == "" {
		if i := strings.Index(s.cfg.LLM, "/"); i > 0 {
			provider = strings.ToLower(s.cfg.LLM[:i])
		}
	}
	resp.Provider = provider

	// AuthMethod derivation: dispatch precedence mirrors the
	// resolver. cfg.LLMProfile present + Profile.Type drives the
	// answer; otherwise cfg.APIKey indicates api_key; otherwise
	// "" (operator hasn't picked anything yet).
	authMethod := ""
	if s.profiles != nil && strings.TrimSpace(s.cfg.LLMProfile) != "" {
		if prof, ok, err := s.profiles.Get(ctx, strings.TrimSpace(s.cfg.LLMProfile)); err == nil && ok {
			switch prof.Type {
			case auth.OAuth:
				authMethod = "oauth"
			case auth.APIKey:
				authMethod = "api_key"
			}
		}
	}
	if authMethod == "" && s.cfg.APIKey != "" {
		authMethod = "api_key"
	}
	resp.AuthMethod = authMethod

	// Profiles: filter to the active provider only. The full list
	// surface lives at /api/auth/profiles; this field is a
	// dashboard convenience so the LLM tab can render the saved
	// credentials picker without a second roundtrip.
	if s.profiles != nil && provider != "" {
		all, err := s.profiles.List(ctx)
		if err == nil {
			for _, p := range all {
				if p.Provider != provider {
					continue
				}
				resp.Profiles = append(resp.Profiles, llmProfileSummaryFor(p))
			}
		}
	}

	return resp
}

// llmProfileSummaryFor produces the masked, dashboard-friendly view
// of one auth.Profile. Credentials are NEVER returned in plaintext;
// only the boolean has* flags + masked metadata.
func llmProfileSummaryFor(p auth.Profile) llmProfileSummary {
	out := llmProfileSummary{
		Key:             p.Key(),
		Provider:        p.Provider,
		ProfileID:       p.ProfileID,
		Type:            string(p.Type),
		HasAccessToken:  p.AccessToken != "",
		HasAPIKey:       p.APIKey != "",
		APIBaseOverride: p.APIBaseOverride,
		RequiresReauth:  p.RequiresReauth,
	}
	if !p.ExpiresAt.IsZero() {
		out.ExpiresAt = p.ExpiresAt.UTC().Format(time.RFC3339)
	}
	return out
}

func (s *Server) environmentSettings(restartRequired bool) environmentSettingsResponse {
	defs := allEnvSettingDefinitions()
	values := make([]envSettingValue, 0, len(defs))
	for _, def := range defs {
		value := s.envSettingValue(def.Key)
		hasValue := os.Getenv(def.Key) != ""
		if def.Sensitive {
			value = maskSecretValue(value)
		}
		values = append(values, envSettingValue{
			envSettingDefinition: def,
			Value:                value,
			HasValue:             hasValue,
		})
	}
	sort.SliceStable(values, func(i, j int) bool {
		if values[i].Category != values[j].Category {
			return values[i].Category < values[j].Category
		}
		return values[i].Key < values[j].Key
	})
	return environmentSettingsResponse{
		EnvFile:         xalgorixEnvFilePath(),
		Variables:       values,
		RestartRequired: restartRequired,
	}
}

func (s *Server) applyEnvironmentUpdates(values map[string]string) (bool, error) {
	if len(values) == 0 {
		return false, nil
	}
	defs := envDefinitionByKey()
	effective := make(map[string]string, len(values))
	restartRequired := false

	for key, value := range values {
		key = strings.TrimSpace(key)
		if !envSettingKeyRe.MatchString(key) {
			return false, fmt.Errorf("invalid environment variable name %q", key)
		}
		def, ok := defs[key]
		if !ok {
			return false, fmt.Errorf("unsupported environment variable %q", key)
		}
		if def.Sensitive && isMaskedSettingValue(value) {
			continue
		}
		value = strings.TrimSpace(value)
		if strings.ContainsAny(value, "\r\n") {
			return false, fmt.Errorf("%s cannot contain newlines", key)
		}
		normalized, err := normalizeEnvSettingValue(def, value)
		if err != nil {
			return false, err
		}
		value = normalized
		effective[key] = value
		if def.RequiresRestart {
			restartRequired = true
		}
	}
	if len(effective) == 0 {
		return restartRequired, nil
	}

	s.settingsMu.Lock()
	defer s.settingsMu.Unlock()

	if err := updateXalgorixEnvFile(xalgorixEnvFilePath(), effective); err != nil {
		return false, err
	}
	for key, value := range effective {
		if value == "" {
			_ = os.Unsetenv(key)
		} else {
			_ = os.Setenv(key, value)
		}
	}
	s.applyEnvironmentToRuntimeConfig(effective)
	return restartRequired, nil
}

func (s *Server) applyEnvironmentToRuntimeConfig(values map[string]string) {
	rateChanged := false
	for key, value := range values {
		switch key {
		case "XALGORIX_LLM":
			s.cfg.LLM = value
		case "XALGORIX_API_BASE":
			s.cfg.APIBase = value
		case "XALGORIX_API_KEY":
			s.cfg.APIKey = value
		case "XALGORIX_LLM_PROFILE":
			s.cfg.LLMProfile = value
		case "XALGORIX_REASONING_EFFORT":
			s.cfg.ReasoningEffort = valueOrDefault(value, "high")
		case "XALGORIX_LLM_MAX_RETRIES":
			s.cfg.LLMMaxRetries = parseIntSetting(value, 5)
		case "XALGORIX_MEMORY_COMPRESSOR_TIMEOUT":
			s.cfg.MemCompTimeout = parseIntSetting(value, 30)
		case "XALGORIX_MAX_ITERATIONS":
			s.cfg.MaxIterations = parseIntSetting(value, 0)
		case "XALGORIX_WORKSPACE":
			if value != "" {
				s.cfg.Workspace = value
			}
		case "XALGORIX_DISABLE_BROWSER":
			s.cfg.DisableBrowser = parseBoolSetting(value, false)
		case "XALGORIX_RATE_LIMIT_REQUESTS":
			s.cfg.RateLimitRequests = parseIntSetting(value, 60)
			rateChanged = true
		case "XALGORIX_RATE_LIMIT_WINDOW":
			s.cfg.RateLimitWindow = parseIntSetting(value, 60)
			rateChanged = true
		case "XALGORIX_RATE_RPS":
			s.cfg.RateLimitRPS = parseFloatSetting(value, 10)
		case "XALGORIX_RATE_BURST":
			s.cfg.RateLimitBurst = parseIntSetting(value, 20)
		case "XALGORIX_TLS_SKIP_VERIFY":
			s.cfg.TLSSkipVerify = parseBoolSetting(value, false)
		case "CAIDO_PORT":
			s.cfg.CaidoPort = parseIntSetting(value, 0)
		case "CAIDO_API_TOKEN":
			s.cfg.CaidoAPIToken = value
		case "XALGORIX_TELEMETRY":
			s.cfg.Telemetry = parseBoolSetting(value, true)
		case "XALGORIX_OTEL_ENDPOINT":
			s.cfg.OTelEndpoint = value
		case "GEMINI_API_KEY":
			s.cfg.GeminiAPIKey = value
		case "AGENTMAIL_API_KEY":
			s.cfg.AgentMailAPIKey = value
		case "AGENTMAIL_POD":
			s.cfg.AgentMailPod = value
		case "XALGORIX_DISCORD_WEBHOOK":
			s.cfg.DiscordWebhook = value
			s.discordWebhook = value
		case "XALGORIX_DISCORD_MIN_SEVERITY":
			s.cfg.DiscordMinSeverity = value
			s.discordMinSeverity = strings.ToLower(strings.TrimSpace(value))
		case "XALGORIX_USERNAME":
			s.cfg.Username = value
		case "XALGORIX_PASSWORD":
			s.cfg.Password = value
		case "XALGORIX_PASSWORD_HASH":
			s.cfg.PasswordHash = value
		case "XALGORIX_BIND":
			s.cfg.BindAddr = valueOrDefault(value, "127.0.0.1")
		case "XALGORIX_ALLOW_AUTO_INSTALL":
			s.cfg.AllowAutoInstall = parseBoolSetting(value, os.Getuid() == 0)
		case "XALGORIX_AUTO_INSTALL_SUDO":
			s.cfg.AllowAutoInstallSudo = parseBoolSetting(value, false)
		case "XALGORIX_USE_PROXY":
			s.cfg.UseProxy = parseBoolSetting(value, false)
		case "XALGORIX_PROXY_FILE":
			s.cfg.ProxyFile = value
		case "XALGORIX_PROXY_ROTATION":
			s.cfg.ProxyRotation = valueOrDefault(value, "roundrobin")
		case "XALGORIX_PROXY_URL":
			s.cfg.ProxyURL = value
		case "XALGORIX_BROWSER_PATH":
			s.cfg.BrowserPath = value
		}
	}
	if rateChanged {
		requests := clampInt(s.cfg.RateLimitRequests, 1, 1000)
		window := clampInt(s.cfg.RateLimitWindow, 10, 3600)
		s.cfg.RateLimitRequests = requests
		s.cfg.RateLimitWindow = window
		if s.rateLimiter != nil {
			s.rateLimiter.Stop()
		}
		s.rateLimiter = NewRateLimiter(requests, time.Duration(window)*time.Second)
		log.Printf("Rate limiting updated: %d requests/%ds per IP", requests, window)
	}
}

func (s *Server) envSettingValue(key string) string {
	switch key {
	case "XALGORIX_LLM":
		return s.cfg.LLM
	case "XALGORIX_API_BASE":
		return s.cfg.APIBase
	case "XALGORIX_API_KEY":
		return s.cfg.APIKey
	case "XALGORIX_LLM_PROFILE":
		return s.cfg.LLMProfile
	case "XALGORIX_REASONING_EFFORT":
		return valueOrDefault(s.cfg.ReasoningEffort, "high")
	case "XALGORIX_LLM_MAX_RETRIES":
		return strconv.Itoa(s.cfg.LLMMaxRetries)
	case "XALGORIX_MEMORY_COMPRESSOR_TIMEOUT":
		return strconv.Itoa(s.cfg.MemCompTimeout)
	case "XALGORIX_MAX_ITERATIONS":
		return strconv.Itoa(s.cfg.MaxIterations)
	case "XALGORIX_WORKSPACE":
		return s.cfg.Workspace
	case "XALGORIX_DISABLE_BROWSER":
		return strconv.FormatBool(s.cfg.DisableBrowser)
	case "XALGORIX_RATE_LIMIT_REQUESTS":
		return strconv.Itoa(s.cfg.RateLimitRequests)
	case "XALGORIX_RATE_LIMIT_WINDOW":
		return strconv.Itoa(s.cfg.RateLimitWindow)
	case "XALGORIX_RATE_RPS":
		return strconv.FormatFloat(s.cfg.RateLimitRPS, 'f', -1, 64)
	case "XALGORIX_RATE_BURST":
		return strconv.Itoa(s.cfg.RateLimitBurst)
	case "XALGORIX_TLS_SKIP_VERIFY":
		return strconv.FormatBool(s.cfg.TLSSkipVerify)
	case "CAIDO_PORT":
		return strconv.Itoa(s.cfg.CaidoPort)
	case "CAIDO_API_TOKEN":
		return s.cfg.CaidoAPIToken
	case "XALGORIX_TELEMETRY":
		return strconv.FormatBool(s.cfg.Telemetry)
	case "XALGORIX_OTEL_ENDPOINT":
		return s.cfg.OTelEndpoint
	case "GEMINI_API_KEY":
		return s.cfg.GeminiAPIKey
	case "AGENTMAIL_API_KEY":
		return s.cfg.AgentMailAPIKey
	case "AGENTMAIL_POD":
		return s.cfg.AgentMailPod
	case "XALGORIX_DISCORD_WEBHOOK":
		return s.cfg.DiscordWebhook
	case "XALGORIX_DISCORD_MIN_SEVERITY":
		return s.cfg.DiscordMinSeverity
	case "XALGORIX_USERNAME":
		return s.cfg.Username
	case "XALGORIX_PASSWORD":
		return s.cfg.Password
	case "XALGORIX_PASSWORD_HASH":
		return s.cfg.PasswordHash
	case "XALGORIX_BIND":
		return valueOrDefault(s.cfg.BindAddr, "127.0.0.1")
	case "XALGORIX_ALLOW_AUTO_INSTALL":
		return strconv.FormatBool(s.cfg.AllowAutoInstall)
	case "XALGORIX_AUTO_INSTALL_SUDO":
		return strconv.FormatBool(s.cfg.AllowAutoInstallSudo)
	case "XALGORIX_USE_PROXY":
		return strconv.FormatBool(s.cfg.UseProxy)
	case "XALGORIX_PROXY_FILE":
		return s.cfg.ProxyFile
	case "XALGORIX_PROXY_ROTATION":
		return valueOrDefault(s.cfg.ProxyRotation, "roundrobin")
	case "XALGORIX_PROXY_URL":
		return s.cfg.ProxyURL
	case "XALGORIX_BROWSER_PATH":
		return s.cfg.BrowserPath
	default:
		return os.Getenv(key)
	}
}

func updateXalgorixEnvFile(path string, updates map[string]string) error {
	existing, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("read env file: %w", err)
	}
	lines := []string{}
	if len(existing) > 0 {
		lines = strings.Split(strings.TrimRight(string(existing), "\n"), "\n")
	}

	seen := make(map[string]bool, len(updates))
	newLines := make([]string, 0, len(lines)+len(updates)+1)
	for _, line := range lines {
		key, ok := envLineKey(line)
		if !ok {
			newLines = append(newLines, line)
			continue
		}
		value, shouldUpdate := updates[key]
		if !shouldUpdate {
			newLines = append(newLines, line)
			continue
		}
		seen[key] = true
		if value == "" {
			continue
		}
		newLines = append(newLines, formatEnvLine(key, value))
	}

	missing := make([]string, 0, len(updates))
	for key, value := range updates {
		if seen[key] || value == "" {
			continue
		}
		missing = append(missing, key)
	}
	sort.Strings(missing)
	if len(missing) > 0 && len(newLines) > 0 {
		last := strings.TrimSpace(newLines[len(newLines)-1])
		if last != "" {
			newLines = append(newLines, "")
		}
	}
	for _, key := range missing {
		newLines = append(newLines, formatEnvLine(key, updates[key]))
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("create env dir: %w", err)
	}
	out := strings.TrimRight(strings.Join(newLines, "\n"), "\n")
	if out != "" {
		out += "\n"
	}
	if err := os.WriteFile(path, []byte(out), 0o600); err != nil {
		return fmt.Errorf("write env file: %w", err)
	}
	if err := os.Chmod(path, 0o600); err != nil {
		return fmt.Errorf("chmod env file: %w", err)
	}
	return nil
}

func envLineKey(line string) (string, bool) {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" || strings.HasPrefix(trimmed, "#") {
		return "", false
	}
	trimmed = strings.TrimPrefix(trimmed, "export ")
	parts := strings.SplitN(trimmed, "=", 2)
	if len(parts) != 2 {
		return "", false
	}
	key := strings.TrimSpace(parts[0])
	if !envSettingKeyRe.MatchString(key) {
		return "", false
	}
	return key, true
}

func formatEnvLine(key, value string) string {
	return key + "=" + value
}

func xalgorixEnvFilePath() string {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		home = "/root"
	}
	return filepath.Join(home, ".xalgorix.env")
}

func maskSecretValue(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if len(value) > 8 {
		return "****" + value[len(value)-8:]
	}
	return "****"
}

func isMaskedSettingValue(value string) bool {
	value = strings.TrimSpace(value)
	return strings.HasPrefix(value, "****") || strings.Contains(value, "••••")
}

func parseIntSetting(value string, fallback int) int {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	n, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return n
}

func parseFloatSetting(value string, fallback float64) float64 {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	n, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fallback
	}
	return n
}

func parseBoolSetting(value string, fallback bool) bool {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return fallback
	}
	return value == "1" || value == "true" || value == "yes" || value == "on"
}

func normalizeEnvSettingValue(def envSettingDefinition, value string) (string, error) {
	if value == "" {
		return "", nil
	}
	switch def.InputType {
	case "boolean":
		return strconv.FormatBool(parseBoolSetting(value, false)), nil
	case "select":
		if len(def.Options) > 0 && !oneOf(value, def.Options) {
			return "", fmt.Errorf("invalid value %q for %s", value, def.Key)
		}
	case "number":
		if _, err := strconv.ParseFloat(value, 64); err != nil {
			return "", fmt.Errorf("%s must be a number", def.Key)
		}
	}
	switch def.Key {
	case "XALGORIX_RATE_LIMIT_REQUESTS":
		return strconv.Itoa(clampInt(parseIntSetting(value, 60), 1, 1000)), nil
	case "XALGORIX_RATE_LIMIT_WINDOW":
		return strconv.Itoa(clampInt(parseIntSetting(value, 60), 10, 3600)), nil
	case "XALGORIX_LLM_MAX_RETRIES":
		return strconv.Itoa(clampInt(parseIntSetting(value, 5), 0, 20)), nil
	case "XALGORIX_MEMORY_COMPRESSOR_TIMEOUT":
		return strconv.Itoa(clampInt(parseIntSetting(value, 30), 5, 600)), nil
	case "XALGORIX_MAX_ITERATIONS":
		return strconv.Itoa(clampInt(parseIntSetting(value, 0), 0, 1000)), nil
	}
	return value, nil
}

func valueOrDefault(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func clampInt(value, min, max int) int {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func oneOf(value string, values []string) bool {
	for _, candidate := range values {
		if value == candidate {
			return true
		}
	}
	return false
}
