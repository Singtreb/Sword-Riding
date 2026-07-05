import { useState, type FormEvent } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/store/auth"
import { HttpError } from "@/api/client"
import { AlertCircle } from "lucide-react"

/**
 * Map a thrown error from `useAuth.login()` to a user-facing string.
 * The api client now throws an `HttpError` with status + parsed body, so
 * we can pick a friendly message per status code instead of leaking the
 * raw `HTTP 401 Unauthorized: {"error":"…"}` envelope.
 */
function describeLoginError(err: unknown): string {
  if (err instanceof HttpError) {
    const serverMsg =
      err.data && typeof err.data === "object" && "error" in (err.data as Record<string, unknown>)
        ? String((err.data as { error?: unknown }).error ?? "")
        : ""
    switch (err.status) {
      case 0:
        return "无法连接服务器。请检查网络或确认Xalgorix服务正在运行。"
      case 400:
        return serverMsg || "请求无效，请重试。"
      case 401:
        return "用户名或密码无效。"
      case 403:
        return serverMsg || "请求被服务器阻止（CSRF检查失败）。"
      case 404:
        return "登录端点未在服务器上找到。后端似乎已过期，请重建并重新部署Xalgorix服务器。"
      case 405:
        return "此服务器不接受登录请求格式。请尝试刷新页面。"
      case 429: {
        const wait = err.retryAfter ?? 0
        return wait > 0
          ? `尝试失败次数过多。${wait}秒后重试。`
          : serverMsg || "尝试失败次数过多。请稍等片刻再重试。"
      }
      case 500:
      case 502:
      case 503:
      case 504:
        return "服务器错误。请稍后重试。"
      default:
        return serverMsg || `登录失败 (HTTP ${err.status})。`
    }
  }
  if (err instanceof Error) return err.message
  return "登录失败"
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuth((s) => s.login)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? "/"

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(describeLoginError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen w-full bg-background lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r border-border bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-primary">
            <img src="/logo.png" alt="Sword-Riding" className="h-full w-full object-cover" />
          </div>
          <span className="font-mono text-sm font-semibold tracking-tight text-primary">Sword-Riding</span>
        </div>
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="font-sans text-4xl font-semibold tracking-tight text-foreground text-balance">
              自主进攻性AI平台。
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              持续侦察、多阶段利用和AI驱动分类 —— 从单个控制台编排。
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-6 border-t border-border pt-6">
            <Stat label="活动扫描" value="12" />
            <Stat label="发现结果(7天)" value="2,431" />
            <Stat label="平均检测时间" value="42秒" />
            <Stat label="覆盖率" value="98.4%" />
          </dl>
        </div>
        <p className="text-xs text-muted-foreground">© Sword-Riding · 仅供内部使用</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-primary">
              <img src="/logo.png" alt="Sword-Riding" className="h-full w-full object-cover" />
            </div>
            <span className="font-mono text-sm font-semibold tracking-tight text-primary">Sword-Riding</span>
          </div>
          <Card className="shadow-lg border-border/50 bg-white">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl font-semibold">登录</CardTitle>
              <CardDescription className="text-muted-foreground">操作员控制台访问</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium">用户名</Label>
                  <Input
                    id="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                    className="h-11 px-4 border-border/60 bg-background hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="请输入用户名"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 px-4 border-border/60 bg-background hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="请输入密码"
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-medium bg-primary hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 transition-all duration-200" 
                  disabled={loading}
                >
                  {loading ? "登录中…" : "登录"}
                </Button>
              </form>
            </CardContent>
          </Card>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            受CSRF保护 · 会话Cookie仅通过HTTP传输
          </p>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-semibold tracking-tight">{value}</dd>
    </div>
  )
}
