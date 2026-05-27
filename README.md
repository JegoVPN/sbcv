# sbcv — a visual editor for sing-box configs

**Stop hand-writing sing-box JSON.** [sbcv.app](https://sbcv.app) is a browser-based, drag-and-drop visual editor that turns a 600-line sing-box config into a graph you can see, edit, and validate without leaving the tab.

Free. Open source (MIT). 100% client-side — your config never leaves your browser.

> _"`duplicate outbound/endpoint tag: direct` — but which line?"_  
> _"I followed the 1.12 → 1.14 migration doc and now I get `FATAL detour to an empty direct outbound makes no sense`."_  
> _"My DNS rule matches `geoip-cn` but the route still sends traffic through the proxy."_
>
> If any of these hurt, sbcv was built for you.

---

## Why use it

### 1. No more JSON — drag, connect, done

Every field that should be an enum **is** an enum. `tcp` / `udp`, `reject` / `route` / `route-options`, vless `xtls-rprx-vision`, shadowsocks's 13 cipher methods, naive `bbr` / `bbr2` / `cubic` / `reno`, shadowtls v1 / v2 / v3, anytls padding schemes — all of it is a `<select>`. Typos that used to silently break configs are now impossible.

Drag a Route Rule node from the palette → pull a wire to the Direct outbound → pull another wire to the `geoip-cn` rule-set. That's a new routing rule. The JSON updates live in the right panel.

### 2. 60+ diagnostics — including 14 deprecation warnings spanning sing-box 1.10 → 1.14

Every diagnostic carries a JSON path, a severity, and a one-line fix.

**1.10 →** legacy `tun.inet4_address` / `inet6_address` split fields → migrate to `address[]`.

**1.11 →** `outbound: { type: "block" }` → `route.rules[].action: "reject"`. `outbound: { type: "dns" }` → `hijack-dns` rule action. `outbound: { type: "wireguard" }` → `endpoints[]`. Inbound `sniff` / `sniff_timeout` / `domain_strategy` → route rule actions. Direct outbound `override_address` / `override_port` → route-options action.

**1.12 →** schema-prefixed `dns.servers[].address: "tcp://..."` / `"https://..."` / `"dhcp://..."` → typed `type` + `server`. DNS rule `outbound:` matcher → per-outbound `domain_resolver`. Outbound `domain_strategy` → `domain_resolver`. Top-level `dns.fakeip` → typed FakeIP server.

**1.14 →** inline `tls.acme` → `certificate_provider`. DNS rule `ip_cidr` / `ip_is_private` without `match_response: true` → `evaluate` action. Mixing modern `ip_version` / `query_type` with legacy `ip_cidr` (sing-box 1.14+ refuses to start on this — caught as `error`). Hysteria v1 in inbound + outbound. `cache_file.store_rdrc` → `store_dns`.

Plus 11 channel-gate checks — e.g. SSH outbound `cipher` / `mac` / `kex_algorithm` are 1.14-testing only; setting them on a 1.12 stable target lights up before you ever click Check.

### 3. Validate against sing-box 1.12 / 1.13 / 1.14 binaries — no install needed

The "Check" button runs **two validators in parallel**:

- Local — semantic linter (60+ diagnostics, runs in your browser, ~250ms).
- Remote — official `sing-box check` against your selected target binary, executed in a Cloudflare Container. Three binaries are pre-baked: `1.12-stable` (legacy), `1.13-stable`, `1.14-testing`. Pick a target in the top bar, hit Check, get a verdict in seconds.

You never install sing-box. You never deploy to a VPS to test a config. You never wonder _"does this work on 1.13?"_ — you just pick `1.13-stable` and check.

---

## Use it

Just open **[https://sbcv.app](https://sbcv.app)**. There's nothing to install.

1. Pick a target sing-box version in the top bar (`1.13 stable` is the default).
2. Load a community template, paste an existing JSON, or start from a minimal scaffold.
3. Drag nodes from the left palette. Connect ports with wires. Edit fields in the right inspector.
4. Click **Check** to validate both locally and against the real sing-box binary.
5. Click **Export** to download the resulting JSON.

Configs never persist server-side. Close the tab and everything is gone. The official-check round-trip ships the JSON to a Cloudflare Container, runs `sing-box check`, returns the verdict, and discards the input.

---

## Run it yourself

```bash
git clone https://github.com/JegoVPN/SBC
cd SBC
pnpm install
pnpm dev    # http://localhost:5173
```

Useful scripts:

```bash
pnpm build              # tsc -b && vite build → dist/
pnpm test               # vitest, 430+ regression tests
pnpm e2e                # playwright
pnpm validate:fixtures  # parses every committed JSON fixture
pnpm release:check      # full pre-release gate
```

For local fixture validation against real sing-box binaries, drop them at `.tools/bin/sing-box-stable` and `.tools/bin/sing-box-testing` (or have them on `PATH`). Without binaries the fixture validator falls back to JSON-only parsing.

---

## How it works (one paragraph)

Vite + React + [React Flow](https://reactflow.dev) for the canvas; Zustand for state; TypeScript strict. The canvas is **not** the source of truth — a canonical sing-box JSON + a validated domain model is. The graph is derived from the JSON on every change, so import → edit → export round-trips faithfully. Diagnostics are pure functions over the domain model, so the same code that powers the live inspector also feeds the static linter. The remote validator is a tiny Cloudflare Worker that fans configs out to three Container instances (one per sing-box version). No database, no account, no telemetry.

---

## Contributing

Issues and PRs welcome. Particularly useful kinds of feedback:

- _"This 1.13-testing field is missing from the inspector."_ — open an issue with the field name + sing-box doc link.
- _"My provider's subscription JSON breaks the importer."_ — attach a redacted copy; we'll add a fixture.
- _"This diagnostic is a false positive on my config."_ — open an issue with the offending JSON snippet.

Every code change ships with a regression test. See [AGENTS.md](AGENTS.md) for the working contract and [docs/sbc-react-flow-rd-plan.md](docs/sbc-react-flow-rd-plan.md) for the architecture overview.

---

## Acknowledgements

sbcv is a love letter to [SagerNet/sing-box](https://github.com/SagerNet/sing-box). The sing-box team maintains the engine; we just make its configuration easier to live with. None of this exists without their work.

Default community templates (`xmdhs/clash2sfa`, `catbox uw17zj`, `Toperlock/sing-box-subscribe`) are credited inline in [src/domain/templates.ts](src/domain/templates.ts).

---

## License

MIT © 2026 JegoVPN. See [LICENSE](LICENSE).

---

🟢 Live: **[sbcv.app](https://sbcv.app)** — questions / bug reports / "you forgot this field" notes welcome on [GitHub Issues](https://github.com/JegoVPN/SBC/issues).
