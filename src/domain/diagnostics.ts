import { buildTagIndex, getDnsServerTags, getOutboundTags } from "./indexes";
import type { Diagnostic, SingBoxChannel, SingBoxConfig } from "./types";

function listItems<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function push(
  diagnostics: Diagnostic[],
  level: Diagnostic["level"],
  code: string,
  path: string,
  message: string,
) {
  diagnostics.push({ level, code, path, message, source: "semantic" });
}

export function validateConfig(
  config: SingBoxConfig,
  channel: SingBoxChannel,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const tagIndex = buildTagIndex(config);

  for (const [tag, refs] of tagIndex) {
    if (refs.length > 1) {
      push(
        diagnostics,
        "error",
        "duplicate-tag",
        refs.map((ref) => ref.path).join(", "),
        `Tag "${tag}" is used by ${refs.length} entities.`,
      );
    }
  }

  const outboundTags = getOutboundTags(config);
  const dnsServerTags = getDnsServerTags(config);
  const outbounds = listItems(config.outbounds);
  const routeRules = listItems(config.route?.rules);
  const dnsRules = listItems(config.dns?.rules);

  const routeFinal = config.route?.final;
  if (routeFinal && !outboundTags.has(routeFinal)) {
    push(
      diagnostics,
      "error",
      "missing-route-final",
      "/route/final",
      `Route final outbound "${routeFinal}" does not exist.`,
    );
  }

  routeRules.forEach((rule, index) => {
    if (rule.outbound && !outboundTags.has(rule.outbound)) {
      push(
        diagnostics,
        "error",
        "missing-rule-outbound",
        `/route/rules/${index}/outbound`,
        `Route rule ${index + 1} references missing outbound "${rule.outbound}".`,
      );
    }
  });

  outbounds.forEach((outbound, index) => {
    if ((outbound.type === "selector" || outbound.type === "urltest") && Array.isArray(outbound.outbounds)) {
      outbound.outbounds.forEach((tag, candidateIndex) => {
        if (!outboundTags.has(tag)) {
          push(
            diagnostics,
            "error",
            "missing-outbound-candidate",
            `/outbounds/${index}/outbounds/${candidateIndex}`,
            `${outbound.type} "${outbound.tag}" references missing outbound "${tag}".`,
          );
        }
      });
    }
  });

  const dnsFinal = config.dns?.final;
  if (dnsFinal && !dnsServerTags.has(dnsFinal)) {
    push(
      diagnostics,
      "error",
      "missing-dns-final",
      "/dns/final",
      `DNS final server "${dnsFinal}" does not exist.`,
    );
  }

  dnsRules.forEach((rule, index) => {
    if (rule.server && !dnsServerTags.has(rule.server)) {
      push(
        diagnostics,
        "error",
        "missing-dns-rule-server",
        `/dns/rules/${index}/server`,
        `DNS rule ${index + 1} references missing server "${rule.server}".`,
      );
    }
  });

  if (channel === "stable") {
    if (listItems(config.certificate_providers).length > 0) {
      push(
        diagnostics,
        "warning",
        "stable-version-gated-certificate-providers",
        "/certificate_providers",
        "certificate_providers is version-gated for stable targets; verify with sing-box-stable.",
      );
    }
    if (listItems(config.http_clients).length > 0) {
      push(
        diagnostics,
        "warning",
        "stable-version-gated-http-clients",
        "/http_clients",
        "http_clients is version-gated for stable targets; verify with sing-box-stable.",
      );
    }
  }

  if (outbounds.length === 0) {
    push(diagnostics, "warning", "no-outbounds", "/outbounds", "No outbounds are configured.");
  }

  return diagnostics;
}

export function summarizeDiagnostics(diagnostics: Diagnostic[]): "valid" | "warning" | "error" {
  if (diagnostics.some((diagnostic) => diagnostic.level === "error")) return "error";
  if (diagnostics.some((diagnostic) => diagnostic.level === "warning")) return "warning";
  return "valid";
}
