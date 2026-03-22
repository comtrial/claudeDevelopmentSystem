You are implementing a critical fix for Sprint 2 of the Claude Dev System project.

## Context
The project is at `/Users/choeseung-won/personal-project/claudeDevelopmentSystem`.
Read CLAUDE.md first for project conventions.

## TASK: Fix BE-2.1 — Replace Claude API with Claude CLI spawn

The file `src/app/api/pipelines/parse/route.ts` currently calls `https://api.anthropic.com/v1/messages` directly.
This MUST be replaced with `child_process.spawn("claude", [...])` CLI approach.

### Why
- This is a LOCAL program running on localhost:3000
- Uses Claude Max subscription ($0 API cost)
- Claude CLI handles authentication locally
- No API key needed

### Implementation

Replace the entire `callClaudeAPI` function and related API-key logic with CLI spawn:

```typescript
import { spawn } from 'child_process';

function callClaudeCLI(input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const prompt = `${SYSTEM_PROMPT}\n\nUser input:\n${input}`;
    const child = spawn('claude', [
      '-p', prompt,
      '--output-format', 'json',
      '--max-turns', '1',
      '--model', 'sonnet'
    ]);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new AppError(502, 'Claude CLI request timed out', 'CLI_TIMEOUT'));
    }, 30000);

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new AppError(502, `Claude CLI exited with code ${code}: ${stderr}`, 'CLI_ERROR'));
        return;
      }
      // Parse the JSON output from claude CLI
      try {
        const cliOutput = JSON.parse(stdout);
        // claude --output-format json returns { result: "text content", ... }
        const text = cliOutput.result || cliOutput.text || stdout;
        resolve(typeof text === 'string' ? text : JSON.stringify(text));
      } catch {
        // If not JSON wrapper, use raw stdout
        resolve(stdout);
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(new AppError(502, `Claude CLI not found or failed: ${err.message}`, 'CLI_ERROR'));
    });
  });
}
```

### Changes Required
1. Remove `CLAUDE_API_URL`, `CLAUDE_MODEL` constants
2. Remove `getApiKey()` function entirely
3. Remove `callClaudeAPI()` function
4. Add `import { spawn } from 'child_process'`
5. Add `callClaudeCLI()` function as shown above
6. Update `callClaudeWithRetry` to call `callClaudeCLI` instead of `callClaudeAPI`
7. Remove `apiKey` parameter from `callClaudeWithRetry`
8. In POST handler, remove the `getApiKey` call, call `callClaudeWithRetry(input.trim())` directly
9. Keep `SYSTEM_PROMPT`, `tryParseJSON`, `validateAgentRole`, `matchPresetTemplate` unchanged

### Verification
After changes:
- `npx tsc --noEmit` should pass (0 errors)
- The file should NOT contain any reference to `api.anthropic.com` or `x-api-key`
- The file should import `spawn` from `child_process`

### Also update CLAUDE.md
Add a learning note under the "## Learnings" section:
```
- Sprint 2 Fix: Replaced Claude API direct call with CLI spawn (child_process.spawn).
  Key pattern: claude -p "prompt" --output-format json --max-turns 1 --model sonnet
```
