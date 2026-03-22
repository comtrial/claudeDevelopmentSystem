"use client";

import { useEffect, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import { Eye, EyeOff, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ============================================================
// Types
// ============================================================

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface ThemeSettings {
  colorMode: "light" | "dark" | "system";
  accentColor: string;
}

interface TokenPolicySettings {
  defaultBudget: number;
  warningThresholds: [number, number, number];
  autoStopOnBudget: boolean;
}

interface NotificationSettings {
  emailOnComplete: boolean;
  emailOnError: boolean;
  browserNotifications: boolean;
  soundEnabled: boolean;
}

interface UserSettings {
  theme: ThemeSettings;
  tokenPolicy: TokenPolicySettings;
  notifications: NotificationSettings;
  claude_api_key?: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: { colorMode: "system", accentColor: "neutral" },
  tokenPolicy: { defaultBudget: 50000, warningThresholds: [60, 80, 90], autoStopOnBudget: false },
  notifications: { emailOnComplete: false, emailOnError: true, browserNotifications: false, soundEnabled: false },
};

const ACCENT_COLORS = [
  { value: "neutral", label: "기본" },
  { value: "blue", label: "파랑" },
  { value: "green", label: "초록" },
  { value: "purple", label: "보라" },
  { value: "orange", label: "주황" },
];

// ============================================================
// Main Page
// ============================================================

export default function SettingsPage() {
  const { setTheme } = useTheme();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Profile form state
  const [displayName, setDisplayName] = useState("");

  // API key state
  const [apiKey, setApiKey] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [savedApiKey, setSavedApiKey] = useState("");
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);

  // Load profile
  const loadProfile = useCallback(async () => {
    setIsLoadingProfile(true);
    try {
      const res = await fetch("/api/settings/profile");
      const json = await res.json();
      if (!json.error) {
        const p = json.data as Profile;
        setProfile(p);
        setDisplayName(p.display_name ?? "");
      }
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  // Load settings
  const loadSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (!json.error && json.data?.settings) {
        const s = json.data.settings as Partial<UserSettings>;
        setSettings({
          theme: s.theme ?? DEFAULT_SETTINGS.theme,
          tokenPolicy: s.tokenPolicy ?? DEFAULT_SETTINGS.tokenPolicy,
          notifications: s.notifications ?? DEFAULT_SETTINGS.notifications,
        });
        if (json.data.claude_api_key) {
          setSavedApiKey(json.data.claude_api_key as string);
        }
      }
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    void loadSettings();
  }, [loadProfile, loadSettings]);

  // Persist settings to API
  const persistSettings = useCallback(async (patch: Partial<UserSettings>) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: patch }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error("설정 저장에 실패했습니다.");
      }
    } catch {
      toast.error("서버 오류가 발생했습니다.");
    }
  }, []);

  // ── Profile ────────────────────────────────────────────────

  async function handleSaveProfile() {
    setIsSavingProfile(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error("프로필 저장에 실패했습니다.");
        return;
      }
      setProfile(json.data as Profile);
      toast.success("프로필이 저장되었습니다.");
    } catch {
      toast.error("서버 오류가 발생했습니다.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  // ── Theme ─────────────────────────────────────────────────

  function handleColorModeChange(mode: "light" | "dark" | "system") {
    setSettings((prev) => ({ ...prev, theme: { ...prev.theme, colorMode: mode } }));
    setTheme(mode);
    void persistSettings({ theme: { ...settings.theme, colorMode: mode } });
  }

  function handleAccentColorChange(color: string) {
    setSettings((prev) => ({ ...prev, theme: { ...prev.theme, accentColor: color } }));
    void persistSettings({ theme: { ...settings.theme, accentColor: color } });
  }

  // ── Token Policy ──────────────────────────────────────────

  function handleBudgetChange(val: number[]) {
    const budget = val[0] ?? settings.tokenPolicy.defaultBudget;
    setSettings((prev) => ({
      ...prev,
      tokenPolicy: { ...prev.tokenPolicy, defaultBudget: budget },
    }));
  }

  function handleBudgetCommit(val: number[]) {
    const budget = val[0] ?? settings.tokenPolicy.defaultBudget;
    void persistSettings({ tokenPolicy: { ...settings.tokenPolicy, defaultBudget: budget } });
  }

  function handleThresholdChange(index: 0 | 1 | 2, value: string) {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    const next = [...settings.tokenPolicy.warningThresholds] as [number, number, number];
    next[index] = Math.max(0, Math.min(100, num));
    setSettings((prev) => ({ ...prev, tokenPolicy: { ...prev.tokenPolicy, warningThresholds: next } }));
    void persistSettings({ tokenPolicy: { ...settings.tokenPolicy, warningThresholds: next } });
  }

  function handleAutoStopChange(checked: boolean) {
    setSettings((prev) => ({
      ...prev,
      tokenPolicy: { ...prev.tokenPolicy, autoStopOnBudget: checked },
    }));
    void persistSettings({ tokenPolicy: { ...settings.tokenPolicy, autoStopOnBudget: checked } });
  }

  // ── Notifications ─────────────────────────────────────────

  function handleNotificationChange(key: keyof NotificationSettings, checked: boolean) {
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: checked },
    }));
    void persistSettings({ notifications: { ...settings.notifications, [key]: checked } });
  }

  // ── API Key ───────────────────────────────────────────────

  async function handleSaveApiKey() {
    if (!apiKey.trim()) return;
    setIsSavingApiKey(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claude_api_key: apiKey.trim() }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error("API 키 저장에 실패했습니다.");
        return;
      }
      setSavedApiKey(apiKey.trim());
      setApiKey("");
      toast.success("API 키가 저장되었습니다.");
    } catch {
      toast.error("서버 오류가 발생했습니다.");
    } finally {
      setIsSavingApiKey(false);
    }
  }

  async function handleDeleteApiKey() {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claude_api_key: null }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error("API 키 삭제에 실패했습니다.");
        return;
      }
      setSavedApiKey("");
      toast.success("API 키가 삭제되었습니다.");
    } catch {
      toast.error("서버 오류가 발생했습니다.");
    }
  }

  const maskedKey = savedApiKey
    ? `${savedApiKey.slice(0, 10)}****`
    : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">설정</h1>
        <p className="text-sm text-muted-foreground mt-1">계정 및 시스템 환경을 구성합니다</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="flex w-full overflow-x-auto no-scrollbar">
          <TabsTrigger value="profile" className="flex-1 min-w-[64px] text-xs sm:text-sm px-2 sm:px-3">프로필</TabsTrigger>
          <TabsTrigger value="theme" className="flex-1 min-w-[56px] text-xs sm:text-sm px-2 sm:px-3">테마</TabsTrigger>
          <TabsTrigger value="tokens" className="flex-1 min-w-[56px] text-xs sm:text-sm px-2 sm:px-3">토큰</TabsTrigger>
          <TabsTrigger value="notifications" className="flex-1 min-w-[56px] text-xs sm:text-sm px-2 sm:px-3">알림</TabsTrigger>
          <TabsTrigger value="apikey" className="flex-1 min-w-[64px] text-xs sm:text-sm px-2 sm:px-3">API 키</TabsTrigger>
        </TabsList>

        {/* ── 프로필 탭 ──────────────────────────────────────── */}
        <TabsContent value="profile" className="mt-6 space-y-6">
          {isLoadingProfile ? (
            <ProfileSkeleton />
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile?.email ?? ""}
                  readOnly
                  className="bg-muted/50 cursor-not-allowed text-base md:text-sm"
                />
                <p className="text-xs text-muted-foreground">이메일은 변경할 수 없습니다.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="display-name">표시 이름</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="표시 이름을 입력하세요"
                  maxLength={100}
                  className="text-base md:text-sm"
                />
              </div>

              <Button className="min-h-[44px]" onClick={() => void handleSaveProfile()} disabled={isSavingProfile}>
                {isSavingProfile ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                저장
              </Button>
            </>
          )}
        </TabsContent>

        {/* ── 테마 탭 ────────────────────────────────────────── */}
        <TabsContent value="theme" className="mt-6 space-y-6">
          {isLoadingSettings ? (
            <SettingsSkeleton rows={2} />
          ) : (
            <>
              <div className="space-y-3">
                <Label>색상 모드</Label>
                <RadioGroup
                  value={settings.theme.colorMode}
                  onValueChange={(v) => handleColorModeChange(v as "light" | "dark" | "system")}
                  className="grid grid-cols-3 gap-3"
                >
                  {(["light", "dark", "system"] as const).map((mode) => (
                    <div key={mode}>
                      <RadioGroupItem value={mode} id={`mode-${mode}`} className="peer sr-only" />
                      <Label
                        htmlFor={`mode-${mode}`}
                        className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary"
                      >
                        <span className="text-sm font-medium">
                          {mode === "light" ? "라이트" : mode === "dark" ? "다크" : "시스템"}
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>강조 색상</Label>
                <Select value={settings.theme.accentColor} onValueChange={handleAccentColorChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCENT_COLORS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── 토큰 정책 탭 ───────────────────────────────────── */}
        <TabsContent value="tokens" className="mt-6 space-y-6">
          {isLoadingSettings ? (
            <SettingsSkeleton rows={3} />
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>기본 토큰 예산</Label>
                  <span className="text-sm font-medium tabular-nums">
                    {settings.tokenPolicy.defaultBudget.toLocaleString()}
                  </span>
                </div>
                <Slider
                  min={5000}
                  max={100000}
                  step={1000}
                  value={[settings.tokenPolicy.defaultBudget]}
                  onValueChange={handleBudgetChange}
                  onValueCommit={handleBudgetCommit}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>5,000</span>
                  <span>100,000</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>경고 임계값 (%)</Label>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {(settings.tokenPolicy.warningThresholds).map((threshold, i) => (
                    <div key={i} className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {i === 0 ? "1단계" : i === 1 ? "2단계" : "3단계"}
                      </p>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={threshold}
                        onChange={(e) => handleThresholdChange(i as 0 | 1 | 2, e.target.value)}
                        className="text-center text-base md:text-sm min-h-[44px]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <Label>예산 초과 시 자동 중지</Label>
                  <p className="text-xs text-muted-foreground">토큰 예산을 초과하면 파이프라인을 자동으로 중지합니다</p>
                </div>
                <Switch
                  className="shrink-0"
                  checked={settings.tokenPolicy.autoStopOnBudget}
                  onCheckedChange={handleAutoStopChange}
                />
              </div>
            </>
          )}
        </TabsContent>

        {/* ── 알림 탭 ────────────────────────────────────────── */}
        <TabsContent value="notifications" className="mt-6 space-y-4">
          {isLoadingSettings ? (
            <SettingsSkeleton rows={4} />
          ) : (
            <>
              {(
                [
                  {
                    key: "emailOnComplete" as const,
                    label: "완료 시 이메일",
                    description: "파이프라인이 완료되면 이메일로 알림을 받습니다",
                  },
                  {
                    key: "emailOnError" as const,
                    label: "오류 시 이메일",
                    description: "파이프라인이 실패하면 이메일로 알림을 받습니다",
                  },
                  {
                    key: "browserNotifications" as const,
                    label: "브라우저 알림",
                    description: "브라우저 푸시 알림을 활성화합니다",
                  },
                  {
                    key: "soundEnabled" as const,
                    label: "사운드 알림",
                    description: "완료 시 소리로 알림을 받습니다",
                  },
                ] as const
              ).map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4 py-2">
                  <div className="space-y-0.5 min-w-0">
                    <Label>{item.label}</Label>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <Switch
                    className="shrink-0"
                    checked={settings.notifications[item.key]}
                    onCheckedChange={(checked) => handleNotificationChange(item.key, checked)}
                  />
                </div>
              ))}
            </>
          )}
        </TabsContent>

        {/* ── API 키 탭 ──────────────────────────────────────── */}
        <TabsContent value="apikey" className="mt-6 space-y-6">
          <div className="rounded-lg border border-muted bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Claude Max 구독 사용 시</span> API 키가 필요하지 않습니다.
              Claude CLI의 로컬 인증을 사용하므로 API 비용이 발생하지 않습니다.
            </p>
          </div>

          {maskedKey && (
            <div className="space-y-2">
              <Label>저장된 API 키</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={maskedKey}
                  readOnly
                  className="font-mono bg-muted/50 cursor-not-allowed"
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>API 키를 삭제하시겠습니까?</AlertDialogTitle>
                      <AlertDialogDescription>
                        저장된 Claude API 키가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive hover:bg-destructive/90"
                        onClick={() => void handleDeleteApiKey()}
                      >
                        삭제
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="api-key-input">{maskedKey ? "새 API 키로 교체" : "API 키 입력"}</Label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key-input"
                  type={apiKeyVisible ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="font-mono pr-10 text-base md:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setApiKeyVisible((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  {apiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                className="min-h-[44px] w-full sm:w-auto"
                onClick={() => void handleSaveApiKey()}
                disabled={!apiKey.trim() || isSavingApiKey}
              >
                {isSavingApiKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                저장
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-9 w-20" />
    </div>
  );
}

function SettingsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-2">
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-10 rounded-full" />
        </div>
      ))}
    </div>
  );
}
