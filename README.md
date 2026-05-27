# sbcv — visual sing-box config editor

A visual editor for [sing-box](https://github.com/SagerNet/sing-box) configs that runs in your browser. Drag nodes, connect them, get a working config.

**Live:** [sbcv.app](https://sbcv.app) · Free · Open source (MIT) · No install · No login

---

## What it's for

sing-box releases move fast. Every minor version deprecates fields, renames structures, and breaks old configs. If you're not living in the migration notes, your config silently stops working.

sbcv solves one thing: **let anyone build and verify a sing-box config without hand-writing JSON.**

- **Visual editor.** Drag inbounds, outbounds, DNS servers, route rules, and rule-sets onto a canvas. Connect them with wires. Every enum is a dropdown — typos that used to break configs are impossible.
- **Real validation, in the browser.** Hit Check and sbcv runs the **official `sing-box check` binary** server-side against your selected target (1.12 / 1.13 / 1.14). No local install, no VPS, no guessing — you get the same verdict sing-box itself would give.
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
