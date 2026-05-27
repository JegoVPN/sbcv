import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveTarget, type SbcTarget } from "./targets.js";

export interface CheckRequest {
  target: SbcTarget;
  config: unknown;
}

export interface CheckResult {
  status: "valid" | "warning" | "invalid";
  target: SbcTarget;
  binary: string;
  binaryVersion: string;
  warnings: string[];
  errors: string[];
  durationMs: number;
}

const DEFAULT_TIMEOUT_MS = 5000;

function timeoutMs(): number {
  const raw = Number(process.env.CHECK_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

const SENSITIVE_PATTERN = /\b(password|private_key|secret|token|key|uuid)\s*[:=]\s*\S+/gi;

export function redactSensitive(text: string): string {
  return text.replace(SENSITIVE_PATTERN, (_, name) => `${name}=<redacted>`);
}

const WARNING_PATTERN = /(warning|deprecat(?:ed|ion)|legacy|will be removed)/i;

interface RunOutput {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
}

function runProcess(binaryPath: string, args: readonly string[], opts: { timeoutMs: number }): Promise<RunOutput> {
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, opts.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode,
        durationMs: Math.round(performance.now() - started),
        timedOut,
      });
    });
  });
}

async function readBinaryVersion(binaryPath: string): Promise<string> {
  try {
    const result = await runProcess(binaryPath, ["version"], { timeoutMs: 2000 });
    const match = /sing-box version (\S+)/.exec(result.stdout || result.stderr);
    return match?.[1] ?? "unknown";
  } catch {
    return "unknown";
  }
}

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function classify(output: RunOutput): "valid" | "warning" | "invalid" {
  if (output.timedOut) return "invalid";
  if (output.exitCode !== 0) return "invalid";
  if (WARNING_PATTERN.test(`${output.stdout}\n${output.stderr}`)) return "warning";
  return "valid";
}

export async function runCheck(req: CheckRequest): Promise<CheckResult> {
  const spec = resolveTarget(req.target);
  const dir = await mkdtemp(join(tmpdir(), "sbc-check-"));
  const configPath = join(dir, "config.json");

  try {
    await writeFile(configPath, JSON.stringify(req.config));
    const output = await runProcess(spec.binaryPath, ["check", "-c", configPath], { timeoutMs: timeoutMs() });
    const binaryVersion = await readBinaryVersion(spec.binaryPath);

    const safe = redactSensitive(`${output.stdout}\n${output.stderr}`);
    const lines = splitLines(safe);
    const status = classify(output);

    if (status === "invalid") {
      const errors = output.timedOut
        ? [`Validator timed out after ${timeoutMs()}ms`]
        : lines.length > 0
          ? lines
          : [`Exit code ${output.exitCode}`];
      return {
        status,
        target: req.target,
        binary: spec.binary,
        binaryVersion,
        warnings: [],
        errors,
        durationMs: output.durationMs,
      };
    }

    if (status === "warning") {
      return {
        status,
        target: req.target,
        binary: spec.binary,
        binaryVersion,
        warnings: lines,
        errors: [],
        durationMs: output.durationMs,
      };
    }

    return {
      status: "valid",
      target: req.target,
      binary: spec.binary,
      binaryVersion,
      warnings: [],
      errors: [],
      durationMs: output.durationMs,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
