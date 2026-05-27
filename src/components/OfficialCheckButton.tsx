import { useState } from "react";
import {
  LoaderCircle,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from "lucide-react";

import { targetFromVersion } from "../domain/targets";
import { useProjectStore } from "../state/useProjectStore";

type OfficialStatus = "idle" | "valid" | "warning" | "invalid" | "error";

interface OfficialResult {
  status: OfficialStatus;
  message?: string;
  binaryVersion?: string;
}

const RAW_URL = import.meta.env.VITE_OFFICIAL_CHECK_URL ?? "";
const OFFICIAL_CHECK_URL = RAW_URL.trim();

function checkEndpoint(base: string): string {
  return `${base.replace(/\/+$/, "")}/check`;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function isOfficialCheckEnabled(): boolean {
  return OFFICIAL_CHECK_URL.length > 0;
}

export function OfficialCheckButton() {
  const [result, setResult] = useState<OfficialResult>({ status: "idle" });
  const [pending, setPending] = useState(false);
  const channel = useProjectStore((state) => state.channel);
  const version = useProjectStore((state) => state.version);
  const config = useProjectStore((state) => state.config);

  if (!isOfficialCheckEnabled()) return null;

  async function runOfficial() {
    const target = targetFromVersion(channel, version);
    const host = safeHost(OFFICIAL_CHECK_URL);
    const confirmed = window.confirm(
      `Official Check 会把当前配置发送到 ${host} 由 sing-box 二进制校验。\n该服务不会保存原始配置。\n\n继续吗？`,
    );
    if (!confirmed) return;

    setPending(true);
    setResult({ status: "idle" });
    try {
      const res = await fetch(checkEndpoint(OFFICIAL_CHECK_URL), {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({ target: target.label, config }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: OfficialStatus;
        errors?: string[];
        binaryVersion?: string;
      };
      if (!res.ok || !data.status) {
        setResult({
          status: "error",
          message: data.errors?.[0] ?? `HTTP ${res.status}`,
        });
        return;
      }
      setResult({
        status: data.status,
        binaryVersion: data.binaryVersion,
        message: data.errors?.[0] ?? "",
      });
    } catch (err) {
      setResult({ status: "error", message: (err as Error).message });
    } finally {
      setPending(false);
    }
  }

  const Icon = pending
    ? LoaderCircle
    : result.status === "valid"
      ? ShieldCheck
      : result.status === "warning"
        ? ShieldAlert
        : result.status === "invalid" || result.status === "error"
          ? ShieldX
          : LockKeyhole;

  const label = pending
    ? "Checking…"
    : result.status === "valid"
      ? `Official OK${result.binaryVersion ? ` ${result.binaryVersion}` : ""}`
      : result.status === "warning"
        ? "Official Warning"
        : result.status === "invalid"
          ? "Official Invalid"
          : result.status === "error"
            ? "Official Error"
            : "Official Check";

  const title = pending
    ? "Sending current config to the official validator..."
    : result.message
      ? `${label} - ${result.message}`
      : `Official sing-box check at ${safeHost(OFFICIAL_CHECK_URL)}`;

  return (
    <button
      type="button"
      onClick={runOfficial}
      disabled={pending}
      title={title}
      className={`official-check-btn official-check-btn--${result.status}${pending ? " is-pending" : ""}`}
      data-testid="official-check-button"
      data-status={result.status}
    >
      <Icon
        size={15}
        className={pending ? "status-pill__spinner" : undefined}
      />
      {label}
    </button>
  );
}
