export const SAMPLE_LOGS: Record<string, { message: string; level: string }[]> = {
  pm: [
    { message: "요구사항 분석 중...", level: "info" },
    { message: "기존 코드베이스 구조 파악 완료", level: "info" },
    { message: "작업 계획 수립 완료", level: "info" },
    { message: "Engineer에게 작업 위임", level: "info" },
  ],
  engineer: [
    { message: "코드 분석 중...", level: "info" },
    { message: "의존성 그래프 분석 완료", level: "debug" },
    { message: "변경사항 생성 중...", level: "info" },
    { message: "테스트 코드 작성 중...", level: "info" },
    { message: "diff 생성 완료", level: "info" },
  ],
  reviewer: [
    { message: "코드 리뷰 시작", level: "info" },
    { message: "코드 스타일 검토 완료", level: "debug" },
    { message: "보안 검토 완료", level: "info" },
    { message: "성능 영향 분석 완료", level: "info" },
    { message: "최종 승인", level: "info" },
  ],
};

export const SAMPLE_DIFFS = [
  {
    file_path: "src/components/Dashboard.tsx",
    change_type: "modified" as const,
    diff_content: `@@ -15,6 +15,12 @@
 export function Dashboard() {
   const [data, setData] = useState(null);
+  const [loading, setLoading] = useState(true);
+
+  useEffect(() => {
+    fetchData().then(setData).finally(() => setLoading(false));
+  }, []);
+
   return (`,
    additions: 6,
    deletions: 0,
  },
  {
    file_path: "src/lib/utils/validation.ts",
    change_type: "added" as const,
    diff_content: `@@ -0,0 +1,18 @@
+export function validateInput(input: string): boolean {
+  if (!input || input.trim().length === 0) return false;
+  if (input.length > 2000) return false;
+  return true;
+}
+
+export function sanitizeOutput(output: string): string {
+  return output.replace(/<script>/gi, '').trim();
+}`,
    additions: 9,
    deletions: 0,
  },
  {
    file_path: "src/tests/validation.test.ts",
    change_type: "added" as const,
    diff_content: `@@ -0,0 +1,12 @@
+import { validateInput, sanitizeOutput } from '../lib/utils/validation';
+
+describe('validateInput', () => {
+  it('rejects empty input', () => {
+    expect(validateInput('')).toBe(false);
+  });
+
+  it('accepts valid input', () => {
+    expect(validateInput('hello world')).toBe(true);
+  });
+});`,
    additions: 12,
    deletions: 0,
  },
];
