package reporting

// MethodologyPhaseNames maps each phase number in the Xalgorix 22-phase
// methodology to its display name. The map is the single source of truth
// consumed by both the PDF report and the autonomous-mode phase-filter
// instruction builder in internal/web.
var MethodologyPhaseNames = map[int]string{
	1:  "深度侦察与攻击面映射",
	2:  "手动漏洞发现",
	3:  "目录与文件发现",
	4:  "CORS与Cookie分析",
	5:  "认证与会话测试",
	6:  "注入测试",
	7:  "SSRF测试",
	8:  "IDOR与访问控制绕过",
	9:  "API与GraphQL测试",
	10: "文件上传测试",
	11: "反序列化与RCE",
	12: "竞态条件与业务逻辑",
	13: "子域名接管",
	14: "开放重定向测试",
	15: "邮件安全测试",
	16: "云与基础设施",
	17: "WebSocket测试",
	18: "CMS专项测试",
	19: "链接劫持与内容欺骗",
	20: "漏洞验证",
	21: "新型漏洞发现",
	22: "最终报告",
}

// OWASPCategories lists the OWASP Top 10 (2021) categories in canonical
// order. The slice is package-level so the report renderer doesn't
// allocate a fresh copy for each generation.
var OWASPCategories = []struct {
	ID   string
	Name string
}{
	{"A01", "Broken Access Control"},
	{"A02", "Cryptographic Failures"},
	{"A03", "Injection"},
	{"A04", "Insecure Design"},
	{"A05", "Security Misconfiguration"},
	{"A06", "Vulnerable and Outdated Components"},
	{"A07", "Identification and Authentication Failures"},
	{"A08", "Software and Data Integrity Failures"},
	{"A09", "Security Logging and Monitoring Failures"},
	{"A10", "Server-Side Request Forgery (SSRF)"},
}
