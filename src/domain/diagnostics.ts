import { buildNamespacedTagIndex, getDnsServerTags, getEndpointTags, getHttpClientTags, getInboundTags, getOutboundTags, getRuleSetTags } from "./indexes";
import { knownFieldsFor } from "./knownFieldsRegistry";
import { typeMinVersion } from "./minVersions";
import {
  fieldMetaFor,
  proxyOutboundTypes as proxyOutboundTypeSet,
  requiredFieldsFor,
  tlsRequiredTypes,
  type SchemaEntityKind,
  type SchemaEnumOption,
  type SchemaFieldMeta,
} from "./schemaRegistry";
import { atLeast, defaultVersionForChannel } from "./targets";
import type { Diagnostic, SingBoxChannel, SingBoxConfig } from "./types";
import { testingOnlyFields } from "./versionFieldGate";

// VT3 — the data-driven testing-only field backstop. For each typed entity, any top-level field that is
// 1.14-only (present on testing's per-(kind,type) doc set but not stable's; see versionFieldGate) is an
// export-blocking error on a stable target. Deduped by path so the friendlier hand-written gates (W8 / VT1)
// own the message where they exist. U14 — scope: this closed set covers top-level fields on the seven
// ARRAY-COLLECTION kinds listed below. Singleton owners (dns / route / experimental / log) and nested
// (under-object) fields are NOT covered here — those are hand-gated case by case (e.g. dns.optimistic,
// route.default_http_client, the rule-set download_detour escalation above).
const VERSION_GATE_SECTIONS: Array<{ kind: string; get: (c: SingBoxConfig) => unknown[]; path: (i: number) => string }> = [
  { kind: "inbound", get: (c) => c.inbounds ?? [], path: (i) => `/inbounds/${i}` },
  { kind: "outbound", get: (c) => c.outbounds ?? [], path: (i) => `/outbounds/${i}` },
  { kind: "endpoint", get: (c) => c.endpoints ?? [], path: (i) => `/endpoints/${i}` },
  { kind: "dns-server", get: (c) => c.dns?.servers ?? [], path: (i) => `/dns/servers/${i}` },
  { kind: "service", get: (c) => c.services ?? [], path: (i) => `/services/${i}` },
  { kind: "rule-set", get: (c) => c.route?.rule_set ?? [], path: (i) => `/route/rule_set/${i}` },
  { kind: "certificate-provider", get: (c) => c.certificate_providers ?? [], path: (i) => `/certificate_providers/${i}` },
];

function checkTestingOnlyFields(config: SingBoxConfig, channel: SingBoxChannel, diagnostics: Diagnostic[]) {
  if (channel !== "stable") return; // stable = the <1.14 targets; testing (1.14) accepts these fields
  // Dedup only against existing ERROR-level diagnostics: a hand gate (W8 / VT1) that already export-blocks
  // this exact path owns the friendlier message. A pre-existing WARNING (e.g. an older, too-weak gate) is
  // not export-blocking, so VT3 must still add its error — these fields are binary-rejected by stable.
  const flagged = new Set(diagnostics.filter((d) => d.level === "error").map((d) => d.path));
  for (const section of VERSION_GATE_SECTIONS) {
    section.get(config).forEach((entity, index) => {
      if (!entity || typeof entity !== "object") return;
      const obj = entity as Record<string, unknown>;
      const onlyTesting = testingOnlyFields(section.kind, obj.type);
      if (onlyTesting.size === 0) return;
      const base = section.path(index);
      for (const field of Object.keys(obj)) {
        if (!onlyTesting.has(field)) continue;
        const path = `${base}/${field}`;
        if (flagged.has(path)) continue; // a hand gate already owns this path with a friendlier message
        const tag = typeof obj.tag === "string" ? obj.tag : `${section.kind}-${index}`;
        push(
          diagnostics,
          "error",
          "field-testing-only",
          path,
          `${section.kind} "${tag}" (${String(obj.type)}) sets "${field}", a testing-only field (sing-box 1.14+) that stable builds reject at decode.`,
        );
        flagged.add(path);
      }
    });
  }
}

/** Active validation target — the channel + resolved version a config is being checked against. */
export interface ValidationTarget {
  channel: SingBoxChannel;
  version: string;
}

function listItems<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

// Pragmatic CIDR validators — catch malformed ranges and wrong-family values (an IPv6 in a v4 field,
// out-of-range octets/prefix) before sing-box rejects them at start. Not a full RFC parser.
function isIpv4Cidr(value: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,3})$/.exec(value.trim());
  if (!match) return false;
  const octets = [match[1], match[2], match[3], match[4]].map((o) => Number(o));
  if (octets.some((o) => o > 255)) return false;
  return Number(match[5]) <= 32;
}
function isIpv6Cidr(value: string): boolean {
  const slash = value.trim().split("/");
  if (slash.length !== 2) return false;
  const [addr, prefixText] = slash;
  if (addr === undefined || prefixText === undefined) return false;
  const prefix = Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) return false;
  if (!addr.includes(":")) return false;
  // Reject anything that isn't hex groups + at most one "::" compression.
  if (/[^0-9a-fA-F:]/.test(addr)) return false;
  if ((addr.match(/::/g) ?? []).length > 1) return false;
  const groups = addr.split(":").filter((g) => g !== "");
  if (groups.length > 8) return false;
  return groups.every((g) => g.length <= 4);
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

// W8 (M2): the shared QUIC tuning block is sing-box 1.14+ (testing/.../shared/quic.md "Since 1.14.0";
// stable has no such file). Binary-verified: sing-box-1.13 FATAL-rejects each key ("unknown field
// initial_packet_size" …) on hysteria / hysteria2 / tuic (the only types carrying the `quic` shared
// group). Previously rendered with no channel gate AND no diagnostic — an invalid config exported clean
// on the default stable target. These are errors on a stable (<1.14) target so the V2 export hard gate
// blocks them, matching the V4-S1 testing-only-section policy.
const QUIC_SHARED_TUNING_FIELDS = ["initial_packet_size", "disable_path_mtu_discovery", "idle_timeout", "keep_alive_period"];
const QUIC_GROUP_TYPES = new Set(["hysteria", "hysteria2", "tuic"]);
function checkQuic114Fields(
  diagnostics: Diagnostic[],
  channel: SingBoxChannel,
  type: unknown,
  obj: Record<string, unknown>,
  pathPrefix: string,
  label: string,
) {
  if (channel === "testing" || typeof type !== "string" || !QUIC_GROUP_TYPES.has(type)) return;
  for (const key of QUIC_SHARED_TUNING_FIELDS) {
    if (obj[key] !== undefined) {
      push(
        diagnostics,
        "error",
        "quic-shared-field-testing-only",
        `${pathPrefix}/${key}`,
        `${label} (${type}) sets ${key}; the QUIC tuning block is sing-box 1.14+ and stable builds reject it ("unknown field "${key}"").`,
      );
    }
  }
}

// ── V1: enum / type validation (data-driven from schemaRegistry field metadata) ──────────────────────

function getAtPath(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** Whether an enum value is allowed for the active (channel, version) target. */
function enumOptionActive(option: SchemaEnumOption, target: ValidationTarget): boolean {
  if (option.channel && option.channel !== target.channel) return false;
  if (option.since && !atLeast(target.version, option.since)) return false;
  if (option.until && atLeast(target.version, option.until)) return false;
  return true;
}

/**
 * Validate a single scalar field value against its schema metadata for the active target. Returns the
 * offending diagnostic (code + message) or null when the value is fine. Unset (undefined/null/"") is
 * always fine — a missing optional field is not an error. Exported for direct unit coverage.
 */
export function validateFieldMeta(
  meta: SchemaFieldMeta,
  value: unknown,
  target: ValidationTarget,
): { code: "enum-invalid" | "type-invalid" | "version-invalid"; message: string } | null {
  if (value === undefined || value === null || value === "") return null;
  const fieldName = meta.path.join(".");

  // W3 (M4): a field whose own `since`/`channel` outranks the target is rejected by that binary even
  // when its value is otherwise valid (e.g. naive inbound `quic_congestion_control`, since 1.13, on a
  // 1.12 Legacy target). The per-OPTION gate below only covers enum VALUES; this covers the FIELD itself.
  if (meta.since && !atLeast(target.version, meta.since)) {
    return {
      code: "version-invalid",
      message: `${fieldName} requires sing-box ${meta.since}+, but the target is ${target.channel} ${target.version}. sing-box ${target.version} rejects it.`,
    };
  }
  if (meta.channel && meta.channel !== target.channel) {
    return {
      code: "version-invalid",
      message: `${fieldName} requires the ${meta.channel} channel, but the target is ${target.channel}.`,
    };
  }

  if (meta.type === "enum") {
    const options = meta.enum ?? [];
    const text = String(value);
    const matched = options.find((option) => option.value === text);
    if (matched && enumOptionActive(matched, target)) return null;
    if (matched) {
      // Known value, but gated off the active target (e.g. hysteria2 obfs "gecko" is testing/1.14).
      const need = matched.channel ? `the ${matched.channel} channel` : `sing-box ${matched.since}+`;
      const sinceNote = matched.channel && matched.since ? ` (since ${matched.since})` : "";
      return {
        code: "enum-invalid",
        message: `${fieldName} value "${text}" requires ${need}${sinceNote}, but the target is ${target.channel} ${target.version}.`,
      };
    }
    const allowed = options.filter((option) => enumOptionActive(option, target)).map((option) => option.value);
    return {
      code: "enum-invalid",
      message: `${fieldName} value "${text}" is not valid. Expected one of: ${allowed.join(", ")}.`,
    };
  }

  const actual = typeof value;
  const typeOk =
    (meta.type === "number" && actual === "number" && Number.isFinite(value as number)) ||
    (meta.type === "boolean" && actual === "boolean") ||
    (meta.type === "string" && actual === "string");
  if (typeOk) return null;
  return { code: "type-invalid", message: `${fieldName} must be a ${meta.type}, got ${actual}.` };
}

/**
 * Per-entity scalar enum/type validation over every typed collection (feeds V2's export hard gate; the
 * errors are already live in the existing export prompt + node badges, not just V2). Today only
 * inbound/outbound rows define `fields`, so the dns-server/endpoint/service/rule-set passes (and the
 * dns-server `legacyType` fallback) are deliberate no-ops, ready for future field metadata.
 */
function validateScalarFields(
  config: SingBoxConfig,
  diagnostics: Diagnostic[],
  target: ValidationTarget,
): void {
  const collections: Array<{ kind: SchemaEntityKind; items: unknown[]; collection: string; legacyType?: string }> = [
    { kind: "inbound", items: listItems(config.inbounds), collection: "inbounds" },
    { kind: "outbound", items: listItems(config.outbounds), collection: "outbounds" },
    { kind: "dns-server", items: listItems(config.dns?.servers), collection: "dns/servers", legacyType: "legacy" },
    { kind: "endpoint", items: listItems(config.endpoints), collection: "endpoints" },
    { kind: "service", items: listItems(config.services), collection: "services" },
    { kind: "rule-set", items: listItems(config.route?.rule_set), collection: "route/rule_set" },
  ];
  for (const { kind, items, collection, legacyType } of collections) {
    items.forEach((entity, index) => {
      const rawType = (entity as { type?: unknown }).type;
      const type = typeof rawType === "string" ? rawType : legacyType;
      if (!type) return;
      for (const meta of fieldMetaFor(kind, type)) {
        const result = validateFieldMeta(meta, getAtPath(entity, meta.path), target);
        if (result) {
          push(diagnostics, "error", result.code, `/${collection}/${index}/${meta.path.join("/")}`, result.message);
        }
      }
      // W1 (M3): declarative required scalar fields (credentials etc.) — a config missing one passes a
      // shape-only lint but the binary rejects it (binary-verified: shadowsocks method+password, tuic uuid).
      // GUI factories always seed them, so this bites imported / cleared entities. cloudflared.token keeps
      // its bespoke check (nicer message + 1.14 gate), so skip it here to avoid a double diagnostic.
      if (!(kind === "inbound" && type === "cloudflared")) {
        const tag = (entity as { tag?: unknown }).tag;
        const owner = `${kind[0]!.toUpperCase()}${kind.slice(1)} "${typeof tag === "string" && tag ? tag : `${kind}-${index}`}"`;
        for (const field of requiredFieldsFor(kind, type)) {
          const value = getAtPath(entity, [field]);
          if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
            push(
              diagnostics,
              "error",
              "missing-required-field",
              `/${collection}/${index}/${field}`,
              `${owner} of type ${type} requires \`${field}\`.`,
            );
          }
        }
      }
      // W9 (serialization → strong): unknown-field linter. A top-level key that is not a sing-box field
      // for this (kind, type) on ANY channel is rejected by the strict decoder ("unknown field"). The
      // heuristic linter previously missed these (typos, Clash.Meta filter/providers/use_all_providers,
      // Xray streamSettings/mux/settings, removed legacy fields), so a structurally-fine config exported
      // clean yet the binary FATAL-rejected it. Allowlist = upstream docs (both channels) ∪ shared groups
      // ∪ a binary-verified supplement (knownFieldsRegistry); only entities with a real string type are
      // linted (typeless legacy forms are caught by their own diagnostic). Validated zero-false-positive
      // against the binary-valid fixtures + real configs.
      if (typeof rawType === "string" && rawType && entity && typeof entity === "object") {
        const known = knownFieldsFor(kind, rawType);
        if (known) {
          const tag = (entity as { tag?: unknown }).tag;
          const owner = `${kind[0]!.toUpperCase()}${kind.slice(1)} "${typeof tag === "string" && tag ? tag : `${kind}-${index}`}"`;
          for (const key of Object.keys(entity as Record<string, unknown>)) {
            if (!known.has(key)) {
              push(
                diagnostics,
                "error",
                "unknown-field",
                `/${collection}/${index}/${key}`,
                `${owner} (${rawType}) has unrecognized field \`${key}\` — sing-box's strict decoder rejects it ("unknown field"). Remove it, or it may belong under a nested object.`,
              );
            }
          }
        }
      }
    });
  }
}

/**
 * A tag is "present" only if it's a non-empty, non-whitespace string. (Intentionally one notch stricter
 * than sing-box's decoder, which accepts a whitespace-only tag: such a tag is unreferenceable garbage,
 * and import dedup self-heals it. Matches getUniqueTag/taggedNodeId blank-handling elsewhere.)
 */
function tagIsBlank(tag: unknown): boolean {
  return typeof tag !== "string" || tag.trim() === "";
}

/**
 * V3: entity-missing-tag. `sing-box check` rejects a MISSING tag only for `route.rule_set[]`
 * ("missing tag") and `http_clients[]` ("missing http client tag") — verified against the real binary.
 * Tagless inbounds/outbounds/dns-servers/endpoints/certificate-providers are ACCEPTED by sing-box (and
 * common in real-world configs), so flagging them would block a valid export and break the done-bar
 * ("保证能过 sing-box check"). The error is therefore scoped to exactly the two kinds sing-box rejects,
 * and feeds the V2 export hard gate. (GUI create/rename never produces a blank tag — getUniqueTag — so
 * this bites imported / hand-edited JSON, and import dedup auto-repairs it.)
 */
function validateRequiredTags(config: SingBoxConfig, diagnostics: Diagnostic[]): void {
  const required: Array<{ items: unknown[]; collection: string; label: string }> = [
    { items: listItems(config.route?.rule_set), collection: "route/rule_set", label: "Rule-set" },
    { items: listItems(config.http_clients), collection: "http_clients", label: "HTTP client" },
  ];
  for (const { items, collection, label } of required) {
    items.forEach((entity, index) => {
      if (tagIsBlank((entity as { tag?: unknown }).tag)) {
        push(
          diagnostics,
          "error",
          "entity-missing-tag",
          `/${collection}/${index}/tag`,
          `${label} at index ${index} is missing a tag; sing-box requires a tag here.`,
        );
      }
    });
  }
}

export function validateConfig(
  config: SingBoxConfig,
  channel: SingBoxChannel,
  version: string = defaultVersionForChannel(channel),
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  // Namespaced: a tag reused across distinct reference namespaces (inbound vs outbound) never collides
  // at runtime, so only same-namespace duplicates are flagged. Per-ref path emission is unchanged. (C9)
  const tagIndex = buildNamespacedTagIndex(config);

  for (const [, refs] of tagIndex) {
    if (refs.length > 1) {
      const tag = refs[0]!.tag;
      refs.forEach((ref) => {
        push(
          diagnostics,
          "error",
          "duplicate-tag",
          `${ref.path}/tag`,
          `Tag "${tag}" is used by ${refs.length} entities.`,
        );
      });
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
        // A2 (long-chain audit): warning, not error. The inbound matcher does not participate in the
        // router-init reference graph — `check` exits 0 and `run` starts cleanly on 1.12/1.13/1.14; the
        // rule simply never matches. A typo worth flagging, but it does not block a runnable export.
        push(
          diagnostics,
          "warning",
          "missing-route-rule-inbound",
          `/route/rules/${index}/inbound`,
          `Route rule ${index + 1} references missing inbound "${tag}" — the rule will never match. Fix the tag or remove the inbound matcher.`,
        );
      }
    });
    if (rule.outbound && !outboundTags.has(rule.outbound)) {
      // A1 (long-chain audit): warning, not error. `check` does not resolve route-rule outbound refs and
      // `run` starts cleanly on all of 1.12/1.13/1.14 — the rule simply never matches (the route silently
      // fails over to route.final). Almost always a typo worth flagging, but it does not block a runnable
      // export. (Contrast route.final, which IS run-FATAL "default outbound not found" — stays an error.)
      push(
        diagnostics,
        "warning",
        "missing-rule-outbound",
        `/route/rules/${index}/outbound`,
        `Route rule ${index + 1} references missing outbound "${rule.outbound}" — the rule will never match (it silently falls through to route.final). Fix the tag or remove the rule.`,
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
    // 1.13-added route-rule features — warn on a pre-1.13 target. (C7-C: rule_action.md bypass Since
    // 1.13.0; rule.md interface_address / network_interface_address / default_interface_address Since 1.13.0)
    if (!atLeast(version, "1.13")) {
      const ruleObj = rule as Record<string, unknown>;
      if (ruleObj.action === "bypass") {
        push(diagnostics, "error", "route-rule-bypass-1-13-only", `/route/rules/${index}/action`, `Route rule ${index + 1} uses action "bypass", which is sing-box 1.13+; ${version} rejects it ("unknown rule action: bypass").`);
      }
      if (ruleObj.interface_address !== undefined || ruleObj.network_interface_address !== undefined || ruleObj.default_interface_address !== undefined) {
        push(diagnostics, "error", "route-rule-interface-address-1-13-only", `/route/rules/${index}`, `Route rule ${index + 1} sets interface_address / network_interface_address / default_interface_address, which are sing-box 1.13+; ${version} rejects them ("unknown field").`);
      }
    }
    // 1.14-added route-options features — error on a pre-1.14 target (route/rule_action.md tls_spoof /
    // tls_spoof_method Since 1.14.0). Like the dns-rule-action-1-14-only / route-rule-bypass gates, an
    // unknown field hard-blocks decode, so this is an error rather than an advisory.
    if (!atLeast(version, "1.14")) {
      const ruleObj = rule as Record<string, unknown>;
      if (ruleObj.tls_spoof !== undefined || ruleObj.tls_spoof_method !== undefined) {
        push(diagnostics, "error", "route-rule-tls-spoof-1-14-only", `/route/rules/${index}`, `Route rule ${index + 1} sets tls_spoof / tls_spoof_method, which are sing-box 1.14+; ${version} rejects them ("unknown field").`);
      }
    }
  });

  // U11 — an inline http_client object (as opposed to a tag ref into http_clients[]) supports only a
  // limited field set (shared/http-client.md:48-74). Unsupported keys are silently ignored by the
  // HTTP Client adapter, so the config does not behave as written — warn. Channel-invariant.
  const HTTP_CLIENT_UNSUPPORTED_TOP = [
    "version", "disable_version_fallback",
    // HTTP2 Fields (http2.md) + QUIC Fields (quic.md) are inlined at the top level and unsupported.
    "idle_timeout", "keep_alive_period", "stream_receive_window", "connection_receive_window",
    "max_concurrent_streams", "initial_packet_size", "disable_path_mtu_discovery",
  ];
  const HTTP_CLIENT_UNSUPPORTED_TLS = [
    "engine", "alpn", "disable_sni", "cipher_suites", "curve_preferences",
    "client_certificate", "client_certificate_path", "client_key", "client_key_path",
    "fragment", "record_fragment", "kernel_tx", "kernel_rx", "ech", "utls", "reality",
  ];
  const checkHttpClientObject = (raw: unknown, pointer: string, label: string) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const obj = raw as Record<string, unknown>;
    const bad: string[] = [];
    for (const key of HTTP_CLIENT_UNSUPPORTED_TOP) if (obj[key] !== undefined) bad.push(key);
    const tls = obj.tls;
    if (tls && typeof tls === "object" && !Array.isArray(tls)) {
      const tlsObj = tls as Record<string, unknown>;
      for (const key of HTTP_CLIENT_UNSUPPORTED_TLS) if (tlsObj[key] !== undefined) bad.push(`tls.${key}`);
    }
    if (bad.length > 0) {
      push(
        diagnostics,
        "warning",
        "http-client-unsupported-field",
        pointer,
        `${label} inline http_client sets fields the HTTP Client adapter does not support (${bad.join(", ")}); they are silently ignored (shared/http-client.md). Use a shared http_clients[] tag for the full TLS/transport feature set.`,
      );
    }
  };
  checkHttpClientObject((config.route as Record<string, unknown> | undefined)?.default_http_client, "/route/default_http_client", "route.default_http_client");
  listItems(config.route?.rule_set).forEach((ruleSet, index) => {
    checkHttpClientObject((ruleSet as Record<string, unknown>).http_client, `/route/rule_set/${index}/http_client`, `Rule-set ${index + 1}`);
  });

  // 1.13-added local DNS prefer_go (dns/server/local.md, Since 1.13.0) — warn on a pre-1.13 target. (C7-C)
  if (!atLeast(version, "1.13")) {
    listItems(config.dns?.servers).forEach((server, index) => {
      const obj = server as Record<string, unknown>;
      if (obj.type === "local" && obj.prefer_go !== undefined) {
        push(diagnostics, "error", "dns-local-prefer-go-1-13-only", `/dns/servers/${index}/prefer_go`, `Local DNS server "${server.tag ?? `dns-server-${index}`}" sets prefer_go, which is sing-box 1.13+; ${version} rejects it ("unknown field").`);
      }
    });
  }

  // W3 (M5): DNS-server TYPE min-version gate, driven by the single-source TYPE_MIN_VERSION (mirrors the
  // naive/ccm/cloudflared type gates). Covers the 1.14-only `mdns` type, previously ungated — an imported
  // mdns server on a 1.12/1.13 target passed clean but the binary rejects it ("unknown dns server type").
  listItems(config.dns?.servers).forEach((server, index) => {
    const type = (server as Record<string, unknown>).type;
    const min = typeof type === "string" ? typeMinVersion("dns-server", type) : undefined;
    if (min && !atLeast(version, min)) {
      push(
        diagnostics,
        "error",
        "dns-server-version",
        `/dns/servers/${index}/type`,
        `DNS server "${server.tag ?? `dns-server-${index}`}" (${type}) requires sing-box ${min}+, but the target is ${version}. sing-box ${version} rejects it.`,
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
    // naive is Since sing-box 1.13.0 (absent in 1.12); a 1.12 binary rejects it. Type min-version comes
    // from the shared minVersions table (same source as the canvas badge). Mirrors ccm/ocm.
    const naiveMin = typeMinVersion("outbound", "naive");
    if (outbound.type === "naive" && naiveMin && !atLeast(version, naiveMin)) {
      push(
        diagnostics,
        "error",
        "outbound-naive-version",
        `/outbounds/${index}/type`,
        `Outbound "${outbound.tag}" (naive) requires sing-box ${naiveMin}+, but the target is ${version}. sing-box ${version} rejects it.`,
      );
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

    const serviceMin = typeMinVersion("service", service.type);
    if ((service.type === "ccm" || service.type === "ocm") && serviceMin && !atLeast(version, serviceMin)) {
      push(
        diagnostics,
        "error",
        "service-ccm-ocm-version",
        `/services/${index}/type`,
        `Service "${service.tag}" (${service.type}) requires sing-box ${serviceMin}+, but the target is ${version}. sing-box ${version} rejects it.`,
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
      const configPath = typeof (service as Record<string, unknown>).config_path === "string"
        ? ((service as Record<string, unknown>).config_path as string).trim()
        : "";
      if (!configPath) {
        push(
          diagnostics,
          "error",
          "derp-config-path-missing",
          `/services/${index}/config_path`,
          `DERP service "${service.tag}" requires config_path; sing-box refuses to start without the server key file.`,
        );
      }
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
      const meshWith = Array.isArray((service as Record<string, unknown>).mesh_with)
        ? ((service as Record<string, unknown>).mesh_with as Record<string, unknown>[])
        : [];
      meshWith.forEach((peer, meshIndex) => {
        if (!peer || typeof peer !== "object") return;
        if (typeof peer.server !== "string" || !peer.server.trim()) {
          push(
            diagnostics,
            "error",
            "derp-mesh-server-missing",
            `/services/${index}/mesh_with/${meshIndex}/server`,
            `DERP service "${service.tag}" mesh peer #${meshIndex + 1} requires a server address.`,
          );
        }
        const meshPort = peer.server_port;
        if (typeof meshPort !== "number" || !Number.isFinite(meshPort) || meshPort <= 0 || meshPort > 65535) {
          push(
            diagnostics,
            "error",
            "derp-mesh-server-port-missing",
            `/services/${index}/mesh_with/${meshIndex}/server_port`,
            `DERP service "${service.tag}" mesh peer #${meshIndex + 1} requires a numeric server_port between 1 and 65535.`,
          );
        }
      });
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
    if (service.type === "hysteria-realm") {
      const obj = service as Record<string, unknown>;
      const users = Array.isArray(obj.users) ? (obj.users as Record<string, unknown>[]) : [];
      if (users.length === 0) {
        push(
          diagnostics,
          "error",
          "hysteria-realm-users-required",
          `/services/${index}/users`,
          `Hysteria Realm service "${service.tag}" requires at least one user; sing-box refuses to start without authorized tokens.`,
        );
      }
      users.forEach((user, userIndex) => {
        if (typeof user.name !== "string" || user.name.trim() === "") {
          push(
            diagnostics,
            "error",
            "hysteria-realm-user-name-required",
            `/services/${index}/users/${userIndex}/name`,
            `Hysteria Realm user #${userIndex + 1} of service "${service.tag}" is missing name.`,
          );
        }
        if (typeof user.token !== "string" || user.token.trim() === "") {
          push(
            diagnostics,
            "error",
            "hysteria-realm-user-token-required",
            `/services/${index}/users/${userIndex}/token`,
            `Hysteria Realm user "${user.name ?? userIndex + 1}" of service "${service.tag}" is missing token.`,
          );
        } else if (user.token === "change-me") {
          push(
            diagnostics,
            "warning",
            "hysteria-realm-user-token-placeholder",
            `/services/${index}/users/${userIndex}/token`,
            `Hysteria Realm user "${user.name ?? userIndex + 1}" of service "${service.tag}" still uses the scaffold placeholder token "change-me"; replace before exposing the service.`,
          );
        }
      });
    }

    if (service.type === "ccm") {
      const obj = service as Record<string, unknown>;
      // Empty `users` is a documented mode — service/ccm.md: "If empty, no authentication is required."
      // So it is NOT flagged (clients are accepted, not rejected). The actual exposure risk — a public
      // listen with no auth — is covered by ccm-public-listen below.
      if (
        typeof obj.listen === "string" &&
        (obj.listen === "0.0.0.0" || obj.listen === "::" || obj.listen === "")
      ) {
        push(
          diagnostics,
          "warning",
          "ccm-public-listen",
          `/services/${index}/listen`,
          `CCM service "${service.tag}" listens on a public address (${obj.listen || "empty"}); bind to 127.0.0.1 or require TLS + auth tokens for exposure.`,
        );
      }
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

  // C0-4: evaluate/respond ordering. `respond` and `match_response` each require a PRECEDING top-level
  // `evaluate` rule (a rule's own evaluate runs after matching, so it does not count for itself).
  let precedingTopLevelEvaluate = false;
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
      // A3 (long-chain audit): warning, not error. `check` does not resolve a dns rule's `server` ref
      // (legacy or `action:"route"` form) and `run` starts cleanly on 1.12/1.13/1.14 — the rule just never
      // matches. A typo worth flagging, but it does not block a runnable export. (NOTE: the dns `rule_set`
      // ref below stays an error — 1.14 `check` DOES resolve it, FATAL "rule-set not found".)
      push(
        diagnostics,
        "warning",
        "missing-dns-rule-server",
        `/dns/rules/${index}/server`,
        `DNS rule ${index + 1} references missing server "${rule.server}" — the rule will never match (it falls through to dns.final). Fix the tag or remove the rule.`,
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
    const ruleObj = rule as Record<string, unknown>;
    if (ruleObj.outbound !== undefined) {
      push(
        diagnostics,
        "warning",
        "dns-rule-outbound-matcher-deprecated",
        `/dns/rules/${index}/outbound`,
        `DNS rule ${index + 1} uses the deprecated \`outbound\` matcher (sing-box 1.12). Migrate to per-outbound \`domain_resolver\` or set \`route.default_domain_resolver\`.`,
      );
    }
    const hasIpCidr = Array.isArray(ruleObj.ip_cidr) && ruleObj.ip_cidr.length > 0;
    const hasIpIsPrivate = ruleObj.ip_is_private !== undefined;
    const matchResponse = ruleObj.match_response === true;
    if ((hasIpCidr || hasIpIsPrivate) && !matchResponse) {
      push(
        diagnostics,
        "warning",
        "dns-rule-legacy-address-filter-deprecated",
        `/dns/rules/${index}`,
        `DNS rule ${index + 1} uses address-filter fields (ip_cidr / ip_is_private) without match_response (sing-box 1.14). Migrate to an \`evaluate\` action + a follow-up rule with \`match_response: true\`.`,
      );
    }
    const hasModernIpField = ruleObj.ip_version !== undefined || ruleObj.query_type !== undefined;
    const hasLegacyIpField =
      (Array.isArray(ruleObj.ip_cidr) && ruleObj.ip_cidr.length > 0) ||
      ruleObj.ip_is_private !== undefined ||
      ruleObj.rule_set_ip_cidr_accept_empty !== undefined;
    if (hasModernIpField && hasLegacyIpField) {
      push(
        diagnostics,
        "error",
        "dns-rule-mixed-legacy-and-modern-conflict",
        `/dns/rules/${index}`,
        `DNS rule ${index + 1} mixes modern (ip_version / query_type) and legacy (ip_cidr / ip_is_private / rule_set_ip_cidr_accept_empty) address fields. sing-box 1.14+ will reject this at startup.`,
      );
    }
    const action = typeof ruleObj.action === "string" ? ruleObj.action : "";
    // V4-S4 / G4: respond/evaluate are sing-box 1.14 DNS rule actions; on a pre-1.14 target sing-box
    // rejects them at decode ("unknown DNS rule action"), so they hard-block export there.
    if (!atLeast(version, "1.14") && (action === "respond" || action === "evaluate")) {
      push(
        diagnostics,
        "error",
        "dns-rule-action-1-14-only",
        `/dns/rules/${index}/action`,
        `DNS rule ${index + 1} uses action "${action}", which is sing-box 1.14+; ${version} rejects it ("unknown DNS rule action").`,
      );
    }
    // respond/match_response + response-match ORDERING checks are 1.14-only features; gate them to 1.14+
    // (on pre-1.14 the action itself is already errored above).
    if (atLeast(version, "1.14")) {
      const usesResponseMatch =
        matchResponse ||
        ruleObj.response_rcode !== undefined ||
        ruleObj.response_answer !== undefined ||
        ruleObj.response_ns !== undefined ||
        ruleObj.response_extra !== undefined;
      if (action === "respond" && !precedingTopLevelEvaluate) {
        push(
          diagnostics,
          "error",
          "dns-rule-respond-without-evaluate",
          `/dns/rules/${index}/action`,
          `DNS rule ${index + 1} uses \`action: "respond"\` but no preceding top-level rule has \`action: "evaluate"\`. \`respond\` returns the response saved by an earlier evaluate; without one the request fails at runtime.`,
        );
      }
      if (usesResponseMatch && !precedingTopLevelEvaluate) {
        push(
          diagnostics,
          "error",
          "dns-rule-match-response-without-evaluate",
          `/dns/rules/${index}/match_response`,
          `DNS rule ${index + 1} matches on a DNS response (match_response / response_* fields) but no preceding top-level rule has \`action: "evaluate"\`. Response matching requires an earlier evaluate — a rule's own evaluate runs after matching, so it does not count.`,
        );
      }
    }
    // Update AFTER the checks so a rule's own evaluate never satisfies its own precondition.
    if (action === "evaluate") precedingTopLevelEvaluate = true;
  });

  listItems(config.dns?.servers).forEach((server, index) => {
    const obj = server as Record<string, unknown>;
    if (typeof obj.address === "string" && obj.address.trim() !== "") {
      // V4-S4 / G2: ANY `address` field is the legacy DNS server form (bare IP, `local`, `fakeip`, or
      // a scheme:// URL) — the typed form uses `type` + `server`. The old regex only matched scheme://
      // and missed bare IPs. Binary-verified rejection ladder (PR #223 review): 1.12 still accepts it
      // (warning); 1.13 rejects it by default — `check` FATALs unless ENABLE_DEPRECATED_LEGACY_DNS_SERVERS=true;
      // 1.14 removed the formats entirely. So it hard-blocks export on BOTH stable (1.13, the default
      // stable target) and testing (1.14), and is only a soft warning on the legacy 1.12 target.
      const tag = (obj.tag as string | undefined) ?? `dns-server-${index}`;
      const removed = atLeast(version, "1.14");
      const rejected = atLeast(version, "1.13");
      push(
        diagnostics,
        rejected ? "error" : "warning",
        "dns-server-legacy-address-deprecated",
        `/dns/servers/${index}/address`,
        removed
          ? `DNS server "${tag}" uses the legacy \`address\` form ("${obj.address}"), removed in sing-box 1.14.0 — sing-box rejects this. Migrate to the typed form: split into \`type\` + \`server\`.`
          : rejected
            ? `DNS server "${tag}" uses the legacy \`address\` form ("${obj.address}"). sing-box 1.13 rejects this by default (requires ENABLE_DEPRECATED_LEGACY_DNS_SERVERS) and 1.14 removes it. Migrate to the typed form: split into \`type\` + \`server\`.`
            : `DNS server "${tag}" uses the legacy \`address\` form ("${obj.address}"). Migrate to the typed form: split into \`type\` + \`server\` (sing-box 1.12).`,
      );
    }
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
  // shared/dial.md: resolving a DOMAIN server needs a resolver, but "domain_resolver OR
  // route.default_domain_resolver is optional when only one DNS server is configured." So a domain server is
  // already covered when route.default_domain_resolver is set (it applies to every entity, overridable
  // per-entity) OR when exactly one DNS server exists (the implicit resolver). Only flag the remaining gap.
  const defaultDomainResolverRaw = (config.route as Record<string, unknown> | undefined)?.default_domain_resolver;
  const defaultDomainResolverPresent = resolverPresent(defaultDomainResolverRaw);
  const singleDnsServerConfigured = (config.dns?.servers ?? []).length === 1;
  const domainResolverImplicitlyCovered = defaultDomainResolverPresent || singleDnsServerConfigured;

  // A11 (long-chain audit, ⚠️ revises #303): a route.default_domain_resolver naming a non-existent DNS
  // server is a hard init error on all three binaries ("default domain resolver not found: <tag>") — BUT
  // only when something actually resolves a domain through dial fields: a `direct` or domain-server
  // outbound, or a tailscale / domain-peer wireguard endpoint. With no such consumer the dangling value is
  // tolerated (binary-verified: an IP-only outbound passes), so the check is consumer-gated to avoid a
  // #303-style false positive. Single-DNS does NOT save a dangling default (verified). The default's value
  // is a string DNS-server tag, or shorthand for { server: <tag> } (shared/dial.md) — both forms apply.
  // (Distinct from the missing-resolver checks: this fires on a SET-but-dangling default; the per-entity
  // checks fire on an ABSENT resolver. A dangling default is reported precisely here, not double-reported
  // by the generic per-entity warning, which stays suppressed via defaultDomainResolverPresent above.)
  const defaultDomainResolverTag =
    typeof defaultDomainResolverRaw === "string"
      ? defaultDomainResolverRaw
      : defaultDomainResolverRaw &&
          typeof defaultDomainResolverRaw === "object" &&
          !Array.isArray(defaultDomainResolverRaw) &&
          typeof (defaultDomainResolverRaw as Record<string, unknown>).server === "string"
        ? ((defaultDomainResolverRaw as Record<string, unknown>).server as string)
        : undefined;
  if (typeof defaultDomainResolverTag === "string" && defaultDomainResolverTag.length > 0 && !dnsServerTags.has(defaultDomainResolverTag)) {
    // A consumer only falls back to route.default_domain_resolver when it has NO valid per-entity
    // domain_resolver of its own — a per-entity resolver OVERRIDES the default, so a dangling default is
    // then unconsumed and the binary accepts it (verified: outbound/endpoint with its own domain_resolver +
    // dangling default → 3-binary check exit 0). So exclude entities that carry their own resolver, mirroring
    // the per-outbound early-return below. (Without this exclusion the check is a #303-shape false positive.)
    const hasDomainResolverConsumer =
      outbounds.some(
        (outbound) =>
          (outbound.type === "direct" || looksLikeDomain(outbound.server)) && !resolverPresent(outbound.domain_resolver),
      ) ||
      endpoints.some((endpoint) => {
        const ep = endpoint as Record<string, unknown>;
        if (resolverPresent(ep.domain_resolver)) return false;
        if (ep.type === "tailscale") return true;
        if (ep.type === "wireguard") {
          const peers = Array.isArray(ep.peers) ? (ep.peers as Record<string, unknown>[]) : [];
          return peers.some((peer) => looksLikeDomain(peer?.address));
        }
        return false;
      });
    if (hasDomainResolverConsumer) {
      push(
        diagnostics,
        "error",
        "missing-default-domain-resolver",
        "/route/default_domain_resolver",
        `route.default_domain_resolver references missing DNS server "${defaultDomainResolverTag}" — sing-box rejects this ("default domain resolver not found") whenever a domain-resolving outbound or endpoint is configured. Point it at an existing DNS server or fix the tag.`,
      );
    }
  }

  outbounds.forEach((outbound, index) => {
    if (!looksLikeDomain(outbound.server)) return;
    if (resolverPresent(outbound.domain_resolver)) return;
    if (domainResolverImplicitlyCovered) return;
    const tag = outbound.tag ?? `outbound-${index}`;
    push(
      diagnostics,
      "warning",
      "outbound-domain-without-resolver",
      `/outbounds/${index}/domain_resolver`,
      `Outbound "${tag}" uses a domain server but no resolver is reachable — it has no domain_resolver, route.default_domain_resolver is unset, and there is more than one DNS server. sing-box 1.14+ needs one: set this outbound's domain_resolver or route.default_domain_resolver.`,
    );
  });

  outbounds.forEach((outbound, index) => {
    const tag = outbound.tag ?? `outbound-${index}`;
    if (outbound.type === "dns") {
      // sing-box rejects the legacy `type:"dns"` special outbound by default (1.12 needs
      // ENABLE_DEPRECATED_SPECIAL_OUTBOUNDS; removed thereafter), so it hard-blocks export. (V4-S3 / M4)
      push(
        diagnostics,
        "error",
        "outbound-dns-legacy-deprecated",
        `/outbounds/${index}/type`,
        `Outbound "${tag}" uses the legacy \`type: "dns"\` outbound — sing-box rejects it by default. Migrate to a route rule with \`action: "hijack-dns"\`.`,
      );
    }
    if (outbound.type === "wireguard") {
      // sing-box rejects the legacy `type:"wireguard"` outbound by default (1.12 needs
      // ENABLE_DEPRECATED_WIREGUARD_OUTBOUND; removed in 1.13), so it hard-blocks export. (V4-S3 / M4)
      push(
        diagnostics,
        "error",
        "outbound-wireguard-legacy-deprecated",
        `/outbounds/${index}/type`,
        `Outbound "${tag}" uses the legacy \`type: "wireguard"\` outbound — sing-box rejects it by default (removed in 1.13). Migrate to \`endpoints[]\` with \`type: "wireguard"\`.`,
      );
    }
  });

  listItems(config.inbounds).forEach((inbound, index) => {
    if (inbound.type !== "tun") return;
    const obj = inbound as Record<string, unknown>;
    const legacyKeys = [
      "inet4_address",
      "inet6_address",
      "inet4_route_address",
      "inet6_route_address",
      "inet4_route_exclude_address",
      "inet6_route_exclude_address",
    ];
    const present = legacyKeys.filter((key) => obj[key] !== undefined);
    if (present.length === 0) return;
    const tag = (obj.tag as string | undefined) ?? `inbound-${index}`;
    push(
      diagnostics,
      "warning",
      "tun-legacy-address-fields-deprecated",
      `/inbounds/${index}`,
      `Inbound "${tag}" (tun) uses legacy address fields (${present.join(", ")}). Sing-box 1.10+ replaced them with unified arrays (address[] / route_address[] / route_exclude_address[]).`,
    );
  });

  // Proxy / TLS-required membership is derived from the schema registry (the single source of truth).
  const proxyOutboundTypes = proxyOutboundTypeSet();
  const tlsRequiredOutboundTypes = tlsRequiredTypes("outbound");
  const tlsRequiredInboundTypes = tlsRequiredTypes("inbound");

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
      // An absent server_port is legal when (a) ssh (defaults to 22, ssh.md) or (b) the outbound uses
      // port hopping via a non-empty `server_ports` array (hysteria/hysteria2: server_port is "Ignored
      // if server_ports is set"). In those cases only a present-but-out-of-range value is flagged; every
      // other proxy type still requires an explicit in-range port.
      const serverPorts = (outbound as Record<string, unknown>).server_ports;
      const hasServerPorts = Array.isArray(serverPorts) && serverPorts.length > 0;
      const portAbsentOk = outbound.type === "ssh" || hasServerPorts;
      const portMissing = port === undefined || port === null;
      const portOutOfRange = typeof port !== "number" || !Number.isFinite(port) || port <= 0 || port > 65535;
      if (portAbsentOk ? !portMissing && portOutOfRange : portOutOfRange) {
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

  // 1.13-added TLS fields (shared/tls.md "Changes in sing-box 1.13.0") — warn on a pre-1.13 target;
  // a 1.13/1.14 target is clean. Default-off shapes (kernel_*=false, curve_preferences=[],
  // client_authentication="no") produce nothing. client_authentication is server-only (inbound). (C7-B)
  if (!atLeast(version, "1.13")) {
    const checkTls113Fields = (tlsValue: unknown, pathPrefix: string, label: string, isServer: boolean) => {
      if (!tlsValue || typeof tlsValue !== "object" || Array.isArray(tlsValue)) return;
      const tls = tlsValue as Record<string, unknown>;
      // sing-box rejects these unknown tls fields on a pre-1.13 target ("unknown field"), so they
      // hard-block export (V4-S3 / M4) rather than passing the gate on a confirm.
      const warn = (field: string, code: string) =>
        push(diagnostics, "error", code, `${pathPrefix}/tls/${field}`, `${label} uses tls.${field}, which is sing-box 1.13+; ${version} rejects it ("unknown field").`);
      if (tls.kernel_tx === true) warn("kernel_tx", "tls-kernel-tx-1-13-only");
      if (tls.kernel_rx === true) warn("kernel_rx", "tls-kernel-rx-1-13-only");
      if (Array.isArray(tls.curve_preferences) && tls.curve_preferences.length > 0) warn("curve_preferences", "tls-curve-preferences-1-13-only");
      if (isServer && typeof tls.client_authentication === "string" && tls.client_authentication && tls.client_authentication !== "no") {
        warn("client_authentication", "tls-client-authentication-1-13-only");
      }
    };
    listItems(config.inbounds).forEach((item, index) =>
      checkTls113Fields((item as Record<string, unknown>).tls, `/inbounds/${index}`, `Inbound "${item.tag ?? `inbound-${index}`}"`, true),
    );
    outbounds.forEach((item, index) =>
      checkTls113Fields((item as Record<string, unknown>).tls, `/outbounds/${index}`, `Outbound "${item.tag ?? `outbound-${index}`}"`, false),
    );
  }

  endpoints.forEach((endpoint, index) => {
    const ep = endpoint as Record<string, unknown>;
    if (ep.type !== "wireguard") return;
    const tag = (typeof ep.tag === "string" ? ep.tag : undefined) ?? `endpoint-${index}`;
    const address = ep.address;
    const hasAddress = Array.isArray(address) ? address.length > 0 : Boolean(address);
    if (!hasAddress) {
      push(
        diagnostics,
        "error",
        "endpoint-wireguard-address-missing",
        `/endpoints/${index}/address`,
        `WireGuard endpoint "${tag}" requires at least one local address.`,
      );
    }
    if (typeof ep.private_key !== "string" || !ep.private_key.trim()) {
      push(
        diagnostics,
        "error",
        "endpoint-wireguard-private-key-missing",
        `/endpoints/${index}/private_key`,
        `WireGuard endpoint "${tag}" requires a private_key.`,
      );
    }
    const peers = Array.isArray(ep.peers) ? (ep.peers as Record<string, unknown>[]) : [];
    if (peers.length === 0) {
      push(
        diagnostics,
        "error",
        "endpoint-wireguard-peers-missing",
        `/endpoints/${index}/peers`,
        `WireGuard endpoint "${tag}" requires at least one peer.`,
      );
    }
    peers.forEach((peer, peerIndex) => {
      if (!peer || typeof peer !== "object") return;
      if (typeof peer.public_key !== "string" || !peer.public_key.trim()) {
        push(
          diagnostics,
          "error",
          "endpoint-wireguard-peer-public-key-missing",
          `/endpoints/${index}/peers/${peerIndex}/public_key`,
          `WireGuard endpoint "${tag}" peer #${peerIndex + 1} requires a public_key.`,
        );
      }
      const allowed = peer.allowed_ips;
      const hasAllowed = Array.isArray(allowed) ? allowed.length > 0 : Boolean(allowed);
      if (!hasAllowed) {
        push(
          diagnostics,
          "error",
          "endpoint-wireguard-peer-allowed-ips-missing",
          `/endpoints/${index}/peers/${peerIndex}/allowed_ips`,
          `WireGuard endpoint "${tag}" peer #${peerIndex + 1} requires allowed_ips.`,
        );
      }
    });
  });

  outbounds.forEach((outbound, index) => {
    if (outbound.type !== "selector" && outbound.type !== "urltest") return;
    const candidates = Array.isArray(outbound.outbounds) ? outbound.outbounds : [];
    const tag = outbound.tag ?? `outbound-${index}`;
    if (candidates.length === 0) {
      push(
        diagnostics,
        "error",
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
    if (outbound.type === "urltest") {
      const obj = outbound as Record<string, unknown>;
      const url = typeof obj.url === "string" ? obj.url.trim() : "";
      // `url` is optional: urltest.md — "https://www.gstatic.com/generate_204 will be used if empty". An
      // empty url is purposeful and spec-compliant, so it is NOT flagged. Only a set-but-malformed scheme is.
      if (url && !/^https?:\/\//i.test(url)) {
        push(
          diagnostics,
          "warning",
          "urltest-url-invalid-scheme",
          `/outbounds/${index}/url`,
          `URLTest "${tag}" url "${url}" should use http:// or https://.`,
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
        // Warning, not error (C1-10): sing-box accepts flow without tls at check-time; it just won't
        // function. Reality counts as TLS here (reality requires tls.enabled).
        push(
          diagnostics,
          "warning",
          "vless-flow-requires-tls",
          `/outbounds/${index}/flow`,
          `Outbound "${tag}" enables flow=xtls-rprx-vision but tls.enabled is not true; xtls-rprx-vision needs TLS (or Reality) to function.`,
        );
      }
    }
    if (outbound.type === "direct") {
      const obj = outbound as Record<string, unknown>;
      if (obj.override_address !== undefined || obj.override_port !== undefined) {
        push(
          diagnostics,
          "warning",
          "direct-override-deprecated",
          `/outbounds/${index}`,
          `Outbound "${tag}" (direct) uses override_address/override_port; both fields are deprecated since sing-box 1.11.0 and scheduled for removal in 1.13.0. Prefer route rule overrides.`,
        );
      }
    }
    if (outbound.type === "tuic") {
      const obj = outbound as Record<string, unknown>;
      if (obj.udp_over_stream && typeof obj.udp_relay_mode === "string" && obj.udp_relay_mode.length > 0) {
        push(
          diagnostics,
          "error",
          "tuic-udp-mode-conflict",
          `/outbounds/${index}`,
          `TUIC outbound "${tag}" sets both udp_over_stream and udp_relay_mode; the two are mutually exclusive.`,
        );
      }
      if (obj.zero_rtt_handshake === true) {
        push(
          diagnostics,
          "warning",
          "tuic-zero-rtt-replay",
          `/outbounds/${index}/zero_rtt_handshake`,
          `TUIC outbound "${tag}" enables zero_rtt_handshake; 0-RTT is vulnerable to replay attacks — disabling it is recommended.`,
        );
      }
    }
    if (outbound.type === "hysteria") {
      push(
        diagnostics,
        "warning",
        "hysteria-v1-deprecated",
        `/outbounds/${index}`,
        `Outbound "${tag}" uses Hysteria v1 (legacy); prefer type="hysteria2" for new deployments.`,
      );
    }
    if (outbound.type === "ssh") {
      const obj = outbound as Record<string, unknown>;
      const password = typeof obj.password === "string" && obj.password.length > 0;
      const privateKey = typeof obj.private_key === "string" && obj.private_key.length > 0;
      const privateKeyPath = typeof obj.private_key_path === "string" && obj.private_key_path.length > 0;
      const auths = [password, privateKey, privateKeyPath].filter(Boolean);
      if (auths.length > 1) {
        push(
          diagnostics,
          "warning",
          "ssh-auth-mutex",
          `/outbounds/${index}`,
          `SSH outbound "${tag}" sets more than one of password / private_key / private_key_path. sing-box uses the highest-priority one and ignores the rest; remove the unused entries to avoid confusion.`,
        );
      }
    }
    if (channel === "stable" && outbound.type === "ssh") {
      const obj = outbound as Record<string, unknown>;
      if (obj.cipher !== undefined) {
        push(
          diagnostics,
          "error",
          "ssh-cipher-testing-only",
          `/outbounds/${index}/cipher`,
          `Outbound "${tag}" (ssh) sets cipher; this allow-list is testing-only (sing-box 1.14+).`,
        );
      }
      if (obj.mac !== undefined) {
        push(
          diagnostics,
          "error",
          "ssh-mac-testing-only",
          `/outbounds/${index}/mac`,
          `Outbound "${tag}" (ssh) sets mac; this allow-list is testing-only (sing-box 1.14+).`,
        );
      }
      if (obj.kex_algorithm !== undefined) {
        push(
          diagnostics,
          "error",
          "ssh-kex-algorithm-testing-only",
          `/outbounds/${index}/kex_algorithm`,
          `Outbound "${tag}" (ssh) sets kex_algorithm; this allow-list is testing-only (sing-box 1.14+).`,
        );
      }
    }
    if (outbound.type === "hysteria2") {
      const obj = outbound as Record<string, unknown>;
      if (Array.isArray(obj.server_ports) && obj.server_ports.length > 0) {
        if (typeof obj.server_port === "number" && obj.server_port > 0) {
          push(
            diagnostics,
            "warning",
            "hysteria2-server-port-vs-server-ports",
            `/outbounds/${index}/server_ports`,
            `Hysteria2 outbound "${tag}" sets both server_port and server_ports; sing-box ignores server_port whenever server_ports is non-empty.`,
          );
        }
      }
    }
    if (channel === "stable" && outbound.type === "hysteria2") {
      const obj = outbound as Record<string, unknown>;
      if (obj.realm !== undefined) {
        push(
          diagnostics,
          "error",
          "hysteria2-realm-testing-only",
          `/outbounds/${index}/realm`,
          `Outbound "${tag}" (hysteria2) sets realm; the realm rendezvous field is testing-only (sing-box 1.14+) and will be rejected by stable builds.`,
        );
      }
      if (obj.bbr_profile !== undefined) {
        push(
          diagnostics,
          "error",
          "hysteria2-bbr-profile-testing-only",
          `/outbounds/${index}/bbr_profile`,
          `Outbound "${tag}" (hysteria2) sets bbr_profile; this BBR tuning field is testing-only (sing-box 1.14+).`,
        );
      }
      if (obj.hop_interval_max !== undefined) {
        push(
          diagnostics,
          "error",
          "hysteria2-hop-interval-max-testing-only",
          `/outbounds/${index}/hop_interval_max`,
          `Outbound "${tag}" (hysteria2) sets hop_interval_max; this randomization field is testing-only (sing-box 1.14+).`,
        );
      }
      // obfs.min_packet_size / max_packet_size are gecko-only and 1.14 (hysteria2.md).
      const obfsObj = obj.obfs;
      if (obfsObj && typeof obfsObj === "object" && !Array.isArray(obfsObj)) {
        const o = obfsObj as Record<string, unknown>;
        if (o.min_packet_size !== undefined || o.max_packet_size !== undefined) {
          push(
            diagnostics,
            "error",
            "hysteria2-obfs-packet-size-testing-only",
            `/outbounds/${index}/obfs`,
            `Outbound "${tag}" (hysteria2) sets obfs.min_packet_size / max_packet_size; these gecko packet-size fields are testing-only (sing-box 1.14+).`,
          );
        }
      }
    }
    checkQuic114Fields(diagnostics, channel, outbound.type, outbound as Record<string, unknown>, `/outbounds/${index}`, `Outbound "${tag}"`);
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
    if (inbound.type === "hysteria") {
      push(
        diagnostics,
        "warning",
        "inbound-hysteria-v1-deprecated",
        `/inbounds/${index}`,
        `Inbound "${inbound.tag ?? `inbound-${index}`}" uses Hysteria v1 (legacy); prefer type="hysteria2" for new deployments.`,
      );
    }
    if (inbound.type === "cloudflared") {
      const obj = inbound as Record<string, unknown>;
      const tag = (obj.tag as string | undefined) ?? `inbound-${index}`;
      // token-required-ness is declared in the schema registry (requiredFields: ["token"]).
      const tokenRequired = requiredFieldsFor("inbound", "cloudflared").includes("token");
      if (tokenRequired && (typeof obj.token !== "string" || obj.token.trim() === "")) {
        push(
          diagnostics,
          "error",
          "inbound-cloudflared-token-missing",
          `/inbounds/${index}/token`,
          `Cloudflared inbound "${tag}" requires a base64 tunnel token (Cloudflare Zero Trust → Networks → Tunnels).`,
        );
      }
      if (!atLeast(version, "1.14")) {
        push(
          diagnostics,
          "error",
          "inbound-cloudflared-testing-only",
          `/inbounds/${index}`,
          `Cloudflared inbound "${tag}" requires sing-box 1.14+ (testing); the target is ${version}. sing-box ${version} rejects it ("unknown inbound type: cloudflared").`,
        );
      }
    }
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
      if ((inbound as Record<string, unknown>).zero_rtt_handshake === true) {
        push(
          diagnostics,
          "warning",
          "tuic-zero-rtt-replay",
          `/inbounds/${index}/zero_rtt_handshake`,
          `Inbound "${inbound.tag ?? `inbound-${index}`}" (tuic) enables zero_rtt_handshake; 0-RTT is vulnerable to replay attacks — disabling it is recommended.`,
        );
      }
    }
    if (channel === "stable" && inbound.type === "tun") {
      const obj = inbound as Record<string, unknown>;
      if (obj.dns_mode !== undefined) {
        push(
          diagnostics,
          "error",
          "tun-dns-mode-testing-only",
          `/inbounds/${index}/dns_mode`,
          `Inbound "${inbound.tag ?? `inbound-${index}`}" (tun) sets dns_mode; this field is testing-only (sing-box 1.14+).`,
        );
      }
      if (obj.dns_address !== undefined) {
        push(
          diagnostics,
          "error",
          "tun-dns-address-testing-only",
          `/inbounds/${index}/dns_address`,
          `Inbound "${inbound.tag ?? `inbound-${index}`}" (tun) sets dns_address; this field is testing-only (sing-box 1.14+).`,
        );
      }
      // Field-level paths (not entity-level) so the data-driven VT3 gate dedups against this friendlier
      // message instead of stacking a second error on the same field.
      const macLabel = `Inbound "${inbound.tag ?? `inbound-${index}`}" (tun)`;
      for (const macField of ["include_mac_address", "exclude_mac_address"] as const) {
        if (obj[macField] === undefined) continue;
        push(
          diagnostics,
          "error",
          "tun-mac-address-filter-testing-only",
          `/inbounds/${index}/${macField}`,
          `${macLabel} uses ${macField} filtering; this field is testing-only (sing-box 1.14+, Linux only).`,
        );
      }
    }
    // VT1 (M2) — W8 gated these 1.14-only hysteria2 fields on the OUTBOUND branch only; mirror the two that
    // are genuinely testing-only on the INBOUND branch. Binary-verified: stable `check` rejects realm /
    // bbr_profile on an inbound hysteria2 ("unknown field …") while testing accepts the field (descends
    // into it / value-level errors only). NOTE: hop_interval_max is deliberately NOT gated here — it is an
    // outbound-only port-hopping field that testing ALSO rejects on an inbound, so it is not "testing-only";
    // the W9 unknown-field linter already errors it on every channel (gating it would double-report with a
    // misleading "valid on testing" message — an M1-class false gate).
    if (channel === "stable" && inbound.type === "hysteria2") {
      const obj = inbound as Record<string, unknown>;
      const label = `Inbound "${inbound.tag ?? `inbound-${index}`}"`;
      if (obj.realm !== undefined) {
        push(
          diagnostics,
          "error",
          "hysteria2-realm-testing-only",
          `/inbounds/${index}/realm`,
          `${label} (hysteria2) sets realm; the realm rendezvous field is testing-only (sing-box 1.14+) and will be rejected by stable builds.`,
        );
      }
      if (obj.bbr_profile !== undefined) {
        push(
          diagnostics,
          "error",
          "hysteria2-bbr-profile-testing-only",
          `/inbounds/${index}/bbr_profile`,
          `${label} (hysteria2) sets bbr_profile; this BBR tuning field is testing-only (sing-box 1.14+).`,
        );
      }
      // obfs.min_packet_size / max_packet_size are gecko-only and 1.14 (inbound/hysteria2.md).
      const obfsObj = obj.obfs;
      if (obfsObj && typeof obfsObj === "object" && !Array.isArray(obfsObj)) {
        const o = obfsObj as Record<string, unknown>;
        if (o.min_packet_size !== undefined || o.max_packet_size !== undefined) {
          push(
            diagnostics,
            "error",
            "hysteria2-obfs-packet-size-testing-only",
            `/inbounds/${index}/obfs`,
            `${label} (hysteria2) sets obfs.min_packet_size / max_packet_size; these gecko packet-size fields are testing-only (sing-box 1.14+).`,
          );
        }
      }
    }
    checkQuic114Fields(diagnostics, channel, inbound.type, inbound as Record<string, unknown>, `/inbounds/${index}`, `Inbound "${inbound.tag ?? `inbound-${index}`}"`);
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

  const dnsTop = config.dns;
  if (dnsTop && typeof dnsTop === "object") {
    const legacyFakeip = (dnsTop as Record<string, unknown>).fakeip;
    if (legacyFakeip && typeof legacyFakeip === "object" && !Array.isArray(legacyFakeip)) {
      // Top-level dns.fakeip: deprecated 1.12, but 1.13 already rejects it by default (binary-verified,
      // PR #223 review — `check` ERRORs out) and 1.14 removed it. Only 1.12 still accepts it → warning
      // there, hard error on the default stable target (1.13) and on testing (1.14).
      const removed = atLeast(version, "1.14");
      const rejected = atLeast(version, "1.13");
      push(
        diagnostics,
        rejected ? "error" : "warning",
        "legacy-fakeip-deprecated",
        "/dns/fakeip",
        removed
          ? "Top-level dns.fakeip was removed in sing-box 1.14.0 — sing-box rejects this. Migrate to a dns.servers[] entry with type=fakeip."
          : rejected
            ? "Top-level dns.fakeip is rejected by sing-box 1.13 (deprecated since 1.12.0, removed in 1.14.0). Migrate to a dns.servers[] entry with type=fakeip."
            : "Top-level dns.fakeip is deprecated since sing-box 1.12.0 and removed in 1.14.0. Migrate to a dns.servers[] entry with type=fakeip.",
      );
    }
  }

  listItems(config.dns?.servers).forEach((server, index) => {
    if (server.type === "fakeip") {
      const obj = server as Record<string, unknown>;
      const v4 = typeof obj.inet4_range === "string" && obj.inet4_range.length > 0;
      const v6 = typeof obj.inet6_range === "string" && obj.inet6_range.length > 0;
      if (!v4 && !v6) {
        push(
          diagnostics,
          "error",
          "dns-server-fakeip-range-missing",
          `/dns/servers/${index}`,
          `Fake-IP DNS server "${server.tag}" requires at least one of inet4_range or inet6_range; sing-box refuses to start otherwise.`,
        );
      }
      // CIDR-shape validation: a malformed range (or the wrong IP family) exports silently and
      // sing-box rejects it at start (W28).
      if (v4 && !isIpv4Cidr(obj.inet4_range as string)) {
        push(
          diagnostics,
          "error",
          "dns-server-fakeip-range-invalid",
          `/dns/servers/${index}/inet4_range`,
          `Fake-IP DNS server "${server.tag}" inet4_range "${obj.inet4_range}" is not a valid IPv4 CIDR (e.g. 198.18.0.0/15).`,
        );
      }
      if (v6 && !isIpv6Cidr(obj.inet6_range as string)) {
        push(
          diagnostics,
          "error",
          "dns-server-fakeip-range-invalid",
          `/dns/servers/${index}/inet6_range`,
          `Fake-IP DNS server "${server.tag}" inet6_range "${obj.inet6_range}" is not a valid IPv6 CIDR (e.g. fc00::/18).`,
        );
      }
    }
    const serverRequiredTypes = new Set(["udp", "tcp", "tls", "https", "quic", "h3"]);
    if (serverRequiredTypes.has(server.type)) {
      const value = (server as Record<string, unknown>).server;
      if (typeof value !== "string" || !value.trim()) {
        push(
          diagnostics,
          "error",
          "dns-server-missing-server",
          `/dns/servers/${index}/server`,
          `DNS server "${server.tag ?? `dns-server-${index}`}" of type ${server.type} requires a server address.`,
        );
      }
    }
    void server;
  });

  if (channel === "stable") {
    const certificate = config.certificate as Record<string, unknown> | undefined;
    if (certificate && typeof certificate === "object" && !Array.isArray(certificate)) {
      if (!atLeast(version, "1.12")) {
        push(
          diagnostics,
          "warning",
          "settings-certificate-block-testing-only",
          "/certificate",
          "The top-level `certificate` block requires sing-box 1.12+; this target may reject it.",
        );
      }
      if (certificate.store === "chrome" && !atLeast(version, "1.13")) {
        // W3: hard error, not a bypassable warning — 1.12 rejects the `chrome` system-cert store
        // ("unknown certificate store"), so a config that sets it must not pass the export gate.
        push(
          diagnostics,
          "error",
          "settings-certificate-store-chrome-testing-only",
          "/certificate/store",
          "certificate.store=chrome requires sing-box 1.13+; sing-box 1.12 rejects it.",
        );
      }
    }
  }

  listItems(config.dns?.servers).forEach((server, index) => {
    // A hosts DNS server with no predefined entries and no explicit `path` is NOT empty/useless — dns/server/
    // hosts.md: `path` defaults to /etc/hosts (the system hosts file; the Windows path on Windows), so it
    // serves the system host entries. That is a valid, purposeful config, so it is not flagged.
    if (server.type === "resolved") {
      const obj = server as Record<string, unknown>;
      const serviceTag = typeof obj.service === "string" ? obj.service : "";
      if (!serviceTag) {
        push(
          diagnostics,
          "warning",
          "dns-server-resolved-service-missing",
          `/dns/servers/${index}/service`,
          `Resolved DNS server "${server.tag}" requires a service reference to a service:resolved node.`,
        );
      } else {
        const found = (config.services ?? []).some(
          (entry) => entry.type === "resolved" && entry.tag === serviceTag,
        );
        if (!found) {
          push(
            diagnostics,
            "error",
            "dns-server-resolved-service-not-found",
            `/dns/servers/${index}/service`,
            `Resolved DNS server "${server.tag}" references missing service:resolved tag "${serviceTag}".`,
          );
        }
      }
    }
    if (server.type === "tailscale" && !server.endpoint) {
      push(
        diagnostics,
        "error",
        "dns-server-tailscale-endpoint-missing",
        `/dns/servers/${index}/endpoint`,
        `Tailscale DNS server "${server.tag}" requires an endpoint reference to a tailscale endpoint node.`,
      );
    }
    if (channel === "stable" && server.type === "tailscale") {
      const obj = server as Record<string, unknown>;
      if (obj.accept_search_domain !== undefined) {
        push(
          diagnostics,
          "warning",
          "dns-server-tailscale-accept-search-domain-testing-only",
          `/dns/servers/${index}/accept_search_domain`,
          `DNS server "${server.tag}" (tailscale) sets accept_search_domain; this field is testing-only (sing-box 1.14+).`,
        );
      }
    }
    if (!looksLikeDomain(server.server)) return;
    if (resolverPresent(server.domain_resolver)) return;
    // A6 (long-chain audit, ⚠️ revises #303): a DOMAIN DNS server must set its OWN per-server
    // domain_resolver. Unlike dial fields (outbounds/endpoints), route.default_domain_resolver and the
    // single-DNS-server fallback do NOT cover a DNS server's self-resolution — sing-box rejects it on ALL
    // three versions (1.12 too), FATAL "missing domain resolver for domain server address". #303 wrongly
    // reused the dial-field implicit-cover here, masking a hard error. (IP-literal servers are excluded by
    // looksLikeDomain above — the single-server optionality still legitimately covers those.)
    push(
      diagnostics,
      "error",
      "dns-server-domain-without-resolver",
      `/dns/servers/${index}/domain_resolver`,
      `DNS server "${server.tag}" uses a domain server address ("${server.server}") but has no domain_resolver. sing-box rejects this on every version ("missing domain resolver for domain server address") — a domain DNS server must set its own per-server domain_resolver. route.default_domain_resolver and the single-DNS-server fallback do not apply to DNS servers.`,
    );
  });

  if (channel === "stable") {
    if (listItems(config.certificate_providers).length > 0) {
      push(
        diagnostics,
        "error",
        "stable-version-gated-certificate-providers",
        "/certificate_providers",
        `Top-level certificate_providers is sing-box 1.14+ (testing); the target is ${version}. sing-box ${version} rejects it ("unknown field certificate_providers").`,
      );
    }
    if (listItems(config.http_clients).length > 0) {
      push(
        diagnostics,
        "error",
        "stable-version-gated-http-clients",
        "/http_clients",
        `http_clients is sing-box 1.14+ (testing); the target is ${version}. sing-box ${version} rejects it ("unknown field http_clients").`,
      );
    }
    listItems(config.dns?.servers).forEach((server, index) => {
      const obj = server as Record<string, unknown>;
      if (obj.type !== "local") return;
      if (!Array.isArray(obj.neighbor_domain) || obj.neighbor_domain.length === 0) return;
      const tag = server.tag ?? `dns-server-${index}`;
      push(
        diagnostics,
        "warning",
        "dns-server-neighbor-domain-testing-only",
        `/dns/servers/${index}/neighbor_domain`,
        `DNS server "${tag}" (local) sets neighbor_domain; this field is testing-only (sing-box 1.14+).`,
      );
    });
    listItems(((config as Record<string, unknown>).endpoints as Record<string, unknown>[]) ?? []).forEach((endpoint, index) => {
      const obj = endpoint as Record<string, unknown>;
      if (obj.type !== "tailscale") return;
      const tag = (obj.tag as string | undefined) ?? `endpoint-${index}`;
      if (Array.isArray(obj.advertise_tags) && obj.advertise_tags.length > 0 && !atLeast(version, "1.13")) {
        push(
          diagnostics,
          "error",
          "endpoint-tailscale-advertise-tags-1-13-only",
          `/endpoints/${index}/advertise_tags`,
          `Endpoint "${tag}" (tailscale) sets advertise_tags, which is sing-box 1.13+; ${version} rejects it ("unknown field").`,
        );
      }
      // system_interface (bool), system_interface_name (string), system_interface_mtu (number) are all
      // 1.13+ (C0-13: system_interface is a boolean, not a string). Flag any of them set on < 1.13.
      const usesSystemInterface =
        obj.system_interface === true ||
        (typeof obj.system_interface_name === "string" && obj.system_interface_name.trim() !== "") ||
        typeof obj.system_interface_mtu === "number";
      if (usesSystemInterface && !atLeast(version, "1.13")) {
        push(
          diagnostics,
          "warning",
          "endpoint-tailscale-system-interface-1-13-only",
          `/endpoints/${index}/system_interface`,
          `Endpoint "${tag}" (tailscale) uses system_interface fields; these are sing-box 1.13+. Stable 1.12 targets reject them.`,
        );
      }
      // relay_server_port is sing-box 1.13+ (the 0 default means "auto/off", so only a real port is flagged).
      if (typeof obj.relay_server_port === "number" && obj.relay_server_port > 0 && !atLeast(version, "1.13")) {
        push(
          diagnostics,
          "warning",
          "endpoint-tailscale-relay-server-port-1-13-only",
          `/endpoints/${index}/relay_server_port`,
          `Endpoint "${tag}" (tailscale) sets relay_server_port; this field is sing-box 1.13+. Stable 1.12 targets reject it.`,
        );
      }
    });
    const dnsObj = config.dns as Record<string, unknown> | undefined;
    if (dnsObj && typeof dnsObj === "object") {
      if (dnsObj.optimistic !== undefined) {
        push(
          diagnostics,
          "error",
          "dns-optimistic-testing-only",
          "/dns/optimistic",
          "dns.optimistic is sing-box 1.14+; this target rejects it (unknown field).",
        );
      }
      if (dnsObj.timeout !== undefined) {
        push(
          diagnostics,
          "error",
          "dns-timeout-testing-only",
          "/dns/timeout",
          "dns.timeout is sing-box 1.14+; this target rejects it (unknown field).",
        );
      }
    }
  }

  listItems(config.dns?.servers).forEach((server, index) => {
    const obj = server as Record<string, unknown>;
    if (obj.type !== "dhcp") return;
    if (!Object.prototype.hasOwnProperty.call(obj, "interface")) return;
    if (typeof obj.interface !== "string" || obj.interface.trim() !== "") return;
    const tag = server.tag ?? `dns-server-${index}`;
    push(
      diagnostics,
      "warning",
      "dns-server-dhcp-interface-empty",
      `/dns/servers/${index}/interface`,
      `DNS server "${tag}" (dhcp) sets interface to an empty string; remove the field to let sing-box pick the default interface.`,
    );
  });

  if (channel === "stable") {
    const route = config.route as Record<string, unknown> | undefined;
    if (route && typeof route === "object" && !Array.isArray(route)) {
      if (route.find_neighbor !== undefined) {
        push(
          diagnostics,
          "error",
          "route-find-neighbor-testing-only",
          "/route/find_neighbor",
          "route.find_neighbor is testing-only (sing-box 1.14+).",
        );
      }
      if (route.dhcp_lease_files !== undefined) {
        push(
          diagnostics,
          "error",
          "route-dhcp-lease-files-testing-only",
          "/route/dhcp_lease_files",
          "route.dhcp_lease_files is testing-only (sing-box 1.14+).",
        );
      }
      if (route.default_http_client !== undefined) {
        push(
          diagnostics,
          "error",
          "route-default-http-client-testing-only",
          "/route/default_http_client",
          "route.default_http_client is testing-only (sing-box 1.14+).",
        );
      }
    }
    listItems(config.route?.rule_set).forEach((ruleSet, index) => {
      if ((ruleSet as Record<string, unknown>).http_client !== undefined) {
        push(
          diagnostics,
          "error",
          "rule-set-http-client-testing-only",
          `/route/rule_set/${index}/http_client`,
          `Rule-set ${index + 1} sets \`http_client\`, which is testing-only (sing-box 1.14+). On stable, use \`download_detour\`.`,
        );
      }
    });
    const dnsRules = config.dns?.rules;
    if (Array.isArray(dnsRules)) {
      const testingMatchers = [
        "source_mac_address",
        "source_hostname",
        "preferred_by",
        "match_response",
        "package_name_regex",
      ];
      dnsRules.forEach((rule, ruleIndex) => {
        if (!rule || typeof rule !== "object") return;
        for (const field of testingMatchers) {
          if ((rule as Record<string, unknown>)[field] !== undefined) {
            push(
              diagnostics,
              "warning",
              `dns-rule-${field.replace(/_/g, "-")}-testing-only`,
              `/dns/rules/${ruleIndex}/${field}`,
              `DNS rule ${ruleIndex + 1} uses ${field}; this matcher is testing-only (sing-box 1.14+).`,
            );
          }
        }
      });
    }
  }

  const ntp = (config as Record<string, unknown>).ntp;
  if (ntp && typeof ntp === "object" && !Array.isArray(ntp)) {
    const ntpObj = ntp as Record<string, unknown>;
    if (ntpObj.enabled === true) {
      const server = typeof ntpObj.server === "string" ? ntpObj.server.trim() : "";
      if (!server) {
        push(
          diagnostics,
          "error",
          "ntp-server-missing",
          "/ntp/server",
          "NTP is enabled but server is empty; sing-box requires a server hostname or address when ntp.enabled is true.",
        );
      }
      const detour = typeof ntpObj.detour === "string" ? ntpObj.detour : "";
      if (detour && !outboundTags.has(detour)) {
        push(
          diagnostics,
          "error",
          "ntp-detour-missing",
          "/ntp/detour",
          `NTP detour references missing outbound "${detour}".`,
        );
      }
    }
  }

  const experimental = config.experimental;
  if (experimental && typeof experimental === "object" && !Array.isArray(experimental)) {
    const cacheFile = (experimental as Record<string, unknown>).cache_file;
    if (cacheFile && typeof cacheFile === "object" && !Array.isArray(cacheFile)) {
      const cfObj = cacheFile as Record<string, unknown>;
      if (cfObj.store_rdrc !== undefined) {
        push(
          diagnostics,
          "warning",
          "cache-file-store-rdrc-deprecated",
          "/experimental/cache_file/store_rdrc",
          "experimental.cache_file.store_rdrc is deprecated since 1.14.0 and scheduled for removal in 1.16. Migrate to store_dns.",
        );
      }
      if (channel === "stable" && cfObj.store_dns !== undefined) {
        push(
          diagnostics,
          "warning",
          "cache-file-store-dns-testing-only",
          "/experimental/cache_file/store_dns",
          "experimental.cache_file.store_dns is testing-only (sing-box 1.14+).",
        );
      }
    }
    const v2rayApi = (experimental as Record<string, unknown>).v2ray_api;
    if (v2rayApi && typeof v2rayApi === "object" && !Array.isArray(v2rayApi)) {
      const stats = (v2rayApi as Record<string, unknown>).stats;
      if (stats && typeof stats === "object" && !Array.isArray(stats)) {
        const inboundTags = new Set(
          (config.inbounds ?? []).map((i) => i.tag).filter((tag): tag is string => Boolean(tag)),
        );
        const inboundsList = Array.isArray((stats as Record<string, unknown>).inbounds)
          ? ((stats as Record<string, unknown>).inbounds as unknown[])
          : [];
        inboundsList.forEach((tag) => {
          if (typeof tag !== "string") return;
          if (!inboundTags.has(tag)) {
            push(
              diagnostics,
              "error",
              "v2ray-stats-inbound-missing",
              "/experimental/v2ray_api/stats/inbounds",
              `experimental.v2ray_api.stats.inbounds references missing inbound "${tag}".`,
            );
          }
        });
        const outboundsList = Array.isArray((stats as Record<string, unknown>).outbounds)
          ? ((stats as Record<string, unknown>).outbounds as unknown[])
          : [];
        outboundsList.forEach((tag) => {
          if (typeof tag !== "string") return;
          if (!outboundTags.has(tag)) {
            push(
              diagnostics,
              "error",
              "v2ray-stats-outbound-missing",
              "/experimental/v2ray_api/stats/outbounds",
              `experimental.v2ray_api.stats.outbounds references missing outbound "${tag}".`,
            );
          }
        });
      }
    }
    const clashApi = (experimental as Record<string, unknown>).clash_api;
    if (clashApi && typeof clashApi === "object" && !Array.isArray(clashApi)) {
      const detour = (clashApi as Record<string, unknown>).external_ui_download_detour;
      if (typeof detour === "string" && detour.length > 0 && !outboundTags.has(detour)) {
        // A4 (long-chain audit): warning, not error. The detour is only resolved lazily when downloading
        // the external UI, and clash-api.md documents the empty default ("Default outbound will be used if
        // empty"). `check` exits 0 and `run` starts cleanly on 1.12/1.13/1.14, so a dangling tag does not
        // block a runnable export — but it is still likely a typo worth flagging.
        push(
          diagnostics,
          "warning",
          "clash-api-download-detour-missing",
          "/experimental/clash_api/external_ui_download_detour",
          `experimental.clash_api.external_ui_download_detour references missing outbound "${detour}" — UI downloads will fall back to the default outbound. Fix the tag or remove it.`,
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
      const formatField = typeof ruleSet.format === "string" ? ruleSet.format : "";
      if (!formatField && url) {
        const pathOnly = url.split("?")[0]?.split("#")[0] ?? "";
        const ext = pathOnly.split(".").pop()?.toLowerCase() ?? "";
        if (ext !== "json" && ext !== "srs") {
          push(
            diagnostics,
            "error",
            "rule-set-format-missing",
            `/route/rule_set/${index}/format`,
            `Remote rule-set "${tag}" has no format and the url does not end in .json or .srs; sing-box cannot infer the format.`,
          );
        }
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
      // U14 — download_detour is deprecated in 1.14 and REMOVED in 1.16 (rule-set/index.md:130-134). Warn
      // on 1.14/1.15; escalate to an export-blocking error on >=1.16 where the field no longer decodes.
      if (detour && atLeast(version, "1.16")) {
        push(
          diagnostics,
          "error",
          "rule-set-download-detour-removed",
          `/route/rule_set/${index}/download_detour`,
          `Remote rule-set "${tag}" uses download_detour, which was removed in sing-box 1.16; ${version} rejects it. Use an HTTP Client (http_client) instead.`,
        );
      } else if (detour && atLeast(version, "1.14")) {
        push(
          diagnostics,
          "warning",
          "rule-set-download-detour-deprecated",
          `/route/rule_set/${index}/download_detour`,
          `Remote rule-set "${tag}" uses download_detour, which is deprecated in sing-box 1.14+ in favour of http_client. Migrate before it is removed in 1.16.`,
        );
      }
      // U14 — both set: http_client takes precedence, so download_detour is redundant dead config.
      if (detour && (ruleSet as Record<string, unknown>).http_client !== undefined) {
        push(
          diagnostics,
          "warning",
          "rule-set-download-detour-http-client-conflict",
          `/route/rule_set/${index}/download_detour`,
          `Remote rule-set "${tag}" sets both download_detour and http_client; http_client takes precedence, so download_detour is redundant — remove it.`,
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
      const localFormat = typeof ruleSet.format === "string" ? ruleSet.format : "";
      if (!localFormat && path) {
        // Local `path` is a filesystem path, not a URL, so the extension is read as-is (no ?/# stripping).
        const ext = path.split(".").pop()?.toLowerCase() ?? "";
        if (ext !== "json" && ext !== "srs") {
          push(
            diagnostics,
            "error",
            "rule-set-local-format-missing",
            `/route/rule_set/${index}/format`,
            `Local rule-set "${tag}" has no format and path "${path}" does not end in .json or .srs; sing-box cannot infer the format.`,
          );
        }
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

  const dialDomainStrategyMessage =
    'Dial field "domain_strategy" is deprecated since sing-box 1.12.0 and scheduled for removal. Migrate to "domain_resolver" (per-entity) or route.default_domain_resolver.';
  const hasDomainStrategy = (entity: unknown): boolean => {
    if (!entity || typeof entity !== "object") return false;
    const value = (entity as Record<string, unknown>).domain_strategy;
    return typeof value === "string" && value.length > 0;
  };
  outbounds.forEach((outbound, index) => {
    if (!hasDomainStrategy(outbound)) return;
    const tag = outbound.tag ?? `outbound-${index}`;
    push(
      diagnostics,
      "warning",
      "dial-domain-strategy-deprecated",
      `/outbounds/${index}/domain_strategy`,
      `Outbound "${tag}" — ${dialDomainStrategyMessage}`,
    );
  });
  listItems(config.dns?.servers).forEach((server, index) => {
    if (!hasDomainStrategy(server)) return;
    const tag = server.tag ?? `dns-server-${index}`;
    push(
      diagnostics,
      "warning",
      "dial-domain-strategy-deprecated",
      `/dns/servers/${index}/domain_strategy`,
      `DNS server "${tag}" — ${dialDomainStrategyMessage}`,
    );
  });
  endpoints.forEach((endpoint, index) => {
    if (!hasDomainStrategy(endpoint)) return;
    const tag = endpoint.tag ?? `endpoint-${index}`;
    push(
      diagnostics,
      "warning",
      "dial-domain-strategy-deprecated",
      `/endpoints/${index}/domain_strategy`,
      `Endpoint "${tag}" — ${dialDomainStrategyMessage}`,
    );
  });
  if (hasDomainStrategy(config.ntp)) {
    push(
      diagnostics,
      "warning",
      "dial-domain-strategy-deprecated",
      "/ntp/domain_strategy",
      `NTP — ${dialDomainStrategyMessage}`,
    );
  }

  if (channel === "testing") {
    const tlsAcmeMessage =
      'Inline tls.acme is deprecated since sing-box 1.14.0. Move the ACME options into a tls.certificate_provider (type=acme) inline or a top-level certificate_providers[] entry.';
    const hasInlineAcme = (entity: unknown): boolean => {
      if (!entity || typeof entity !== "object") return false;
      const tls = (entity as Record<string, unknown>).tls;
      if (!tls || typeof tls !== "object" || Array.isArray(tls)) return false;
      const acme = (tls as Record<string, unknown>).acme;
      return Boolean(acme && typeof acme === "object" && !Array.isArray(acme));
    };
    listItems(config.inbounds).forEach((inbound, index) => {
      if (!hasInlineAcme(inbound)) return;
      const tag = inbound.tag ?? `inbound-${index}`;
      push(
        diagnostics,
        "warning",
        "tls-acme-deprecated",
        `/inbounds/${index}/tls/acme`,
        `Inbound "${tag}" — ${tlsAcmeMessage}`,
      );
    });
    outbounds.forEach((outbound, index) => {
      if (!hasInlineAcme(outbound)) return;
      const tag = outbound.tag ?? `outbound-${index}`;
      push(
        diagnostics,
        "warning",
        "tls-acme-deprecated",
        `/outbounds/${index}/tls/acme`,
        `Outbound "${tag}" — ${tlsAcmeMessage}`,
      );
    });
    listItems(config.dns?.servers).forEach((server, index) => {
      if (!hasInlineAcme(server)) return;
      const tag = server.tag ?? `dns-server-${index}`;
      push(
        diagnostics,
        "warning",
        "tls-acme-deprecated",
        `/dns/servers/${index}/tls/acme`,
        `DNS server "${tag}" — ${tlsAcmeMessage}`,
      );
    });
    services.forEach((service, index) => {
      if (!hasInlineAcme(service)) return;
      const tag = service.tag ?? `service-${index}`;
      push(
        diagnostics,
        "warning",
        "tls-acme-deprecated",
        `/services/${index}/tls/acme`,
        `Service "${tag}" — ${tlsAcmeMessage}`,
      );
    });
  }

  const usersRequiredInboundTypes = new Set([
    "vmess",
    "vless",
    "trojan",
    "naive",
    "hysteria",
    "hysteria2",
    "tuic",
    "anytls",
  ]);
  listItems(config.inbounds).forEach((inbound, index) => {
    if (!usersRequiredInboundTypes.has(inbound.type)) return;
    const users = (inbound as Record<string, unknown>).users;
    if (Array.isArray(users) && users.length > 0) return;
    const tag = inbound.tag ?? `inbound-${index}`;
    push(
      diagnostics,
      "error",
      "inbound-users-required",
      `/inbounds/${index}/users`,
      `Inbound "${tag}" (${inbound.type}) requires at least one user; sing-box will reject the config otherwise.`,
    );
  });

  outbounds.forEach((outbound, index) => {
    if (outbound.type !== "block") return;
    const tag = outbound.tag ?? `outbound-${index}`;
    push(
      diagnostics,
      "warning",
      "outbound-block-deprecated",
      `/outbounds/${index}`,
      `Outbound "${tag}" (block) is deprecated since sing-box 1.11.0. Remove the outbound and use a route rule with action="reject" instead.`,
    );
  });

  const legacyInboundSniffFields = ["sniff", "sniff_override_destination", "sniff_timeout"] as const;
  const inboundLegacySniffMessage =
    'Inbound-level sniff/sniff_timeout/sniff_override_destination are deprecated since sing-box 1.11.0. Move sniffing to a route rule with action="sniff" (and optional timeout/override_destination).';
  const inboundLegacyDomainStrategyMessage =
    'Inbound-level domain_strategy is deprecated since sing-box 1.11.0. Move domain resolution to a route rule with action="resolve" (and optional strategy).';
  listItems(config.inbounds).forEach((inbound, index) => {
    const obj = inbound as Record<string, unknown>;
    const tag = inbound.tag ?? `inbound-${index}`;
    for (const field of legacyInboundSniffFields) {
      if (obj[field] === undefined) continue;
      push(
        diagnostics,
        "warning",
        "inbound-legacy-sniff-deprecated",
        `/inbounds/${index}/${field}`,
        `Inbound "${tag}" — ${inboundLegacySniffMessage}`,
      );
      break;
    }
    if (typeof obj.domain_strategy === "string" && obj.domain_strategy.length > 0) {
      push(
        diagnostics,
        "warning",
        "inbound-legacy-domain-strategy-deprecated",
        `/inbounds/${index}/domain_strategy`,
        `Inbound "${tag}" — ${inboundLegacyDomainStrategyMessage}`,
      );
    }
  });

  // W33: scaffold/template placeholder secrets (REPLACE_ME…, change-me) must be replaced before use.
  const placeholderSecret = /^(replace_me|change[-_]?me)/i;
  const secretFields = ["password", "auth_key", "token", "private_key", "psk", "uuid", "secret_key", "auth_str"];
  const scanSecretFields = (record: Record<string, unknown>, path: string, label: string) => {
    for (const field of secretFields) {
      const value = record[field];
      if (typeof value === "string" && placeholderSecret.test(value.trim())) {
        push(
          diagnostics,
          "warning",
          "placeholder-secret",
          `${path}/${field}`,
          `${label} still uses the scaffold placeholder secret "${value}" in \`${field}\`; replace it before exporting or exposing the config.`,
        );
      }
    }
  };
  const scanPlaceholders = (entity: Record<string, unknown> | undefined, path: string, label: string) => {
    if (!entity || typeof entity !== "object") return;
    scanSecretFields(entity, path, label);
    // A27-rest: most inbound protocols (trojan/vmess/vless/hysteria2/tuic) carry credentials in a
    // per-user array, so descend into users[].password / uuid / … rather than only the entity top level.
    const users = entity.users;
    if (Array.isArray(users)) {
      users.forEach((user, userIndex) => {
        if (!user || typeof user !== "object") return;
        const record = user as Record<string, unknown>;
        const name =
          typeof record.name === "string" && record.name
            ? record.name
            : typeof record.username === "string" && record.username
              ? record.username
              : userIndex + 1;
        scanSecretFields(record, `${path}/users/${userIndex}`, `${label} user "${name}"`);
      });
    }
  };
  listItems(config.outbounds).forEach((outbound, index) =>
    scanPlaceholders(outbound as Record<string, unknown>, `/outbounds/${index}`, `Outbound "${outbound.tag ?? index}"`),
  );
  listItems(config.inbounds).forEach((inbound, index) =>
    scanPlaceholders(inbound as Record<string, unknown>, `/inbounds/${index}`, `Inbound "${inbound.tag ?? index}"`),
  );

  // C1-20: a string `http_client` reference must point to an existing top-level http_clients[] tag.
  // (Object-form http_client is inline and carries no tag, so it is skipped.)
  const httpClientTags = getHttpClientTags(config);
  const routeObj = config.route as Record<string, unknown> | undefined;
  if (routeObj && typeof routeObj === "object" && !Array.isArray(routeObj)) {
    if (typeof routeObj.default_http_client === "string" && routeObj.default_http_client && !httpClientTags.has(routeObj.default_http_client)) {
      push(
        diagnostics,
        "error",
        "missing-http-client",
        "/route/default_http_client",
        `route.default_http_client references missing HTTP client "${routeObj.default_http_client}".`,
      );
    }
  }
  listItems(config.route?.rule_set).forEach((ruleSet, index) => {
    const ref = (ruleSet as Record<string, unknown>).http_client;
    if (typeof ref === "string" && ref && !httpClientTags.has(ref)) {
      push(
        diagnostics,
        "error",
        "missing-http-client",
        `/route/rule_set/${index}/http_client`,
        `Rule-set ${index + 1} references missing HTTP client "${ref}".`,
      );
    }
  });
  listItems(config.certificate_providers).forEach((provider, index) => {
    const ref = (provider as Record<string, unknown>).http_client;
    if (typeof ref === "string" && ref && !httpClientTags.has(ref)) {
      const tag = (provider as Record<string, unknown>).tag;
      push(
        diagnostics,
        "error",
        "missing-http-client",
        `/certificate_providers/${index}/http_client`,
        `Certificate provider "${typeof tag === "string" ? tag : index}" references missing HTTP client "${ref}".`,
      );
    }
  });

  // V1: data-driven enum/type validation of scalar fields (last, so its errors join the export gate).
  validateScalarFields(config, diagnostics, { channel, version });
  // V3: structurally-required tags (rule_set / http_clients) — sing-box rejects these when blank.
  validateRequiredTags(config, diagnostics);
  // VT3: data-driven testing-only field backstop (runs last so it can dedup against the hand-written gates).
  checkTestingOnlyFields(config, channel, diagnostics);

  return diagnostics;
}

export function summarizeDiagnostics(diagnostics: Diagnostic[]): "valid" | "warning" | "error" {
  if (diagnostics.some((diagnostic) => diagnostic.level === "error")) return "error";
  if (diagnostics.some((diagnostic) => diagnostic.level === "warning")) return "warning";
  return "valid";
}
