# sbcv — sing-box configuration visualizer

A visual [sing-box](https://github.com/SagerNet/sing-box) configuration builder for editing canonical JSON configs with a React Flow canvas, route rules, DNS rules, validation, import, and export.

[**sbcv.app**](https://sbcv.app) · Free · Open source (MIT) · No install · No login

---

## What it does

Build, inspect, validate, import, and export sing-box JSON configurations through a visual canvas backed by a canonical config model.

- **Visual editor.** Drag inbounds, outbounds, endpoints, DNS servers, route rules, and rule-sets onto the canvas. Connect them with wires. Every enum is a dropdown — typos that used to break configs are impossible.
- **Canonical JSON is the source of truth.** The canvas is a derived view; edits flow through domain commands that update the canonical config. Switching between visual and raw never loses fidelity.
- **Official validation in the browser.** Hit Check and sbcv runs the real `sing-box check` binary server-side against your chosen target version (1.12 / 1.13 / 1.14). Same verdict sing-box itself would give — no local install, no VPS, no guessing.
- **Import / Export.** Paste an existing config to start editing; export back to JSON when done.
- **Open source.** MIT-licensed. Configs never persist on the server. No account, no telemetry.

---

## Use it

Open [**sbcv.app**](https://sbcv.app), pick a sing-box version in the top bar, drag nodes onto the canvas (or paste an existing config), and click **Check**. Export the resulting JSON when you're happy.

---

## Run it yourself

```bash
git clone https://github.com/JegoVPN/sbcv
cd sbcv
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # tsc -b && vite build → dist/
pnpm test         # vitest
```

Tech stack: Vite + React + [React Flow](https://reactflow.dev) + Zustand + TypeScript. The remote `sing-box check` validator is a Cloudflare Worker fanning out to three Containers (one per sing-box version).

---

## Contributing

Issues and PRs welcome. Useful kinds of feedback:

- A sing-box field is missing from the inspector → open an issue with the field name + doc link.
- A provider's subscription JSON fails to import → attach a redacted copy.
- A diagnostic is a false positive → paste the offending snippet.

---

## License

MIT © 2026. See [LICENSE](LICENSE).

Thanks to [SagerNet/sing-box](https://github.com/SagerNet/sing-box) — sbcv just makes its config easier to live with.
