import { buildTagIndex, getDnsServerTags, getEndpointTags, getInboundTags, getOutboundTags, getRuleSetTags } from "./indexes";
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
  const inboundTags = getInboundTags(config);
  const dnsServerTags = getDnsServerTags(config);
  const endpointTags = getEndpointTags(config);
  const ruleSetTags = getRuleSetTags(config);
  const outbounds = listItems(config.outbounds);
  const routeRules = listItems(config.route?.rules);
  const dnsRules = listItems(config.dns?.rules);
  const endpoints = listItems(config.endpoints);
  const services = listItems(config.services);

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
    const inbounds = Array.isArray(rule.inbound) ? rule.inbound : rule.inbound ? [rule.inbound] : [];
    inbounds.forEach((tag) => {
      if (!inboundTags.has(tag)) {
        push(
          diagnostics,
          "error",
          "missing-route-rule-inbound",
          `/route/rules/${index}/inbound`,
          `Route rule ${index + 1} references missing inbound "${tag}".`,
        );
      }
    });
    if (rule.outbound && !outboundTags.has(rule.outbound)) {
      push(
        diagnostics,
        "error",
        "missing-rule-outbound",
        `/route/rules/${index}/outbound`,
        `Route rule ${index + 1} references missing outbound "${rule.outbound}".`,
      );
    }
    const ruleSets = Array.isArray(rule.rule_set) ? rule.rule_set : rule.rule_set ? [rule.rule_set] : [];
    ruleSets.forEach((tag) => {
      if (!ruleSetTags.has(tag)) {
        push(
          diagnostics,
          "error",
          "missing-route-rule-set",
          `/route/rules/${index}/rule_set`,
          `Route rule ${index + 1} references missing rule-set "${tag}".`,
        );
      }
    });
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

  endpoints.forEach((endpoint, index) => {
    if (endpoint.detour && !outboundTags.has(endpoint.detour)) {
      push(
        diagnostics,
        "error",
        "missing-endpoint-detour",
        `/endpoints/${index}/detour`,
        `Endpoint "${endpoint.tag}" references missing detour outbound "${endpoint.detour}".`,
      );
    }
  });

  services.forEach((service, index) => {
    if (service.detour && !outboundTags.has(service.detour)) {
      push(
        diagnostics,
        "error",
        "missing-service-detour",
        `/services/${index}/detour`,
        `Service "${service.tag}" references missing detour outbound "${service.detour}".`,
      );
    }

    if (service.type === "ssm-api") {
      const servers = service.servers && typeof service.servers === "object" && !Array.isArray(service.servers) ? service.servers : {};
      if (Object.keys(servers).length === 0) {
        push(
          diagnostics,
          "warning",
          "ssm-api-no-managed-inbound",
          `/services/${index}/servers`,
          "SSM API needs at least one managed Shadowsocks inbound mapping.",
        );
      }
      Object.entries(servers).forEach(([path, tag]) => {
        const inbound = config.inbounds?.find((item) => item.tag === tag);
        if (!inbound) {
          push(
            diagnostics,
            "error",
            "missing-ssm-api-inbound",
            `/services/${index}/servers/${path}`,
            `SSM API endpoint "${path}" references missing inbound "${tag}".`,
          );
        } else if (inbound.type !== "shadowsocks" || !inbound.managed) {
          push(
            diagnostics,
            "warning",
            "ssm-api-inbound-not-managed-shadowsocks",
            `/services/${index}/servers/${path}`,
            `SSM API endpoint "${path}" should reference a Shadowsocks inbound with managed enabled.`,
          );
        }
      });
    }

    if (service.type === "derp") {
      const refs = Array.isArray(service.verify_client_endpoint)
        ? service.verify_client_endpoint
        : service.verify_client_endpoint
          ? [service.verify_client_endpoint]
          : [];
      refs.forEach((tag) => {
        const endpoint = config.endpoints?.find((item) => item.tag === tag);
        if (!endpoint) {
          push(
            diagnostics,
            "error",
            "missing-derp-verify-endpoint",
            `/services/${index}/verify_client_endpoint`,
            `DERP service "${service.tag}" references missing endpoint "${tag}".`,
          );
        } else if (endpoint.type !== "tailscale") {
          push(
            diagnostics,
            "warning",
            "derp-verify-endpoint-not-tailscale",
            `/services/${index}/verify_client_endpoint`,
            `DERP service "${service.tag}" should verify clients with a Tailscale endpoint.`,
          );
        }
      });
      const tls = service.tls;
      const tlsEnabled = tls && typeof tls === "object" && !Array.isArray(tls) ? Boolean((tls as Record<string, unknown>).enabled) : false;
      if (!tlsEnabled) {
        push(
          diagnostics,
          "warning",
          "derp-service-needs-tls",
          `/services/${index}/tls`,
          "DERP service requires TLS for official sing-box checks.",
        );
      }
    }

    if (service.type === "resolved") {
      push(
        diagnostics,
        "warning",
        "resolved-service-linux-only",
        `/services/${index}`,
        "Resolved service is Linux/systemd-specific; official checks may fail on other platforms.",
      );
    }

    if (service.type === "hysteria-realm" && channel !== "testing") {
      push(
        diagnostics,
        "error",
        "hysteria-realm-testing-only",
        `/services/${index}`,
        "Hysteria Realm service is available only for the 1.14 testing target.",
      );
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

  if (channel === "testing" && config.dns?.independent_cache !== undefined) {
    push(
      diagnostics,
      "warning",
      "deprecated-dns-independent-cache",
      "/dns/independent_cache",
      "dns.independent_cache is deprecated in sing-box 1.14 and will be removed in 1.16. Migrate to the independent DNS cache model.",
    );
  }

  dnsRules.forEach((rule, index) => {
    const inbounds = Array.isArray(rule.inbound) ? rule.inbound : rule.inbound ? [rule.inbound] : [];
    inbounds.forEach((tag) => {
      if (!inboundTags.has(tag)) {
        push(
          diagnostics,
          "error",
          "missing-dns-rule-inbound",
          `/dns/rules/${index}/inbound`,
          `DNS rule ${index + 1} references missing inbound "${tag}".`,
        );
      }
    });
    if (rule.server && !dnsServerTags.has(rule.server)) {
      push(
        diagnostics,
        "error",
        "missing-dns-rule-server",
        `/dns/rules/${index}/server`,
        `DNS rule ${index + 1} references missing server "${rule.server}".`,
      );
    }
    const ruleSets = Array.isArray(rule.rule_set) ? rule.rule_set : rule.rule_set ? [rule.rule_set] : [];
    ruleSets.forEach((tag) => {
      if (!ruleSetTags.has(tag)) {
        push(
          diagnostics,
          "error",
          "missing-dns-rule-set",
          `/dns/rules/${index}/rule_set`,
          `DNS rule ${index + 1} references missing rule-set "${tag}".`,
        );
      }
    });
  });

  listItems(config.dns?.servers).forEach((server, index) => {
    if (server.detour && !outboundTags.has(server.detour)) {
      push(
        diagnostics,
        "error",
        "missing-dns-server-detour",
        `/dns/servers/${index}/detour`,
        `DNS server "${server.tag}" references missing detour outbound "${server.detour}".`,
      );
    }
    if (server.endpoint && !endpointTags.has(server.endpoint)) {
      push(
        diagnostics,
        "error",
        "missing-dns-server-endpoint",
        `/dns/servers/${index}/endpoint`,
        `DNS server "${server.tag}" references missing endpoint "${server.endpoint}".`,
      );
    }
  });

  const looksLikeDomain = (value: unknown) =>
    typeof value === "string" &&
    value.length > 0 &&
    !/^[0-9.]+$/.test(value) &&
    !/^[0-9a-fA-F:]+$/.test(value) &&
    /[a-zA-Z]/.test(value);
  const resolverPresent = (resolver: unknown) =>
    (typeof resolver === "string" && resolver.length > 0) ||
    (resolver !== null && typeof resolver === "object" && resolver !== undefined);

  outbounds.forEach((outbound, index) => {
    if (!looksLikeDomain(outbound.server)) return;
    if (resolverPresent(outbound.domain_resolver)) return;
    const tag = outbound.tag ?? `outbound-${index}`;
    push(
      diagnostics,
      "warning",
      "outbound-domain-without-resolver",
      `/outbounds/${index}/domain_resolver`,
      `Outbound "${tag}" uses a domain server but has no domain_resolver. sing-box 1.14+ requires this; rely on route.default_domain_resolver only if a single DNS server is configured.`,
    );
  });

  listItems(config.dns?.servers).forEach((server, index) => {
    if (!looksLikeDomain(server.server)) return;
    if (resolverPresent(server.domain_resolver)) return;
    push(
      diagnostics,
      "warning",
      "dns-server-domain-without-resolver",
      `/dns/servers/${index}/domain_resolver`,
      `DNS server "${server.tag}" uses a domain remote but has no domain_resolver. sing-box 1.14+ requires this whenever the host is a domain name.`,
    );
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
