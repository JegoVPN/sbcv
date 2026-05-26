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

  const proxyOutboundTypes = new Set([
    "socks",
    "http",
    "shadowsocks",
    "vmess",
    "trojan",
    "naive",
    "hysteria",
    "shadowtls",
    "vless",
    "tuic",
    "hysteria2",
    "anytls",
    "ssh",
  ]);
  const tlsRequiredOutboundTypes = new Set([
    "trojan",
    "naive",
    "hysteria",
    "hysteria2",
    "tuic",
    "anytls",
    "shadowtls",
  ]);
  const tlsRequiredInboundTypes = new Set([
    "trojan",
    "naive",
    "hysteria",
    "hysteria2",
    "tuic",
    "anytls",
  ]);

  outbounds.forEach((outbound, index) => {
    const tag = outbound.tag ?? `outbound-${index}`;
    if (proxyOutboundTypes.has(outbound.type)) {
      if (!outbound.server || (typeof outbound.server === "string" && outbound.server.length === 0)) {
        push(
          diagnostics,
          "error",
          "outbound-missing-server",
          `/outbounds/${index}/server`,
          `Outbound "${tag}" of type ${outbound.type} requires a server address.`,
        );
      }
      const port = outbound.server_port;
      if (typeof port !== "number" || !Number.isFinite(port) || port <= 0 || port > 65535) {
        push(
          diagnostics,
          "error",
          "outbound-invalid-server-port",
          `/outbounds/${index}/server_port`,
          `Outbound "${tag}" of type ${outbound.type} requires a numeric server_port between 1 and 65535.`,
        );
      }
    }
    if (tlsRequiredOutboundTypes.has(outbound.type)) {
      const tls = (outbound as Record<string, unknown>).tls;
      const enabled =
        tls && typeof tls === "object" && !Array.isArray(tls)
          ? Boolean((tls as Record<string, unknown>).enabled)
          : false;
      if (!enabled) {
        push(
          diagnostics,
          "error",
          "outbound-missing-tls",
          `/outbounds/${index}/tls`,
          `Outbound "${tag}" of type ${outbound.type} requires tls.enabled=true; sing-box will refuse to start otherwise.`,
        );
      }
    }
  });

  listItems(config.inbounds).forEach((inbound, index) => {
    if (!tlsRequiredInboundTypes.has(inbound.type)) return;
    const tls = (inbound as Record<string, unknown>).tls;
    const enabled =
      tls && typeof tls === "object" && !Array.isArray(tls)
        ? Boolean((tls as Record<string, unknown>).enabled)
        : false;
    if (!enabled) {
      const tag = inbound.tag ?? `inbound-${index}`;
      push(
        diagnostics,
        "error",
        "inbound-missing-tls",
        `/inbounds/${index}/tls`,
        `Inbound "${tag}" of type ${inbound.type} requires tls.enabled=true; sing-box will refuse to start otherwise.`,
      );
    }
  });

  outbounds.forEach((outbound, index) => {
    if (outbound.type !== "selector" && outbound.type !== "urltest") return;
    const candidates = Array.isArray(outbound.outbounds) ? outbound.outbounds : [];
    const tag = outbound.tag ?? `outbound-${index}`;
    if (candidates.length === 0) {
      push(
        diagnostics,
        "warning",
        "group-outbound-empty",
        `/outbounds/${index}/outbounds`,
        `${outbound.type} group "${tag}" has no candidates; sing-box will reject it.`,
      );
    }
    if (outbound.type === "selector" && typeof outbound.default === "string" && outbound.default.length > 0) {
      if (!candidates.includes(outbound.default)) {
        push(
          diagnostics,
          "error",
          "selector-default-not-in-candidates",
          `/outbounds/${index}/default`,
          `Selector "${tag}" default "${outbound.default}" is not in its candidates list.`,
        );
      }
    }
  });

  const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const validateVmessLikeUsers = (
    pathPrefix: string,
    items: Record<string, unknown>[] | undefined,
    ownerTag: string,
    requireUuid: boolean,
  ) => {
    if (!Array.isArray(items)) return;
    items.forEach((user, userIndex) => {
      if (requireUuid) {
        const uuid = typeof user.uuid === "string" ? user.uuid : "";
        if (!uuid) {
          push(
            diagnostics,
            "error",
            "user-missing-uuid",
            `${pathPrefix}/${userIndex}/uuid`,
            `${ownerTag} user ${userIndex + 1} has no uuid.`,
          );
        } else if (!uuidPattern.test(uuid)) {
          push(
            diagnostics,
            "warning",
            "user-invalid-uuid",
            `${pathPrefix}/${userIndex}/uuid`,
            `${ownerTag} user ${userIndex + 1} uuid "${uuid}" does not match the canonical UUID format.`,
          );
        }
      }
      if (typeof user.alterId === "number" && user.alterId > 0) {
        push(
          diagnostics,
          "warning",
          "vmess-alterid-deprecated",
          `${pathPrefix}/${userIndex}/alterId`,
          `${ownerTag} user ${userIndex + 1} uses alterId=${user.alterId}; the legacy MD5 (alter_id > 0) auth mode is deprecated, prefer alterId: 0.`,
        );
      }
    });
  };

  outbounds.forEach((outbound, index) => {
    const tag = outbound.tag ?? `outbound-${index}`;
    if (outbound.type === "vmess") {
      const uuid = typeof outbound.uuid === "string" ? outbound.uuid : "";
      if (!uuid) {
        push(
          diagnostics,
          "error",
          "vmess-missing-uuid",
          `/outbounds/${index}/uuid`,
          `Outbound "${tag}" (vmess) requires a uuid.`,
        );
      } else if (!uuidPattern.test(uuid)) {
        push(
          diagnostics,
          "warning",
          "vmess-invalid-uuid",
          `/outbounds/${index}/uuid`,
          `Outbound "${tag}" (vmess) uuid "${uuid}" does not match the canonical UUID format.`,
        );
      }
      if (typeof outbound.alter_id === "number" && outbound.alter_id > 0) {
        push(
          diagnostics,
          "warning",
          "vmess-alterid-deprecated",
          `/outbounds/${index}/alter_id`,
          `Outbound "${tag}" (vmess) uses alter_id=${outbound.alter_id}; legacy MD5 auth mode is deprecated, prefer alter_id: 0.`,
        );
      }
    }
    if (outbound.type === "vless") {
      const uuid = typeof outbound.uuid === "string" ? outbound.uuid : "";
      if (!uuid) {
        push(diagnostics, "error", "vless-missing-uuid", `/outbounds/${index}/uuid`, `Outbound "${tag}" (vless) requires a uuid.`);
      } else if (!uuidPattern.test(uuid)) {
        push(diagnostics, "warning", "vless-invalid-uuid", `/outbounds/${index}/uuid`, `Outbound "${tag}" (vless) uuid "${uuid}" does not match the canonical UUID format.`);
      }
      const flow = typeof outbound.flow === "string" ? outbound.flow : "";
      const multiplex = (outbound as Record<string, unknown>).multiplex;
      const multiplexEnabled =
        multiplex && typeof multiplex === "object" && !Array.isArray(multiplex)
          ? Boolean((multiplex as Record<string, unknown>).enabled)
          : false;
      if (flow === "xtls-rprx-vision" && multiplexEnabled) {
        push(
          diagnostics,
          "error",
          "vless-flow-multiplex-conflict",
          `/outbounds/${index}/flow`,
          `Outbound "${tag}" enables both flow=xtls-rprx-vision and multiplex; the two are mutually exclusive.`,
        );
      }
      const tls = (outbound as Record<string, unknown>).tls;
      const tlsEnabled =
        tls && typeof tls === "object" && !Array.isArray(tls)
          ? Boolean((tls as Record<string, unknown>).enabled)
          : false;
      if (flow === "xtls-rprx-vision" && !tlsEnabled) {
        push(
          diagnostics,
          "error",
          "vless-flow-requires-tls",
          `/outbounds/${index}/flow`,
          `Outbound "${tag}" enables flow=xtls-rprx-vision but tls.enabled is not true; xtls-rprx-vision requires TLS.`,
        );
      }
    }
    if (channel === "stable" && outbound.type === "hysteria2") {
      const obj = outbound as Record<string, unknown>;
      if (obj.realm !== undefined) {
        push(
          diagnostics,
          "warning",
          "hysteria2-realm-testing-only",
          `/outbounds/${index}/realm`,
          `Outbound "${tag}" (hysteria2) sets realm; the realm rendezvous field is testing-only (sing-box 1.14+) and will be rejected by stable builds.`,
        );
      }
      if (obj.bbr_profile !== undefined) {
        push(
          diagnostics,
          "warning",
          "hysteria2-bbr-profile-testing-only",
          `/outbounds/${index}/bbr_profile`,
          `Outbound "${tag}" (hysteria2) sets bbr_profile; this BBR tuning field is testing-only (sing-box 1.14+).`,
        );
      }
      if (obj.hop_interval_max !== undefined) {
        push(
          diagnostics,
          "warning",
          "hysteria2-hop-interval-max-testing-only",
          `/outbounds/${index}/hop_interval_max`,
          `Outbound "${tag}" (hysteria2) sets hop_interval_max; this randomization field is testing-only (sing-box 1.14+).`,
        );
      }
    }
    const tls = (outbound as Record<string, unknown>).tls;
    if (tls && typeof tls === "object" && !Array.isArray(tls)) {
      const reality = (tls as Record<string, unknown>).reality;
      if (reality && typeof reality === "object" && !Array.isArray(reality)) {
        const realityObj = reality as Record<string, unknown>;
        if (realityObj.enabled === true) {
          const publicKey = typeof realityObj.public_key === "string" ? realityObj.public_key.trim() : "";
          const shortId = typeof realityObj.short_id === "string" ? realityObj.short_id.trim() : "";
          if (!publicKey) {
            push(
              diagnostics,
              "error",
              "reality-public-key-missing",
              `/outbounds/${index}/tls/reality/public_key`,
              `Outbound "${tag}" enables tls.reality but public_key is empty; required to negotiate the Reality handshake.`,
            );
          }
          if (!shortId) {
            push(
              diagnostics,
              "error",
              "reality-short-id-missing",
              `/outbounds/${index}/tls/reality/short_id`,
              `Outbound "${tag}" enables tls.reality but short_id is empty; required to match the server's allowed short_ids.`,
            );
          } else if (!/^[0-9a-fA-F]{0,8}$/.test(shortId)) {
            push(
              diagnostics,
              "warning",
              "reality-short-id-invalid",
              `/outbounds/${index}/tls/reality/short_id`,
              `Outbound "${tag}" tls.reality.short_id "${shortId}" is not a 0–8 character hex string.`,
            );
          }
        }
      }
    }
  });

  listItems(config.inbounds).forEach((inbound, index) => {
    if (inbound.type === "vmess") {
      validateVmessLikeUsers(
        `/inbounds/${index}/users`,
        inbound.users as Record<string, unknown>[] | undefined,
        `Inbound "${inbound.tag ?? `inbound-${index}`}" (vmess)`,
        true,
      );
    }
    if (inbound.type === "vless") {
      validateVmessLikeUsers(
        `/inbounds/${index}/users`,
        inbound.users as Record<string, unknown>[] | undefined,
        `Inbound "${inbound.tag ?? `inbound-${index}`}" (vless)`,
        true,
      );
    }
    if (inbound.type === "tuic") {
      validateVmessLikeUsers(
        `/inbounds/${index}/users`,
        inbound.users as Record<string, unknown>[] | undefined,
        `Inbound "${inbound.tag ?? `inbound-${index}`}" (tuic)`,
        true,
      );
    }
    if (channel === "stable" && inbound.type === "tun") {
      const obj = inbound as Record<string, unknown>;
      if (obj.dns_mode !== undefined) {
        push(
          diagnostics,
          "warning",
          "tun-dns-mode-testing-only",
          `/inbounds/${index}/dns_mode`,
          `Inbound "${inbound.tag ?? `inbound-${index}`}" (tun) sets dns_mode; this field is testing-only (sing-box 1.14+).`,
        );
      }
      if (obj.dns_address !== undefined) {
        push(
          diagnostics,
          "warning",
          "tun-dns-address-testing-only",
          `/inbounds/${index}/dns_address`,
          `Inbound "${inbound.tag ?? `inbound-${index}`}" (tun) sets dns_address; this field is testing-only (sing-box 1.14+).`,
        );
      }
      if (obj.include_mac_address !== undefined || obj.exclude_mac_address !== undefined) {
        push(
          diagnostics,
          "warning",
          "tun-mac-address-filter-testing-only",
          `/inbounds/${index}`,
          `Inbound "${inbound.tag ?? `inbound-${index}`}" (tun) uses MAC address filtering; this field is testing-only (sing-box 1.14+, Linux only).`,
        );
      }
    }
    const tls = (inbound as Record<string, unknown>).tls;
    if (tls && typeof tls === "object" && !Array.isArray(tls)) {
      const reality = (tls as Record<string, unknown>).reality;
      if (reality && typeof reality === "object" && !Array.isArray(reality)) {
        const realityObj = reality as Record<string, unknown>;
        if (realityObj.enabled === true) {
          const privateKey = typeof realityObj.private_key === "string" ? realityObj.private_key.trim() : "";
          if (!privateKey) {
            push(
              diagnostics,
              "error",
              "reality-private-key-missing",
              `/inbounds/${index}/tls/reality/private_key`,
              `Inbound "${inbound.tag ?? `inbound-${index}`}" enables tls.reality but private_key is empty; required for the server-side Reality handshake.`,
            );
          }
          const handshake = realityObj.handshake;
          if (!(handshake && typeof handshake === "object" && !Array.isArray(handshake) && (handshake as Record<string, unknown>).server)) {
            push(
              diagnostics,
              "error",
              "reality-handshake-server-missing",
              `/inbounds/${index}/tls/reality/handshake/server`,
              `Inbound "${inbound.tag ?? `inbound-${index}`}" enables tls.reality but handshake.server is empty; required to define the fallback origin.`,
            );
          }
        }
      }
    }
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

  const experimental = config.experimental;
  if (experimental && typeof experimental === "object" && !Array.isArray(experimental)) {
    const clashApi = (experimental as Record<string, unknown>).clash_api;
    if (clashApi && typeof clashApi === "object" && !Array.isArray(clashApi)) {
      const detour = (clashApi as Record<string, unknown>).external_ui_download_detour;
      if (typeof detour === "string" && detour.length > 0 && !outboundTags.has(detour)) {
        push(
          diagnostics,
          "error",
          "clash-api-download-detour-missing",
          "/experimental/clash_api/external_ui_download_detour",
          `experimental.clash_api.external_ui_download_detour references missing outbound "${detour}".`,
        );
      }
      const controller = (clashApi as Record<string, unknown>).external_controller;
      const secret = (clashApi as Record<string, unknown>).secret;
      if (
        typeof controller === "string" &&
        controller.length > 0 &&
        (controller.startsWith("0.0.0.0") || controller.startsWith("[::]")) &&
        (typeof secret !== "string" || secret.length === 0)
      ) {
        push(
          diagnostics,
          "warning",
          "clash-api-public-listen-without-secret",
          "/experimental/clash_api/secret",
          "Clash API binds to a public address but no secret is set. Any client on the network can control sing-box.",
        );
      }
    }
  }

  listItems(config.route?.rule_set).forEach((ruleSet, index) => {
    const tag = typeof ruleSet.tag === "string" ? ruleSet.tag : `rule-set-${index}`;
    const type = typeof ruleSet.type === "string" ? ruleSet.type : undefined;
    if (type === "remote") {
      const url = typeof ruleSet.url === "string" ? ruleSet.url : "";
      if (!url) {
        push(
          diagnostics,
          "error",
          "rule-set-remote-missing-url",
          `/route/rule_set/${index}/url`,
          `Remote rule-set "${tag}" has no url; the resource cannot be downloaded.`,
        );
      }
      const detour = typeof ruleSet.download_detour === "string" ? ruleSet.download_detour : "";
      if (detour && !outboundTags.has(detour)) {
        push(
          diagnostics,
          "error",
          "rule-set-download-detour-missing",
          `/route/rule_set/${index}/download_detour`,
          `Remote rule-set "${tag}" references missing download_detour outbound "${detour}".`,
        );
      }
      if (detour && channel === "testing") {
        push(
          diagnostics,
          "warning",
          "rule-set-download-detour-deprecated",
          `/route/rule_set/${index}/download_detour`,
          `Remote rule-set "${tag}" uses download_detour, which is deprecated in sing-box 1.14+ in favour of http_client. Consider migrating before the field is removed.`,
        );
      }
    }
    if (type === "local") {
      const path = typeof ruleSet.path === "string" ? ruleSet.path : "";
      if (!path) {
        push(
          diagnostics,
          "error",
          "rule-set-local-missing-path",
          `/route/rule_set/${index}/path`,
          `Local rule-set "${tag}" has no path; sing-box will refuse to load it.`,
        );
      }
    }
    if (type === "inline") {
      const rules = Array.isArray(ruleSet.rules) ? ruleSet.rules : [];
      if (rules.length === 0) {
        push(
          diagnostics,
          "warning",
          "rule-set-inline-empty",
          `/route/rule_set/${index}/rules`,
          `Inline rule-set "${tag}" has an empty rules array; it will match nothing.`,
        );
      }
    }
  });

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
