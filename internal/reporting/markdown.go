package reporting

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// GenerateMD renders the scan report as a Markdown file with detailed PoC and remediation.
func GenerateMD(scan *Scan, opts Options) (string, error) {
	var sb strings.Builder

	startTime := ParseTime(scan.StartedAt)
	endTime := ParseTime(scan.FinishedAt)
	duration := FormatDuration(startTime, endTime)
	brandName := BrandName(scan)

	rollup := RollupSeverities(scan.Vulns)
	critCount := rollup.Critical
	highCount := rollup.High
	medCount := rollup.Medium
	lowCount := rollup.Low
	infoCount := rollup.Info
	score := RiskScore(scan.Vulns)
	riskLabel := RiskLabel(score)

	sb.WriteString("# 安全评估报告\n\n")
	sb.WriteString("---\n\n")

	sb.WriteString("## 📋 基本信息\n\n")
	sb.WriteString(fmt.Sprintf("| 属性 | 值 |\n"))
	sb.WriteString("|------|------|\n")
	sb.WriteString(fmt.Sprintf("| **目标** | %s |\n", DisplayText(scan.Target, "未记录", 95)))
	sb.WriteString(fmt.Sprintf("| **扫描ID** | %s |\n", DisplayText(scan.ID, "未记录", 90)))
	sb.WriteString(fmt.Sprintf("| **品牌** | %s |\n", DisplayText(brandName, "Target", 60)))
	sb.WriteString(fmt.Sprintf("| **状态** | %s |\n", strings.ToUpper(DisplayText(scan.Status, "unknown", 18))))
	sb.WriteString(fmt.Sprintf("| **风险等级** | **%s** (%.1f/10) |\n", riskLabel, score))
	sb.WriteString(fmt.Sprintf("| **发现总数** | %d |\n", len(scan.Vulns)))
	sb.WriteString(fmt.Sprintf("| **开始时间** | %s |\n", FormatTimestamp(startTime)))
	sb.WriteString(fmt.Sprintf("| **结束时间** | %s |\n", FormatTimestamp(endTime)))
	sb.WriteString(fmt.Sprintf("| **持续时间** | %s |\n", duration))
	sb.WriteString(fmt.Sprintf("| **迭代次数** | %d |\n", scan.Iterations))
	sb.WriteString(fmt.Sprintf("| **工具调用** | %d |\n", scan.ToolCalls))
	sb.WriteString(fmt.Sprintf("| **总 Tokens** | %d |\n", scan.TotalTokens))
	sb.WriteString("\n")

	sb.WriteString("## 📊 风险概览\n\n")
	sb.WriteString("### 漏洞统计\n\n")
	sb.WriteString(fmt.Sprintf("| 严重性 | 数量 |\n"))
	sb.WriteString("|--------|------|\n")
	sb.WriteString(fmt.Sprintf("| 🔴 Critical | %d |\n", critCount))
	sb.WriteString(fmt.Sprintf("| 🟠 High | %d |\n", highCount))
	sb.WriteString(fmt.Sprintf("| 🟡 Medium | %d |\n", medCount))
	sb.WriteString(fmt.Sprintf("| 🟢 Low | %d |\n", lowCount))
	sb.WriteString(fmt.Sprintf("| 🔵 Info | %d |\n", infoCount))
	sb.WriteString("\n")

	sb.WriteString("### 风险评估\n\n")
	if critCount > 0 || highCount > 0 {
		sb.WriteString(fmt.Sprintf(
			"**整体风险评估: %s (%.1f/10)**\n\n",
			riskLabel, score,
		))
		sb.WriteString(fmt.Sprintf(
			"建议立即修复 %d 个 Critical 和 %d 个 High 严重性漏洞，这些漏洞可能导致未授权访问、数据泄露或服务中断。\n\n",
			critCount, highCount,
		))
	} else if medCount > 0 {
		sb.WriteString(fmt.Sprintf(
			"**整体风险评估: %s (%.1f/10)**\n\n",
			riskLabel, score,
		))
		sb.WriteString(fmt.Sprintf(
			"虽然未发现 Critical 或 High 级别漏洞，但 %d 个 Medium 级别漏洞应在下一个维护周期内处理，以减少攻击面。\n\n",
			medCount,
		))
	} else {
		sb.WriteString(fmt.Sprintf(
			"**整体风险评估: %s (%.1f/10)**\n\n",
			riskLabel, score,
		))
		sb.WriteString("目标展示了良好的安全态势，仅有低级别或信息性发现。建议持续监控。\n\n")
	}

	sb.WriteString("## 🎯 方法论\n\n")
	sb.WriteString("Xalgorix 遵循全面的 22 阶段渗透测试方法论，符合 OWASP、PTES 和行业最佳实践。\n\n")
	sb.WriteString("### 执行阶段\n\n")

	executedPhases := scan.Phases
	allPhases := len(executedPhases) == 0
	for phaseNum := 1; phaseNum <= 22; phaseNum++ {
		name, ok := MethodologyPhaseNames[phaseNum]
		if !ok {
			continue
		}
		executed := allPhases
		if !allPhases {
			for _, p := range executedPhases {
				if p == phaseNum {
					executed = true
					break
				}
			}
		}
		status := "❌ 跳过"
		if executed {
			status = "✅ 已执行"
		}
		sb.WriteString(fmt.Sprintf("- **阶段 %d**: %s %s\n", phaseNum, name, status))
	}
	sb.WriteString("\n")

	recon := CollectReconSummary(scan.Events)
	if recon.HasData() {
		sb.WriteString("## 📡 侦察发现\n\n")
		sb.WriteString("从扫描日志和工具输出中提取的非利用性侦察观察结果，用于攻击面文档和操作交接。\n\n")

		if len(recon.DNSRecords) > 0 {
			sb.WriteString("### DNS 记录\n\n")
			for _, item := range recon.DNSRecords {
				sb.WriteString(fmt.Sprintf("- %s\n", item))
			}
			sb.WriteString("\n")
		}

		if len(recon.IPAddresses) > 0 {
			sb.WriteString("### 解析的 IP 地址\n\n")
			for _, item := range recon.IPAddresses {
				sb.WriteString(fmt.Sprintf("- %s\n", item))
			}
			sb.WriteString("\n")
		}

		if len(recon.Ports) > 0 {
			sb.WriteString("### 开放端口与服务\n\n")
			for _, item := range recon.Ports {
				sb.WriteString(fmt.Sprintf("- %s\n", item))
			}
			sb.WriteString("\n")
		}

		if len(recon.Technologies) > 0 {
			sb.WriteString("### 检测到的技术\n\n")
			for _, item := range recon.Technologies {
				sb.WriteString(fmt.Sprintf("- %s\n", item))
			}
			sb.WriteString("\n")
		}

		if len(recon.URLs) > 0 {
			sb.WriteString("### 观察到的 URL 和端点\n\n")
			for _, item := range recon.URLs {
				sb.WriteString(fmt.Sprintf("- %s\n", item))
			}
			sb.WriteString("\n")
		}
	}

	if len(scan.Vulns) > 0 {
		sb.WriteString("## 📋 发现摘要\n\n")
		sb.WriteString("| ID | 漏洞名称 | 严重性 | CVSS | CVE | CWE | OWASP |\n")
		sb.WriteString("|----|----------|--------|------|-----|-----|-------|\n")

		for i, v := range scan.Vulns {
			mappings := InferMappings(v)
			sevIcon := "🔵"
			switch strings.ToLower(v.Severity) {
			case "critical":
				sevIcon = "🔴"
			case "high":
				sevIcon = "🟠"
			case "medium":
				sevIcon = "🟡"
			case "low":
				sevIcon = "🟢"
			}
			cvssStr := "—"
			if v.CVSS > 0 {
				cvssStr = fmt.Sprintf("%.1f", v.CVSS)
			}
			sb.WriteString(fmt.Sprintf("| F-%02d | %s | %s %s | %s | %s | %s | %s |\n",
				i+1, v.Title, sevIcon, v.Severity, cvssStr, v.CVE, mappings.CWEID, mappings.OWASP))
		}
		sb.WriteString("\n")

		sb.WriteString("## 🕵️ 漏洞详情\n\n")
		sb.WriteString("以下是每个漏洞的详细分析，包含 PoC、复现步骤和修复建议。\n\n")

		for idx, v := range scan.Vulns {
			mappings := InferMappings(v)

			sevIcon := "🔵"
			sevColor := ""
			switch strings.ToLower(v.Severity) {
			case "critical":
				sevIcon = "🔴"
				sevColor = "**Critical**"
			case "high":
				sevIcon = "🟠"
				sevColor = "**High**"
			case "medium":
				sevIcon = "🟡"
				sevColor = "**Medium**"
			case "low":
				sevIcon = "🟢"
				sevColor = "**Low**"
			default:
				sevColor = "**Info**"
			}

			sb.WriteString(fmt.Sprintf("---\n\n"))
			sb.WriteString(fmt.Sprintf("### %d. %s\n\n", idx+1, v.Title))
			sb.WriteString(fmt.Sprintf("**严重性**: %s %s\n\n", sevIcon, sevColor))

			if v.Verified {
				sb.WriteString(fmt.Sprintf("✅ **已验证** via: %s\n\n", strings.ToUpper(v.VerificationMethod)))
			} else if v.VerificationMethod != "" {
				sb.WriteString(fmt.Sprintf("⚠️ **未验证** — 需要手动审查 (reported via %s)\n\n", strings.ToUpper(v.VerificationMethod)))
			}

			if v.Target != "" {
				sb.WriteString(fmt.Sprintf("**目标**: `%s`\n\n", v.Target))
			}

			if v.Endpoint != "" {
				sb.WriteString(fmt.Sprintf("**受影响端点**: `%s`\n\n", v.Endpoint))
			}

			if v.CVSS > 0 {
				sb.WriteString(fmt.Sprintf("**CVSS**: %.1f", v.CVSS))
				if v.CVSSVector != "" {
					sb.WriteString(fmt.Sprintf(" (%s)", v.CVSSVector))
				}
				sb.WriteString("\n\n")
			}

			if v.CVE != "" {
				sb.WriteString(fmt.Sprintf("**CVE**: %s\n\n", v.CVE))
			}

			if mappings.CWEID != "" {
				sb.WriteString(fmt.Sprintf("**CWE**: %s", mappings.CWEID))
				if mappings.CWEName != "" {
					sb.WriteString(fmt.Sprintf(" — %s", mappings.CWEName))
				}
				sb.WriteString("\n\n")
			}

			if mappings.OWASP != "" {
				sb.WriteString(fmt.Sprintf("**OWASP**: %s", mappings.OWASP))
				if mappings.OWASPName != "" {
					sb.WriteString(fmt.Sprintf(" — %s", mappings.OWASPName))
				}
				sb.WriteString("\n\n")
			}

			if v.Method != "" {
				sb.WriteString(fmt.Sprintf("**检测方法**: %s\n\n", v.Method))
			}

			if v.Description != "" {
				sb.WriteString("#### 📝 漏洞描述\n\n")
				sb.WriteString(fmt.Sprintf("%s\n\n", v.Description))
			}

			if v.TechnicalAnalysis != "" {
				sb.WriteString("#### 🔬 技术分析\n\n")
				sb.WriteString(fmt.Sprintf("%s\n\n", v.TechnicalAnalysis))
			}

			if v.Impact != "" {
				sb.WriteString("#### 💥 影响分析\n\n")
				sb.WriteString(fmt.Sprintf("%s\n\n", v.Impact))
			}

			if v.PoCDescription != "" {
				sb.WriteString("#### 📄 PoC 描述\n\n")
				sb.WriteString(fmt.Sprintf("%s\n\n", v.PoCDescription))
			}

			if v.PoCScript != "" {
				sb.WriteString("#### 🧪 PoC 代码\n\n")
				sb.WriteString("```bash\n")
				sb.WriteString(v.PoCScript)
				sb.WriteString("\n```\n\n")
			}

			if v.ExploitationProof != "" {
				sb.WriteString("#### ✅ 利用证明\n\n")
				sb.WriteString("```text\n")
				sb.WriteString(v.ExploitationProof)
				sb.WriteString("\n```\n\n")
			}

			if v.VerificationMethod != "" || v.PoCDescription != "" || v.PoCScript != "" || v.ExploitationProof != "" {
				sb.WriteString("#### 📋 复现步骤\n\n")
				if v.VerificationMethod != "" {
					sb.WriteString(fmt.Sprintf("**验证方法**: %s\n\n", strings.ToUpper(v.VerificationMethod)))
				}
				sb.WriteString("**复现步骤**:\n\n")
				
				if v.PoCDescription != "" {
					sb.WriteString(fmt.Sprintf("1. %s\n\n", v.PoCDescription))
				} else {
					sb.WriteString("1. 访问受影响端点: " + v.Endpoint + "\n\n")
				}
				
				if v.PoCScript != "" {
					sb.WriteString("2. 执行以下 PoC 代码:\n\n")
					sb.WriteString("```bash\n")
					sb.WriteString(v.PoCScript)
					sb.WriteString("\n```\n\n")
				}
				
				if v.ExploitationProof != "" {
					sb.WriteString("3. 验证结果:\n\n")
					sb.WriteString("```text\n")
					sb.WriteString(v.ExploitationProof)
					sb.WriteString("\n```\n\n")
				}
			}

			if v.Remediation != "" {
				sb.WriteString("#### 🛡️ 修复建议\n\n")
				sb.WriteString(fmt.Sprintf("%s\n\n", v.Remediation))
			}
		}
		sb.WriteString("\n")
	}

	endpointSet := make(map[string]bool)
	var endpoints []string
	for _, evt := range scan.Events {
		if evt.Type == "tool_call" && evt.ToolName == "terminal_execute" {
			if strings.Contains(evt.ToolArgs["command"], "http") {
				lines := strings.Split(evt.ToolArgs["command"], "\n")
				for _, line := range lines {
					if strings.Contains(line, "http://") || strings.Contains(line, "https://") {
						for _, word := range strings.Fields(line) {
							if strings.Contains(word, "http") {
								u := ExtractURL(word)
								if u != "" && !endpointSet[u] {
									endpointSet[u] = true
									endpoints = append(endpoints, u)
								}
							}
						}
					}
				}
			}
		}
	}

	if len(endpoints) > 0 {
		sb.WriteString("## 🔗 测试端点\n\n")
		sort.Strings(endpoints)
		displayEndpoints := endpoints
		if len(displayEndpoints) > 50 {
			displayEndpoints = displayEndpoints[:50]
		}
		for _, ep := range displayEndpoints {
			sb.WriteString(fmt.Sprintf("- `%s`\n", ep))
		}
		if len(endpoints) > 50 {
			sb.WriteString(fmt.Sprintf("\n... 还有 %d 个端点\n\n", len(endpoints)-50))
		}
	}

	sb.WriteString("## ⚠️ 免责声明\n\n")
	sb.WriteString("本渗透测试由 Xalgorix（一个自主 AI 驱动的安全评估工具）执行。报告中的发现基于自动化测试和可能的人工验证。\n\n")
	sb.WriteString("**重要通知**:\n\n")
	sb.WriteString("- **范围**: 本次评估仅限于本报告中明确列出的目标系统。定义范围之外的任何系统或服务均未测试。\n\n")
	sb.WriteString("- **误报**: 虽然 Xalgorix 尝试在报告前验证发现，但某些发现可能需要手动验证。建议在采取修复措施前验证所有 Critical 和 High 严重性发现。\n\n")
	sb.WriteString("- **局限性**: 自动化测试无法发现所有漏洞。建议进行人工测试、代码审查和其他补充安全活动以获得全面的安全覆盖。\n\n")
	sb.WriteString("- **法律**: 本次评估是在目标所有者授权下进行的。未经授权的安全测试是非法的。在测试任何系统前确保您拥有适当的授权。\n\n")
	sb.WriteString("- **报告准确性**: 本报告按\"原样\"提供，不提供任何形式的保证。测试方法和发现基于测试时可用的工具和技术。\n\n")
	sb.WriteString("- **修复**: 对于发现的任何漏洞，请遵循行业最佳实践进行修复。对于复杂漏洞，请咨询安全专业人士。\n\n")
	sb.WriteString("---\n\n")
	sb.WriteString("由 Xalgorix - 自主 AI 渗透测试引擎生成\n")
	sb.WriteString("https://github.com/xalgord/xalgorix\n")

	reportID := scan.ID
	if strings.TrimSpace(reportID) == "" && opts.ScanDir != "" {
		reportID = filepath.Base(opts.ScanDir)
	}
	if strings.TrimSpace(reportID) == "" {
		reportID = "scan"
	}
	filename := fmt.Sprintf("xalgorix_report_%s.md", reportID)
	outPath := filepath.Join(opts.ScanDir, filename)
	if opts.ScanDir == "" {
		outPath = filepath.Join(opts.FallbackDir, filename)
	}

	if err := writeFile(outPath, sb.String()); err != nil {
		return "", fmt.Errorf("failed to generate MD: %w", err)
	}

	return outPath, nil
}

func writeFile(path string, content string) error {
	if err := ensureDir(filepath.Dir(path)); err != nil {
		return err
	}
	return writeStringToFile(path, content)
}

func ensureDir(dir string) error {
	return mkdirAll(dir, 0o700)
}

func mkdirAll(path string, perm uint32) error {
	return os.MkdirAll(path, os.FileMode(perm))
}

func writeStringToFile(path string, content string) error {
	return os.WriteFile(path, []byte(content), 0o600)
}