<img width="2549" height="1403" alt="image" src="[https://github.com/user-attachments/assets/4afd2f7e-261e-4f2f-af11-23327189b658](https://github.com/user-attachments/assets/21bc6400-5cad-4f41-a784-38241f9bfbe6)" /><div align="center">

<br />

[![Go](https://img.shields.io/badge/Go-1.24+-00ADD8?style=for-the-badge&logo=go&logoColor=white)](https://go.dev)
[![License](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Linux-111111?style=for-the-badge&logo=linux&logoColor=white)](#installation)

自托管 AI 安全测试平台，提供本地 Web 界面、实时代理遥测、验证发现和品牌化 PDF 报告。

</div>

---
# 此产品计划从v1.5后新版本会全部打包至整合
# 此项目目前源码版本：v1.3
## 包内更新
```bash
Sword-Riding --update
```
虽然重启服务即可

## 快速安装（v1.5以下版本）

```bash
git clone https://github.com/Singtreb/Sword-Riding.git
cd Sword-Riding
make build
sudo install -m 755 build/Sword-Riding /usr/local/bin/Sword-Riding
```

创建 `~/.sword-riding.env`:

```bash
SWORD_RIDING_LLM=minimax/MiniMax-M2.7
SWORD_RIDING_API_KEY=your_provider_api_key
```

## 启动web界面:

```bash
Sword-Riding --web
```

打开 `http://127.0.0.1:9137`.

> [!IMPORTANT]
> 仅在您拥有或获得明确许可的系统上使用 Sword-Riding。

> [!TIP]
> 不想自托管？完全托管版本可在 [yu123sp.com](https://yu123sp.com/) 获得 — 点击扫描，无需安装或 API 密钥。

## 目录

- [快速开始](#快速开始)
- [概述](#概述)
- [截图](#截图)
- [功能特性](#功能特性)
- [安装](#安装)
- [配置](#配置)
- [从旧版本升级](#从旧版本升级)
- [运行](#运行)
- [服务模式](#服务模式)
- [Web UI 工作流程](#web-ui-工作流程)
- [扫描模式](#扫描模式)
- [测试方法论](#测试方法论)
- [报告](#报告)
- [设置](#设置)
- [环境变量](#环境变量)
- [提供商前缀](#提供商前缀)
- [CLI 参考](#cli-参考)
- [API 摘要](#api-摘要)
- [数据存储](#数据存储)
- [开发](#开发)
- [安全注意事项](#安全注意事项)
- [许可证](#许可证)
- [链接](#链接)

## 概述

Sword-Riding 是一个自托管的 AI 安全测试平台，用于授权渗透测试和漏洞赏金工作流。它结合了 LLM 驱动的代理、浏览器自动化、终端工具、22 阶段测试方法论、实时 WebSocket 事件、发现管理、报告生成以及 AgentMail 和飞书通知集成。

默认体验是 Web UI。从一个本地仪表板，您可以启动扫描、监控活动运行、检查发现、配置模型/提供商设置、管理环境变量、生成品牌化 PDF 报告以及删除或恢复历史扫描。
## 截图
| 概览仪表板 | 扫描详情 | 发现 |
| ------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| <img width="2549" height="1403" alt="1b25a6b3a61b4549b7e0696fc2e37b19" src="https://github.com/user-attachments/assets/21bc6400-5cad-4f41-a784-38241f9bfbe6" /> | <img width="2549" height="1403" alt="47647d08676a102ab50ad951c7dac813" src="https://github.com/user-attachments/assets/769a07e0-3db2-40e7-b885-3a8c4bed1e6a" /> | <img width="2549" height="1403" alt="47647d08676a102ab50ad951c7dac813" src="https://github.com/user-attachments/assets/f1fe7bb3-c297-4345-801b-5ddd5f726b40" /> |
## 功能特性

| 领域 | 功能 |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 仪表板 | 默认在 `127.0.0.1:9137` 上运行的本地 Web UI，扫描管理、实时状态、批量扫描操作和历史扫描恢复。 |
| 扫描 | 单目标、DAST、通配符和多目标流程，支持可选择的方法论阶段。 |
| 实时遥测 | 通过 WebSocket 传输工具调用、代理消息、发现、错误、HTTP 活动和 LLM 活动。 |
| 发现 | 扫描详情页面、严重性过滤器、CVSS 详情、发现索引和验证发现工作流。 |
| 报告 | 品牌化 PDF 报告，包含目标/公司名称、上传的 Logo、报告列表、打开/下载/删除操作。 |
| 集成 | AgentMail 测试收件箱、验证邮件、OTP 流程、邮件分类事件和飞书通知。 |
| 配置 | 仪表板设置，包括 LLM、AgentMail、飞书、代理、运行时、浏览器、认证、速率限制和资源。 |
| 运行时安全 | 资源感知的实例限制和仅环回绑定，除非通过认证明确配置外部访问。 |

## 安装

### 要求

| 要求 | 说明 |
| -------------- | ------------------------------------------------------------ |
| Linux | 主要支持平台。 |
| Go | `1.24.2` 或更高版本。 |
| Node.js + npm | 从源代码构建捆绑的 React Web UI 时需要。 |
| 安全工具 | 仅在启用自动安装时按需安装。 |

检查您的 Go 版本：

```bash
go version
```

### 从源代码构建

```bash
git clone https://github.com/Singtreb/Sword-Riding.git
cd Sword-Riding
make build
sudo install -m 755 build/Sword-Riding /usr/local/bin/Sword-Riding
```

`make build` 将 React Web UI 构建到 `internal/web/static`，然后构建 Go 二进制文件。

### 使用 Go 安装

```bash
GOPROXY=direct GOSUMDB=off go install github.com/Singtreb/Sword-Riding/v4/cmd/Sword-Riding@latest
```

## 配置

Sword-Riding 按以下顺序加载配置。后面的源会覆盖前面的源。

| 顺序 | 来源 |
| ----- | -------------------------------------------------------------- |
| 1     | `/etc/sword-riding.env` |
| 2     | `/home/<sudo-user>/.sword-riding.env`（通过 `sudo` 启动时） |
| 3     | `~/.sword-riding.env` |
| 4     | 进程中已存在的环境变量 |

创建本地环境文件：

```bash
nano ~/.sword-riding.env
```

### 最小配置

```bash
SWORD_RIDING_LLM=minimax/MiniMax-M2.7
SWORD_RIDING_API_KEY=your_provider_api_key
```

### 提供商示例

OpenAI:

```bash
SWORD_RIDING_LLM=openai/gpt-5.4
SWORD_RIDING_API_KEY=sk-...
```

自定义 OpenAI 兼容提供商：

```bash
SWORD_RIDING_LLM=custom/security-model
SWORD_RIDING_API_BASE=https://your-provider.example/v1
SWORD_RIDING_API_KEY=your_provider_api_key
```

### 可选集成

```bash
GEMINI_API_KEY=AIza...
AGENTMAIL_POD=am_us_pod_47
AGENTMAIL_API_KEY=ak_...
SWORD_RIDING_FEISHU_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/...
SWORD_RIDING_FEISHU_MIN_SEVERITY=high
```

### 仪表板认证

```bash
SWORD_RIDING_USERNAME=admin
SWORD_RIDING_PASSWORD=change-this-password
```

> [!TIP]
> 生产部署中首选 `SWORD_RIDING_PASSWORD_HASH`。

## 从旧版本升级

此版本提供了稳定性和工作空间隔离增强，包含一个破坏性变更和一些值得了解的新功能。

### 破坏性变更：默认工作空间移动到 `~/.sword-riding/data/`

扫描输出、笔记、计划和其他生成的工件现在位于 `~/.sword-riding/data/` 下，而不是 `$CWD`（启动二进制文件的目录）。

要保留以前的行为，将 `SWORD_RIDING_DATA_DIR` 指向您当前的工作目录：

```bash
export SWORD_RIDING_DATA_DIR=$(pwd)
```

当在 `$CWD` 中检测到遗留标记（`notes.json`、`_schedules/`、`vulnerabilities.json` 或 `YYYY-MM-DD/scan-*` 目录）且 `SWORD_RIDING_DATA_DIR` 未设置时，启动时会发出 `[MIGRATION]` 警告。Sword-Riding 不会自动读取、复制或删除这些遗留文件；警告仅为信息性，每个进程仅触发一次。

### 新环境变量

| 变量 | 默认值 | 描述 |
| ---------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `SWORD_RIDING_LLM_MAX_INFLIGHT` | `4 × EffectiveMaxInstances` | 限制所有正在运行的扫描中同时进行的出站 LLM 调用。最小值为 `1`。取消的等待者不占用插槽。 |

### 新健康端点计数器

`GET /api/status` 现在暴露：

| 字段 | 含义 |
| --------------------- | ------------------------------------------------------------------------------------ |
| `panics_recovered` | Goroutine、HTTP 处理器和工具 panic，已恢复而未崩溃。 |
| `path_rejections` | 文件系统写入被 Path_Policy 拒绝（在 `data_dir` / `~/.sword-riding/` / `/tmp` 之外）。 |
| `watchdog_kills` | 被每个工具的硬超时看门狗终止的子进程。 |
| `admission_refusals` | 由于并发上限而被拒绝的扫描准入请求。 |
| `llm_inflight_cap` | 此进程的有效 `SWORD_RIDING_LLM_MAX_INFLIGHT` 值。 |
| `data_dir` | 当前使用的已解析 Data_Dir。 |
| `allow_list` | Path_Policy 接受的文件系统根目录。 |

## 运行

### Web UI

```bash
Sword-Riding --web
```

打开：

```text
http://127.0.0.1:9137
```

使用不同端口：

```bash
Sword-Riding --web --port 8080
```

### 外部访问

仅在启用仪表板认证后绑定到其他接口：

```bash
SWORD_RIDING_USERNAME=admin SWORD_RIDING_PASSWORD=change-this Sword-Riding --web --bind 0.0.0.0
```

> [!WARNING]
> 服务器在没有仪表板认证的情况下拒绝外部绑定。

### CLI 扫描

```bash
Sword-Riding --target https://example.com
```

使用自定义指令：

```bash
Sword-Riding --target https://app.example.com --instruction "Focus on SQL injection, IDOR, and auth bypass. Avoid destructive tests."
```

## 服务模式

安装并作为系统服务启动：

```bash
sudo Sword-Riding --start
```

管理服务：

```bash
sudo Sword-Riding --restart
sudo Sword-Riding --stop
sudo Sword-Riding --uninstall
```

查看日志：

```bash
journalctl -u Sword-Riding -f
```

### 远程服务访问

仅在启用仪表板认证后向远程浏览器暴露服务：

```bash
sudo tee -a /root/.sword-riding.env >/dev/null <<'EOF'
SWORD_RIDING_BIND=0.0.0.0
SWORD_RIDING_USERNAME=admin
SWORD_RIDING_PASSWORD=change-this
EOF

sudo Sword-Riding --restart
```

然后打开 `http://<server-ip>:9137`。

如果进程正在监听但页面仍无法远程加载，请在服务器防火墙或云安全组中允许 TCP 端口 `9137`。

## Web UI 工作流程

1. 在 `http://127.0.0.1:9137` 打开仪表板。
2. 转到设置并确认 LLM 提供商、API 密钥、速率限制和可选集成。
3. 从新建扫描创建扫描。
4. 选择扫描模式。
5. 当需要聚焦运行时选择方法论阶段。
6. 当只需要报告特定严重性时设置严重性过滤器。
7. 添加公司名称并上传 Logo 用于品牌化报告。
8. 从概览、扫描详情或实时馈送监控进度。
9. 从扫描和报告页面打开发现详情、下载报告或管理历史扫描。

## 扫描模式

| 模式 | 最适合 |
| ---------------- | ------------------------------------------------------------------------------- |
| 单目标 | 测试一个已知 URL 或主机。 |
| 通配符 / 多目标 | 枚举相关目标并扫描发现的攻击面。 |
| DAST | 浏览器辅助测试，用于 Web 应用、认证流程、表单和运行时行为。 |

## 测试方法论

Sword-Riding 将自主测试组织为 22 个阶段。

| 阶段 | 重点 |
| ----: | ------------------------------------------ |
|     1 | 侦察 |
|     2 | 手动漏洞发现 |
|     3 | 目录和文件发现 |
|     4 | CORS 和 Cookie 分析 |
|     5 | 认证与会话测试 |
|     6 | 注入测试 |
|     7 | SSRF 测试 |
|     8 | IDOR 和访问控制缺陷 |
|     9 | API 和 GraphQL 测试 |
|    10 | 文件上传测试 |
|    11 | 反序列化和 RCE |
|    12 | 竞态条件和业务逻辑 |
|    13 | 子域名接管 |
|    14 | 开放重定向测试 |
|    15 | 邮件安全测试 |
|    16 | 云与基础设施 |
|    17 | WebSocket 测试 |
|    18 | CMS 专项测试 |
|    19 | 链接劫持与内容欺骗 |
|    20 | 漏洞验证 |
|    21 | 新型漏洞发现 |
|    22 | 最终报告 |

Web UI 中的阶段选择允许您运行所有阶段或仅运行特定项目所需的子集。

## 报告

报告生成为 PDF 文件，可包含：

| 部分 | 包含内容 |
| ----------- | ------------------------------------------------------------------------------- |
| 摘要 | 执行摘要、目标元数据、扫描元数据和严重性概述。 |
| 发现 | 验证发现、CVSS 详情、技术分析和利用证明。 |
| 证据 | 概念验证命令、脚本、payload 笔记和支持性观察。 |
| 修复建议 | 修复指导和优先级下一步行动。 |
| 品牌化 | 公司/目标名称和上传的 Logo。 |

报告可从扫描详情页面和报告页面获取。报告行支持打开、下载和删除。

## 设置

大多数操作设置可以从 Web UI 的设置中更改。

| 领域 | 示例 |
| ------------- | ------------------------------------------------------------------- |
| 项目设置 | 仪表板请求速率限制 |
| LLM | 模型、API 密钥、API 基础、推理努力、重试、最大迭代次数 |
| AgentMail | Pod 和 API 密钥 |
| 通知 | 飞书 webhook 和最小严重性 |
| 代理 | 代理 URL、代理文件、轮换、TLS 验证 |
| 运行时 | 工作空间、浏览器路径、自动安装控制 |
| 安全 | 仪表板用户名、密码、密码哈希、绑定地址 |
| 资源 | CPU/RAM/磁盘阈值和扫描并发预算 |

某些设置需要重启，因为它们影响进程启动或服务器绑定。UI 会标记这些字段。

## 环境变量

### 核心

| 变量 | 默认值 | 描述 |
| ------------------------------------ | ---------------- | ------------------------------------------------------ |
| `SWORD_RIDING_LLM` | none | 必填模型名称，通常带有提供商前缀。 |
| `SWORD_RIDING_API_KEY` | none | 必填 LLM 提供商 API 密钥。 |
| `SWORD_RIDING_API_BASE` | provider default | 自定义 OpenAI 兼容 API 基础 URL。 |
| `SWORD_RIDING_REASONING_EFFORT` | `high` | 推理努力：`low`、`medium`、`high` 或 `xhigh`。 |
| `SWORD_RIDING_LLM_MAX_RETRIES` | `5` | 临时 LLM 失败的重试次数。 |
| `SWORD_RIDING_MEMORY_COMPRESSOR_TIMEOUT` | `30` | 上下文压缩超时（秒）。 |
| `SWORD_RIDING_MAX_ITERATIONS` | `0` | 代理迭代上限。`0` 表示无限制。 |
| `GEMINI_API_KEY` | none | 可选 Gemini 密钥，用于网络搜索增强。 |

### Web 和安全

| 变量 | 默认值 | 描述 |
| ------------------------ | ----------------- | ---------------------------------- |
| `SWORD_RIDING_BIND` | `127.0.0.1` | Web 服务器监听地址。 |
| `SWORD_RIDING_USERNAME` | none | 仪表板用户名。 |
| `SWORD_RIDING_PASSWORD` | none | 仪表板密码。 |
| `SWORD_RIDING_PASSWORD_HASH` | none | 首选 bcrypt 密码哈希。 |
| `SWORD_RIDING_WORKSPACE` | current directory | 扫描执行的工作空间根目录。 |

### 集成

| 变量 | 默认值 | 描述 |
| ------------------------------- | ------- | ---------------------------------------- |
| `AGENTMAIL_POD` | none | AgentMail pod 标识符。 |
| `AGENTMAIL_API_KEY` | none | AgentMail API 密钥。 |
| `SWORD_RIDING_FEISHU_WEBHOOK` | none | 全局飞书 webhook。 |
| `SWORD_RIDING_FEISHU_MIN_SEVERITY` | none | 发送到飞书的最小严重性。 |
| `CAIDO_PORT` | `0` | Caido 代理端口。`0` 表示自动检测。 |
| `CAIDO_API_TOKEN` | none | Caido API 令牌。 |

### 速率限制、代理和运行时

| 变量 | 默认值 | 描述 |
| ------------------------------ | ------------ | -------------------------------------------------- |
| `SWORD_RIDING_RATE_LIMIT_REQUESTS` | `60` | 仪表板请求数/窗口。 |
| `SWORD_RIDING_RATE_LIMIT_WINDOW` | `60` | 仪表板速率限制窗口（秒）。 |
| `SWORD_RIDING_RATE_RPS` | `10` | 持续出站请求速率。 |
| `SWORD_RIDING_RATE_BURST` | `20` | 出站突发大小。 |
| `SWORD_RIDING_USE_PROXY` | `false` | 启用代理路由。 |
| `SWORD_RIDING_PROXY_URL` | none | 单个代理 URL。覆盖代理文件。 |
| `SWORD_RIDING_PROXY_FILE` | none | 包含每行一个代理的文件。 |
| `SWORD_RIDING_PROXY_ROTATION` | `roundrobin` | 代理轮换策略：`roundrobin` 或 `random`。 |
| `SWORD_RIDING_TLS_SKIP_VERIFY` | `false` | 跳过测试流量的 TLS 验证。 |
| `SWORD_RIDING_DISABLE_BROWSER` | `false` | 禁用浏览器自动化。 |
| `SWORD_RIDING_BROWSER_PATH` | auto | 自定义 Chrome/Chromium 可执行文件路径。 |
| `SWORD_RIDING_ALLOW_AUTO_INSTALL` | root only | 允许自动安装包。 |
| `SWORD_RIDING_AUTO_INSTALL_SUDO` | `false` | 允许 sudo 前缀的自动安装。 |

## 提供商前缀

当 `SWORD_RIDING_API_BASE` 为空时，Sword-Riding 从模型前缀推断提供商默认值。

| 前缀 | 默认 API 基础 |
| ------------ | ---------------------------------------------- |
| `openai/` | `https://api.openai.com/v1` |
| `anthropic/` | `https://api.anthropic.com` |
| `deepseek/` | `https://api.deepseek.com/v1` |
| `groq/` | `https://api.groq.com/openai/v1` |
| `google/` | `https://generativelanguage.googleapis.com/v1` |
| `gemini/` | `https://generativelanguage.googleapis.com/v1` |
| `ollama/` | `http://localhost:11434/v1` |
| `minimax/` | `https://api.minimax.io/v1` |

模型名称未硬编码到此列表中。设置页面接受类型化模型 ID，因此可以使用较新的提供商模型而无需等待 UI 下拉更新。

## CLI 参考

| 标志 | 别名 | 描述 |
| ---------------------- | ----- | ------------------------------------------ |
| `--web` | `-w` | 启动 Web UI。 |
| `--port <port>` | `-p` | Web UI 端口。默认：`9137`。 |
| `--bind <addr>` | none | 绑定地址。默认：`127.0.0.1`。 |
| `--target <target>` | `-t` | 目标 URL、主机、IP 或路径。可重复。 |
| `--instruction <text>` | `-i` | 自定义扫描指令。 |
| `--model <model>` | `-m` | 覆盖本次运行的 `SWORD_RIDING_LLM`。 |
| `--update` | `-up` | 更新到最新版本。 |
| `--version` | `-v` | 打印版本。 |
| `--start` | none | 安装并启动系统服务。 |
| `--stop` | none | 停止系统服务。 |
| `--restart` | none | 重启系统服务。 |
| `--uninstall` | none | 移除系统服务。 |
| `--help` | `-h` | 显示帮助。 |

## API 摘要

| 方法 | 端点 | 目的 |
| -------- | ---------------------------- | --------------------------------------------- |
| `POST` | `/api/scan` | 启动或保存扫描。 |
| `POST` | `/api/stop` | 停止所有正在运行的扫描。 |
| `GET` | `/api/status` | 当前全局状态。 |
| `GET` | `/api/scans` | 列出扫描。 |
| `GET` | `/api/scans/:id` | 获取扫描详情。 |
| `DELETE` | `/api/scans/:id` | 删除扫描及其报告数据。 |
| `GET` | `/api/report/:id` | 下载 PDF 报告。 |
| `GET` | `/api/instances` | 列出活动和历史实例。 |
| `GET` | `/api/instances/:id/events` | 获取缓冲的事件历史。 |
| `POST` | `/api/instances/:id/stop` | 停止特定实例。 |
| `POST` | `/api/instances/:id/start` | 将已保存或已完成的扫描作为新运行启动。 |
| `POST` | `/api/instances/:id/restart` | 使用相同配置重启。 |
| `POST` | `/api/instances/:id/pause` | 暂停运行中的扫描。 |
| `POST` | `/api/instances/:id/resume` | 恢复暂停的扫描。 |
| `POST` | `/api/upload-logo` | 上传报告 Logo。 |
| `POST` | `/api/upload-targets` | 上传目标列表。 |
| `GET` | `/api/settings/environment` | 列出可编辑的环境设置。 |
| `POST` | `/api/settings/environment` | 保存环境设置。 |
| `GET` | `/api/settings/llm` | 获取 LLM 设置。 |
| `POST` | `/api/settings/llm` | 保存 LLM 设置。 |
| `GET` | `/api/settings/agentmail` | 获取 AgentMail 设置。 |
| `POST` | `/api/settings/agentmail` | 保存 AgentMail 设置。 |
| `GET` | `/ws` | WebSocket 实时事件流。 |

## 数据存储

Web 模式扫描数据存储在：

```text
~/.sword-riding/data/
|-- _saved/
|-- logos/
|-- queue_state.json
`-- <target>/
    `-- <date>/
        `-- <scan-id>/
            |-- scan.json
            `-- report.pdf
```

服务器在磁盘上保留历史扫描记录，以便 UI 在刷新或重启后可以恢复。

## 开发

| 任务 | 命令 |
| --------------------------- | ----------------------------- |
| 安装 Web UI 依赖 | `make webui-install` |
| 构建所有内容 | `make build` |
| 运行测试 | `go test ./...` |
| 从源代码运行 Web UI | `go run ./cmd/Sword-Riding --web` |
| 运行前端开发服务器 | `make webui-dev` |

## 安全注意事项

- 仅针对授权目标使用 Sword-Riding。
- 不要在未经许可的情况下对第三方系统运行主动测试。
- 启动前审查扫描指令。
- 配置速率限制和代理设置以匹配项目规则。
- 外部暴露仪表板需要认证。
- 自动安装默认对非 root 用户禁用，仅在您信任环境时启用。

## 许可证

Sword-Riding 以 MIT 许可证发布。请参阅 [LICENSE](LICENSE)。

## 链接

| 资源 | 链接 |
| ------------- | -------------------------------------------------------------------------------- |
| 托管（云端） | [www.yu123sp.com](https://www.yu123sp.com/) |
| 文档 | [docs.sword-riding.com](https://docs.sword-riding.com) |
| Issues | [github.com/Singtreb/Sword-Riding/issues](https://github.com/Singtreb/Sword-Riding/issues) |
| 支持 | [buymeacoffee.com/Singtreb](https://buymeacoffee.com/Singtreb) |
