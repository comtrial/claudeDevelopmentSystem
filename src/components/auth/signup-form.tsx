"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Bot } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SignUpForm() {
  const { signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password, displayName || email.split("@")[0]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "회원가입에 실패했습니다. 다시 시도해주세요."
      );
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center">
      <div className="mb-6 flex items-center gap-2">
        <Bot className="size-6 text-primary" strokeWidth={1.5} />
        <span className="text-lg font-semibold tracking-tight">Claude Dev System</span>
      </div>
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            회원가입
          </CardTitle>
          <CardDescription>
            새 계정을 만들어 시작하세요
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="displayName">이름</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="홍길동"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading}
                className="text-base md:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="text-base md:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
                className="text-base md:text-sm"
              />
              <p className="text-xs text-muted-foreground">최소 6자 이상</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-2">
            <Button type="submit" className="w-full min-h-[44px]" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "가입 중..." : "회원가입"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              이미 계정이 있으신가요?{" "}
              <Link
                href="/login"
                className="text-primary underline-offset-4 hover:underline"
              >
                로그인
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
