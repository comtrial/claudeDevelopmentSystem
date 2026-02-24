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

export function LoginForm() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "로그인에 실패했습니다. 다시 시도해주세요."
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
            로그인
          </CardTitle>
          <CardDescription>
            계정 정보를 입력하여 로그인하세요
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
                disabled={loading}
                className="text-base md:text-sm"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-2">
            <Button type="submit" className="w-full min-h-[44px]" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "로그인 중..." : "로그인"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              계정이 없으신가요?{" "}
              <Link
                href="/signup"
                className="text-primary underline-offset-4 hover:underline"
              >
                회원가입
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
