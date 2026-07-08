import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(root, "..");
const outputDir = join(repoRoot, "fixtures", "external");
const fetchTimeoutMs = 15_000;
// 320 comfortably covers the checked-in corpus (237 after the pk-box ingest) — a FULL refresh with a
// cap below the committed manifest size would silently truncate the corpus back down.
const maxAcceptedFixtures = Number(process.env.MAX_EXTERNAL_FIXTURES ?? 320);
const maxAcceptedPerRepo = Number(process.env.MAX_EXTERNAL_FIXTURES_PER_REPO ?? 30);

// CLI:
//   node scripts/update-external-fixtures.mjs                                  # full corpus rebuild
//   node scripts/update-external-fixtures.mjs --append --repo owner/name       # scoped: re-ingest ONLY
//     the named repo(s), keeping every other repo's fixtures + manifest entries untouched. Use this to
//     add or refresh a single source without churning the other ~70 upstreams (which may have moved).
// A source may carry `maxFixtures` to override the per-repo cap (legit large curated collections).
const cliArgs = process.argv.slice(2);
const appendMode = cliArgs.includes("--append");
const targetRepoNames = cliArgs.filter((arg, index) => cliArgs[index - 1] === "--repo");

const sourceRepos = [
  { repo: "Toperlock/sing-box-subscribe", include: /^config_template\/.*\.json$/, exclude: /sb-config-1\.12\.json$/ },
  // Curated per-release template collection (1.11 → 1.13.x → every 1.14 alpha, several variants each) —
  // the per-repo cap would drop the newest alphas, so it carries an explicit higher cap.
  { repo: "huixiao666/pk-box", include: /\.json$/, maxFixtures: 80 },
  { repo: "kj163kj/singbox_proxy_config", include: /\.json$/ },
  { repo: "CHIZI-0618/box4magisk", include: /\.json$/ },
  { repo: "malikshi/sing-box-examples", include: /\.json$/ },
  { repo: "baozaodetudou/mssb", include: /\.json$/ },
  { repo: "herozmy/StoreHouse", include: /\.json$/ },
  { repo: "se1jaku/sub-store-template", include: /\.json$/ },
  { repo: "TooonyChen/sbsm", include: /\.json$/ },
  { repo: "ofwh/Profiles", include: /\.json$/ },
  { repo: "Fdulo/Sing-Box-config_template", include: /\.json$/ },
  { repo: "qifei/trygit", include: /\.json$/ },
  { repo: "baiyian/sing-box-config-template", include: /\.json$/ },
  { repo: "HideinOSS/sing-box-configuration-examples", include: /\.json$/ },
  { repo: "chika0801/sing-box-examples", include: /\.json$/ },
  { repo: "TheyCallMeSecond/config-examples", include: /\.json$/ },
  { repo: "IPTUNNELS/IPTUNNELS", include: /\.json$/ },
  { repo: "iStrom01/sing-box-config-template", include: /\.json$/ },
  { repo: "lowercase78/sing-box-configs", include: /\.json$/ },
  { repo: "Use4Free/breakfree", include: /^templates\/.*\.json$/ },
  { repo: "demarcush/breakfree", include: /^templates\/.*\.json$/ },
  { repo: "Quart233/SingBoxMerge", include: /\.json$/ },
  { repo: "gg4924/sing-box-subscribe", include: /\.json$/ },
  { repo: "IvanSolis1989/Smart-Config-Kit", include: /\.json$/ },
  { repo: "aleskxyz/serverless", include: /\.json$/ },
  { repo: "huskydsb/singbox-for-sub-store-template", include: /\.json$/ },
  { repo: "Lorcha-Wu/sing-box-rules", include: /\.json$/ },
  { repo: "agustyuzu/confexamples", include: /\.json$/ },
  { repo: "FeiaoLin/ios_rule", include: /\.json$/ },
  { repo: "LGYT-KTPD/atuo-singbox", include: /\.json$/ },
  { repo: "suming1992/sing-box", include: /\.json$/ },
  { repo: "hzyhzc/clashrule", include: /\.json$/ },
  { repo: "kongkongklng/sing-box_config", include: /\.json$/ },
  { repo: "FincerDW/opooss_ini", include: /\.json$/ },
  { repo: "akiyamamio0921/sing-box_self", include: /\.json$/ },
  { repo: "maladr/boxjs", include: /\.json$/ },
  { repo: "whiskyrye/Rules", include: /\.json$/ },
  { repo: "lucky-cry/ruleset", include: /\.json$/ },
  { repo: "djangoHuu/rule", include: /\.json$/ },
  { repo: "SeanTo/demo", include: /\.json$/ },
  { repo: "Ptechgithub/configs", include: /\.json$/ },
  { repo: "BehradJi/Clash", include: /\.json$/ },
  { repo: "FailedTech/S-UI", include: /\.json$/ },
  { repo: "Star-Trails/sing-box-config-example", include: /\.json$/ },
  { repo: "HuSheng916/Sing-box-template", include: /\.json$/ },
  { repo: "adwzlad/AAcustom", include: /\.json$/ },
  { repo: "AliceHanako/sing-box-rules", include: /\.json$/ },
  { repo: "Archon-D/Config", include: /\.json$/ },
  { repo: "BroCepage/BroCepage", include: /\.json$/ },
  { repo: "Keavte/clash-and-sing-box", include: /\.json$/ },
  { repo: "KurococLiu/momo-config", include: /\.json$/ },
  { repo: "ReturnFI/Blitz", include: /\.json$/ },
  { repo: "jioson1/gvze", include: /\.json$/ },
  { repo: "lagzian/SS-Collector", include: /\.json$/ },
  { repo: "ionscloud/sing-box-user", include: /\.json$/ },
  { repo: "proxyfree/proxyfree.github.io", include: /\.json$/ },
  { repo: "androidjiasuqi/androidjiasuqi.github.io", include: /\.json$/ },
  { repo: "v2raynnodes/v2raynnodes.github.io", include: /\.json$/ },
  { repo: "gjkevin2/vss", include: /\.json$/ },
  { repo: "aviapan/proxy", include: /\.json$/ },
  { repo: "axiba04/Proxy", include: /\.json$/ },
  { repo: "wikm360/xray-client", include: /\.json$/ },
  { repo: "ooztxoo/proxy_config", include: /\.json$/ },
  { repo: "kisso-svg/templates", include: /\.json$/ },
  { repo: "panlingjin/proxyRuleSet", include: /\.json$/ },
  { repo: "spenserlucy/Sing-box-rule", include: /\.json$/ },
  { repo: "tangnahuaite/sing-box_Route-rules", include: /\.json$/ },
  { repo: "yeqiu233/config_template", include: /\.json$/ },
];

const ignoredPath = /(^|\/)(package-lock|package|tsconfig|components|schema|manifest|providers)\.json$/i;
const singBoxTopLevel = new Set([
  "log",
  "dns",
  "ntp",
  "certificate",
  "certificate_providers",
  "http_clients",
  "endpoints",
  "inbounds",
  "outbounds",
  "route",
  "services",
  "experimental",
]);

const mockOutbounds = [
  { type: "socks", tag: "mock-hk-01", server: "203.0.113.11", server_port: 1080 },
  { type: "socks", tag: "mock-jp-01", server: "203.0.113.12", server_port: 1080 },
  { type: "socks", tag: "mock-sg-01", server: "203.0.113.13", server_port: 1080 },
];

function authHeaders() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  return {
    accept: "application/vnd.github+json",
    "user-agent": "sbc-external-fixture-ingest",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function githubApi(path) {
  const response = await fetchWithTimeout(`https://api.github.com/${path}`, { headers: authHeaders() });
  if (!response.ok) throw new Error(`GitHub API failed ${response.status}: ${path}`);
  return response.json();
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function fetchRaw(repo, commit, path) {
  // The contents API honors the auth token (raw.githubusercontent.com does not), so bulk ingests
  // stop tripping the anonymous rate limit (observed 429s at ~50 unauthenticated raw fetches).
  const url = `https://api.github.com/repos/${repo}/contents/${encodePath(path)}?ref=${commit}`;
  const response = await fetchWithTimeout(url, {
    headers: { ...authHeaders(), accept: "application/vnd.github.raw" },
  });
  if (!response.ok) throw new Error(`Raw fetch failed ${response.status}: ${repo}/${path}`);
  return response.text();
}

function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

function slug(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 96);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSingBoxLike(config) {
  if (!isObject(config)) return false;
  const keys = Object.keys(config);
  const knownKeys = keys.filter((key) => singBoxTopLevel.has(key));
  if (knownKeys.length < 2) return false;
  return Boolean(config.inbounds || config.outbounds || config.route || config.dns);
}

function detectVersion(path, config) {
  const text = `${path} ${JSON.stringify(config).slice(0, 2000)}`;
  const match = text.match(/(?:sing-box[-_ ]?|v|version[^\d]*)(1\.(?:11|12|13|14))(?:\.0)?/i);
  if (match?.[1]) return match[1];
  if (/1\.14|http_clients|match_response/.test(text)) return "1.14";
  if (/1\.13|default_domain_resolver/.test(text)) return "1.13";
  if (/1\.12|anytls/.test(text)) return "1.12";
  if (/1\.11/.test(text)) return "1.11";
  return "unknown";
}

function classify(version, path, config) {
  const serialized = JSON.stringify(config);
  const hasTemplateExtension =
    serialized.includes("\"filter\"") ||
    serialized.includes("{all}") ||
    /config_template|sub-store|subscribe|template/i.test(path);
  if (version === "1.14") return hasTemplateExtension ? "testing-extension" : "testing";
  if (version === "1.13") return hasTemplateExtension ? "stable-extension" : "stable";
  if (version === "1.12" || version === "1.11") return "legacy";
  return hasTemplateExtension ? "display-extension" : "display";
}

function shouldRedactServer(path) {
  if (path.at(-1) !== "server") return false;
  return path.includes("outbounds") || (path.includes("dns") && path.includes("servers"));
}

function redactScalar(key, value, path) {
  if (typeof value !== "string") return value;
  const lower = key.toLowerCase();
  if (shouldRedactServer(path)) return path.includes("dns") ? "1.1.1.1" : "example.com";
  if (lower === "uuid") return "00000000-0000-4000-8000-000000000000";
  if (lower.includes("password") || lower === "passwd") return "sbc-test-password";
  if (lower.includes("private_key")) return "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  if (lower.includes("public_key")) return "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  if (lower.includes("secret") || lower.includes("token")) return "sbc-test-token";
  if (lower === "short_id") return "0123456789abcdef";
  return value;
}

function redactSecrets(value, key = "", path = []) {
  if (Array.isArray(value)) return value.map((item, index) => redactSecrets(item, key, [...path, String(index)]));
  if (!isObject(value)) return redactScalar(key, value, path);
  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      redactSecrets(entryValue, entryKey, [...path, entryKey]),
    ]),
  );
}

function expandSubscriptionPlaceholders(config) {
  const transformations = [];
  const outbounds = Array.isArray(config.outbounds) ? config.outbounds : [];
  const existingTags = new Set(outbounds.map((outbound) => outbound?.tag).filter(Boolean));
  const mockTags = mockOutbounds.map((outbound) => outbound.tag);
  let needsMocks = false;

  config.outbounds = outbounds.map((outbound) => {
    if (!isObject(outbound)) return outbound;
    if (outbound.type !== "selector" && outbound.type !== "urltest") return outbound;

    const current = Array.isArray(outbound.outbounds) ? outbound.outbounds : [];
    const expanded = current.flatMap((tag) => (tag === "{all}" ? mockTags : tag));
    if (current.includes("{all}")) {
      needsMocks = true;
      transformations.push("expand-all-placeholder");
    }
    if (expanded.length === 0) {
      needsMocks = true;
      transformations.push("fill-empty-selector-with-mock-outbounds");
      return { ...outbound, outbounds: mockTags };
    }
    return { ...outbound, outbounds: expanded };
  });

  if (needsMocks) {
    config.outbounds.push(...mockOutbounds.filter((outbound) => !existingTags.has(outbound.tag)));
  }

  return [...new Set(transformations)];
}

function validateShape(config) {
  const errors = [];
  for (const [key, list] of [
    ["inbounds", config.inbounds],
    ["outbounds", config.outbounds],
    ["certificate_providers", config.certificate_providers],
    ["http_clients", config.http_clients],
    ["endpoints", config.endpoints],
    ["services", config.services],
    ["route.rules", config.route?.rules],
    ["route.rule_set", config.route?.rule_set],
    ["dns.servers", config.dns?.servers],
    ["dns.rules", config.dns?.rules],
  ]) {
    if (list !== undefined && !Array.isArray(list)) {
      errors.push(`${key} is not an array`);
    }
  }

  for (const [key, list] of [
    ["inbounds", config.inbounds],
    ["outbounds", config.outbounds],
    ["dns.servers", config.dns?.servers],
  ]) {
    if (!Array.isArray(list)) continue;
    list.forEach((item, index) => {
      if (isObject(item) && item.tag !== undefined && typeof item.tag !== "string") {
        errors.push(`${key}[${index}].tag is not a string`);
      }
      if (isObject(item) && item.type !== undefined && typeof item.type !== "string") {
        errors.push(`${key}[${index}].type is not a string`);
      }
    });
  }
  return errors;
}

async function collectCandidates(source) {
  const repo = await githubApi(`repos/${source.repo}`);
  const commit = await githubApi(`repos/${source.repo}/commits/${repo.default_branch}`);
  const tree = await githubApi(`repos/${source.repo}/git/trees/${commit.sha}?recursive=1`);
  return tree.tree
    .filter((entry) => entry.type === "blob")
    .filter((entry) => source.include.test(entry.path))
    .filter((entry) => !source.exclude?.test(entry.path))
    .filter((entry) => !ignoredPath.test(entry.path))
    .map((entry) => ({
      repo: source.repo,
      defaultBranch: repo.default_branch,
      sourceCommit: commit.sha,
      path: entry.path,
    }));
}

async function main() {
  const activeSources = targetRepoNames.length
    ? sourceRepos.filter((source) => targetRepoNames.includes(source.repo))
    : sourceRepos;
  if (targetRepoNames.length && activeSources.length !== targetRepoNames.length) {
    const known = new Set(sourceRepos.map((source) => source.repo));
    const unknown = targetRepoNames.filter((name) => !known.has(name));
    throw new Error(`--repo names not registered in sourceRepos: ${unknown.join(", ")} — register them first.`);
  }
  if (appendMode && targetRepoNames.length === 0) {
    throw new Error("--append requires at least one --repo; a full rebuild must not run in append mode.");
  }
  if (!appendMode && targetRepoNames.length > 0) {
    // Without this guard, `--repo X` alone would wipe the whole corpus and rebuild only X.
    throw new Error("--repo requires --append; a full rebuild ignores repo filters and would drop every other repo's fixtures.");
  }

  const manifest = [];
  const rejected = [];
  if (appendMode) {
    // Scoped refresh: keep every non-targeted repo's fixtures + manifest/rejected entries verbatim,
    // drop the targeted repos' old outputs, and re-ingest only those repos below.
    const targeted = new Set(targetRepoNames);
    const existingManifest = JSON.parse(readFileSync(join(outputDir, "manifest.json"), "utf8"));
    for (const item of existingManifest) {
      if (targeted.has(item.source_repo)) {
        rmSync(join(repoRoot, item.fixture_path), { force: true });
      } else {
        manifest.push(item);
      }
    }
    const rejectedPath = join(outputDir, "rejected.json");
    if (existsSync(rejectedPath)) {
      for (const item of JSON.parse(readFileSync(rejectedPath, "utf8"))) {
        const repo = item.source_repo ?? String(item.source ?? "").split("/").slice(0, 2).join("/");
        if (!targeted.has(repo)) rejected.push(item);
      }
    }
  } else {
    rmSync(outputDir, { recursive: true, force: true });
    mkdirSync(outputDir, { recursive: true });
  }

  const seenHashes = new Set(manifest.map((item) => item.normalized_hash));
  const acceptedByRepo = new Map();
  for (const item of manifest) {
    acceptedByRepo.set(item.source_repo, (acceptedByRepo.get(item.source_repo) ?? 0) + 1);
  }

  sourceLoop: for (const source of activeSources) {
    if (manifest.length >= maxAcceptedFixtures) break;
    const repoCap = source.maxFixtures ?? maxAcceptedPerRepo;
    let candidates = [];
    try {
      candidates = await collectCandidates(source);
    } catch (error) {
      rejected.push({ source_repo: source.repo, reason: "tree-fetch-failed", detail: String(error) });
      continue;
    }

    for (const candidate of candidates) {
      if (manifest.length >= maxAcceptedFixtures) {
        console.warn(
          `WARN: total fixture cap (${maxAcceptedFixtures}) reached at ${candidate.repo}/${candidate.path} — remaining candidates are skipped WITHOUT rejected.json entries. Raise MAX_EXTERNAL_FIXTURES if this is a real ingest.`,
        );
        break sourceLoop;
      }
      const repoAcceptedCount = acceptedByRepo.get(candidate.repo) ?? 0;
      if (repoAcceptedCount >= repoCap) {
        rejected.push({ source: `${candidate.repo}/${candidate.path}`, reason: "repo-fixture-cap" });
        continue;
      }

      const sourceId = `${candidate.repo}/${candidate.path}`;
      try {
        const raw = await fetchRaw(candidate.repo, candidate.sourceCommit, candidate.path);
        if (raw.length > 1_000_000) {
          rejected.push({ source: sourceId, reason: "too-large" });
          continue;
        }

        const parsed = JSON.parse(raw);
        if (!isSingBoxLike(parsed)) {
          rejected.push({ source: sourceId, reason: "not-sing-box-config" });
          continue;
        }

        const config = redactSecrets(structuredClone(parsed));
        const transformations = expandSubscriptionPlaceholders(config);
        const shapeErrors = validateShape(config);
        if (shapeErrors.length > 0) {
          rejected.push({ source: sourceId, reason: "invalid-shape", detail: shapeErrors.join("; ") });
          continue;
        }

        const normalized = `${JSON.stringify(config)}\n`;
        const normalizedHash = hashText(normalized);
        if (seenHashes.has(normalizedHash)) {
          rejected.push({ source: sourceId, reason: "duplicate" });
          continue;
        }
        seenHashes.add(normalizedHash);

        const version = detectVersion(candidate.path, config);
        const fixtureClass = classify(version, candidate.path, config);
        const idBase = slug(`${candidate.repo}-${candidate.path}`);
        const id = `${idBase}-${normalizedHash.slice(0, 8)}`;
        const fixturePath = `fixtures/external/${id}.json`;
        writeFileSync(join(repoRoot, fixturePath), normalized);

        manifest.push({
          id,
          source_repo: candidate.repo,
          source_path: candidate.path,
          source_commit: candidate.sourceCommit,
          fixture_path: fixturePath,
          normalized_hash: normalizedHash,
          detected_version: version,
          channel: version === "1.14" ? "testing" : "stable",
          fixture_class: fixtureClass,
          transformations,
          expected_gates: [
            "json-parse",
            "import",
            "derive-graph",
            "diagnostics",
            "render",
            "json-round-trip",
            "export",
          ],
          official_check: null,
          counts_toward_200: true,
        });
        acceptedByRepo.set(candidate.repo, repoAcceptedCount + 1);
      } catch (error) {
        rejected.push({ source: sourceId, reason: "ingest-failed", detail: String(error) });
      }
    }
  }

  manifest.sort((a, b) => a.id.localeCompare(b.id));
  rejected.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  writeFileSync(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(outputDir, "rejected.json"), `${JSON.stringify(rejected, null, 2)}\n`);

  const byClass = manifest.reduce((counts, item) => {
    counts[item.fixture_class] = (counts[item.fixture_class] ?? 0) + 1;
    return counts;
  }, {});
  writeFileSync(
    join(outputDir, "compatibility-report.md"),
    [
      "# External Fixture Compatibility Report",
      "",
      `Accepted fixtures: ${manifest.length}`,
      `Rejected/quarantined candidates: ${rejected.length}`,
      "",
      "## Accepted By Class",
      "",
      ...Object.entries(byClass)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, count]) => `- ${key}: ${count}`),
      "",
      "## Notes",
      "",
      "- Fixtures are deterministic snapshots from public GitHub repositories.",
      "- Secrets and credentials are redacted during ingestion.",
      "- Empty selector/urltest provider pools and `{all}` subscription placeholders are expanded into mock SOCKS outbounds.",
      `- Fixture generation is capped at ${maxAcceptedFixtures} accepted fixtures and ${maxAcceptedPerRepo} accepted fixtures per source repository to keep CI bounded.`,
      "- `official_check` is `null` until a fixture is classified as version-matched official-compatible.",
      "- Rejected candidates do not count toward the 200 accepted fixture goal.",
      "",
    ].join("\n"),
  );
}

await main();
