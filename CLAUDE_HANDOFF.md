# CLAUDE_HANDOFF — Lisha Liang Insurance Website

> **Point-in-time state, written 2026-09-07** for a fresh Claude Code session with no prior
> conversation history. It was produced by a read-only audit of this repository: nothing was
> committed, pushed, stashed, reset or deployed to create it.
>
> - **Workspace-wide index of every project on this Mac:** `/Users/koheikubota/CLAUDE_MASTER_HANDOFF.md`
> - **Global engineering standard (applies to this repo too):** `/Users/koheikubota/CLAUDE.md`
> - **Portable project brain (standing rules + per-project reference):** `/Users/koheikubota/.claude/projects/-Users-koheikubota/memory/` (start at `_START-HERE.md`)
> - **Also in this repo (read these — they are the authority):** `README.md`
>
> `CLAUDE.md` = durable rules. **This file = where things stand right now.** Keep it current as you
> work — that is what makes switching accounts or tools cheap. No secret values appear in this file;
> environment variables are named, never valued.

---

**Location** — `/Users/koheikubota/Desktop/Projects/lisha-website`

**Live / hosting** — **https://lishainsurance.com** — Cloudflare Pages + Pages Functions + D1.

**Status / priority** — maintenance / low

### Purpose

Marketing/personal website for Lisha Liang, a licensed Co-operators insurance agent serving Ontario, Canada. Quad-lingual UI (EN / 中文 / 日本語 / 한국어) advertising trilingual client service (English, Mandarin, Cantonese), with heavy multilingual SEO (hreflang, JSON-LD InsuranceAgency + Person + FAQPage, OG tags, and an extremely large multilingual keywords meta tag). It is LIVE at https://lishainsurance.com and is a real client-facing lead-generation site, not a demo.

### Tech stack

Single-file static site — index.html (174,888 bytes, 1815 lines) with inline CSS and inline JS, no build step, no node_modules, no package.json. Google Fonts (Playfair Display + Inter). Hosted on Cloudflare Pages with two Pages Functions (functions/log.js, functions/visits.js) backed by Cloudflare D1. Contact form posts to a third-party form relay (formsubmit.co) rather than to any backend. Uptime watchdog is bash + systemd running on the Vultr VPS.

### Repository / git status

- **Repo root:** `/Users/koheikubota/Desktop/Projects/lisha-website`
- **Branch:** main — in sync with origin/main (git rev-list --left-right --count origin/main...main = 0 0), origin/main = 981b068 (2026-04-20 10:42:37 -0400). Remote: origin = https://github.com/lilbreadxiaomianbao/lisha-website.git
- **Uncommitted:** No modified tracked files. 2 untracked directories: deploy/ (alert.sh, systemd/lisha-uptime.service, systemd/lisha-uptime.timer, systemd/lisha-alert@.service) and scripts/ (uptime.sh). Both dated 2026-04-18 16:52-16:53 — two days BEFORE the last commit (2026-04-20), so they were deliberately or accidentally left out of that commit. Nothing else is dirty; there is no .env in the working copy.

### Last work performed

981b068 — 2026-04-20 10:42:37 -0400 "Add live-now view to /visits (Mianbao-style real-time presence)" (functions/log.js +44/-, functions/visits.js +172, index.html +42, schema.sql +6; 212 insertions, 52 deletions). It was the third of three same-day visitor-tracking commits: 3fcd113 "Add visitor tracking: Pages Function + D1 + password-protected viewer", 53780c3 "Visits panel: render times in New York (ET) instead of UTC", then 981b068. Before that: e87a949 (2026-04-18) italic 'Liang' hero accent, 4bca34a (2026-04-18) title corrected to "insurance agent, not advisor" + hero shrink, 4fe98fd (2026-04-18) wired the contact form to FormSubmit, c1d4a9e (2026-04-17) mobile round 3, ba48d79 + 7921696 (2026-04-16) mobile/desktop scale passes, 84e7de0 (2026-04-16) "Launch Lisha Liang website v1". The untracked deploy/ + scripts/ watchdog files are dated 2026-04-18 and were installed on the VPS as /opt/lisha-website/ (confirmed by memory/feedback_supabase_ops_alerts.md, which lists /opt/lisha-website/deploy/alert.sh among the six alert.sh files it patched on 2026-04-18).

### How to run

```
No build step and no package.json — open /Users/koheikubota/Desktop/Projects/lisha-website/index.html directly in a browser for markup/CSS work. To exercise the Pages Functions and D1 locally you need Wrangler (`npx wrangler pages dev .`) — UNVERIFIED, that command is not documented anywhere in the repo and wrangler is not vendored here. Deploy: not documented in the repo; wrangler.toml declares `name = "lishainsurance"` and `pages_build_output_dir = "."`, and functions/visits.js quotes `npx wrangler pages secret put VISITS_PASSWORD --project-name=lishainsurance`, so the project is Cloudflare Pages project "lishainsurance" — most likely git-connected (push to main auto-deploys) or `npx wrangler pages deploy . --project-name=lishainsurance`. UNVERIFIED which. D1 schema: schema.sql must be applied to the D1 database `lishainsurance-visits` (binding DB, database_id 095bcb8b-940d-4b7b-9718-1d954de2a265) — the apply command is not documented in the repo. Uptime check (safe, read-only, runs anywhere with curl): `./scripts/uptime.sh` or `./scripts/uptime.sh https://lishainsurance.com`. On the VPS it runs as the systemd unit lisha-uptime.service every 5 minutes via lisha-uptime.timer, from /opt/lisha-website.
```

### Architecture

Three pieces. (1) The site: one 175KB index.html serving all content and all four UI languages, with a language switcher, a sticky 'why' section, a chat FAB, and a contact form that POSTs directly to https://formsubmit.co/<agent email> (line 1047) with a JS handler that shows a Sending… state and a thank-you banner on the success redirect. (2) Visitor tracking: an inline IIFE at index.html:1781-1811 mints a per-tab session id in sessionStorage ('ll_sid', 8 random bytes hex), POSTs {sid, path, referrer, lang} to /log on first load, then every 25s while the tab is visible plus on visibilitychange. functions/log.js (Pages Function, onRequestPost) enriches with cf.country/city/region, cf-connecting-ip, user-agent, and a mobile/tablet/desktop guess, then either UPDATEs last_ping for a sid seen within the last hour (heartbeat) or INSERTs a new visits row; returns 204 with access-control-allow-origin: *; non-POST returns 405. (3) The viewer: functions/visits.js (onRequestGet) serves /visits behind HTTP Basic auth (username ignored, password compared against the VISITS_PASSWORD secret) and renders an HTML dashboard with a LIVE NOW panel (a session is live if last_ping is within 45s), summary counts (total, unique IPs, 1d/7d/30d), and a recent-visits table with country flags, times rendered in America/New_York; it also serves ?format=json (full) and ?format=live (live slice only, polled by the page every 4s), with limit default 200 / max 2000. Storage: Cloudflare D1 table `visits` (schema.sql) with columns id, ts, ip, country, city, region, ua, lang, path, referrer, device, sid, last_ping and five indexes (ts DESC, ip, country, sid, last_ping DESC). (4) Monitoring (untracked, deployed to /opt/lisha-website on 149.28.37.35): scripts/uptime.sh asserts HTTP 200 within 10s, that the body still contains the strings "Lisha", "Co-operators", "Ontario", "Contact", and that the body is at least 50000 bytes (the real page is ~170KB) — a content-drift guard, not just a ping. On failure systemd fires lisha-alert@uptime.service → deploy/alert.sh → /var/log/lisha-alerts.log (+ the Supabase ops_alerts mirror that exists only in the deployed copy).

### Completed work

- Site launched 2026-04-16 (84e7de0) and iterated through three mobile/desktop layout passes (7921696, ba48d79, c1d4a9e)
- Contact form wired to FormSubmit so it actually delivers leads (4fe98fd)
- Copy correction: Lisha's title is "insurance agent", not "advisor" (4bca34a) — note the README still says "Advisor" in its heading
- Full multilingual SEO: hreflang, JSON-LD (InsuranceAgency + Person + FAQPage), OG tags, and a very large multilingual keyword set covering EN/zh/ja/ko/fr/pa/hi/es/it/ur/tl/ar/pt/ta/ru/pl/vi
- Visitor tracking end to end: Pages Function + D1 table + password-protected /visits viewer (3fcd113), ET timezone rendering (53780c3), and a live-now real-time presence panel with 25s client heartbeats and 4s dashboard polling (981b068)
- Uptime + content-drift watchdog written and installed on the VPS as /opt/lisha-website/{scripts/uptime.sh,deploy/alert.sh,deploy/systemd/*} running every 5 minutes (never committed to git)
- Alert routing into the shared Supabase ops_alerts table (project key `lisha-website`), viewable at https://inbox.sakurawetdreams.com/ops/

### Current work in progress

Nothing half-written in the code itself. The one loose end is bookkeeping: the deploy/ and scripts/ directories (four systemd/bash files, dated 2026-04-18) are untracked, yet the corresponding files are installed and running on the VPS at /opt/lisha-website/. Git therefore does not contain the monitoring setup for this project. Furthermore the DEPLOYED /opt/lisha-website/deploy/alert.sh has been patched with a Supabase ops_alerts mirror block (2026-04-18, .pre-supabase.bak sibling on the server) while the LOCAL copy still has only the dead Slack path — so the local files are not merely uncommitted, they are also out of date relative to production. Correct move: ssh in, read the deployed alert.sh, port the Supabase block into the local copy, then commit both directories.

### Important decisions

- Deliberately kept as one self-contained index.html with inline CSS/JS and no build step — the README states this outright. Do not introduce a bundler, framework, or component split without asking Kohei.
- The contact form posts to formsubmit.co rather than to a backend, so the site needs no server and no secrets to collect leads.
- Visitor analytics are first-party (Cloudflare Pages Function + D1) instead of Google Analytics or a third-party tracker — consistent with the sibling Sakura Dreams decision to strip trackers and self-host fonts (memory: feedback_sakura_dreams_v14_upgrade.md).
- One row per session (UPSERT on sid within a 1-hour window) rather than one row per pageview, with last_ping powering the live view — documented in the header comment of functions/log.js.
- The /visits dashboard renders all timestamps in America/New_York, not UTC (commit 53780c3), because that is the audience's timezone.
- The uptime probe asserts brand-string presence and a >50KB body, not just HTTP 200 — it is designed to catch a truncated or error-template deploy, and the reasoning is written into scripts/uptime.sh.
- Insurance/finance projects live on the lishainsurance.com zone and must stay OFF the companionship domains (sakurawetdreams.com, sakuradreamstoronto.com) — an explicit Kohei rule recorded in memory/feedback_nginx_default_server_leak.md. kuro.lishainsurance.com and chobo.lishainsurance.com are subdomains of this same zone.

### Known issues / technical debt

- deploy/ and scripts/ are untracked while their counterparts run in production — the monitoring setup would be lost with the laptop, and the local alert.sh lacks the Supabase block the deployed one has.
- No HANDOFF.md, no CLAUDE.md, and no project memory file exists for lisha-website. The README is 695 bytes, still titles Lisha an "Advisor" (contradicting commit 4bca34a), and documents neither the visitor-tracking system, the D1 database, the /visits viewer, nor the deploy command.
- The /visits password check is a plain `pwd !== expected` string comparison (functions/visits.js), i.e. not constant-time, and the username is ignored entirely. Basic auth over HTTPS with a single shared password is the whole access-control story for a page that lists visitor IPs.
- /log is unauthenticated, has no rate limiting, and returns access-control-allow-origin: * — anyone can insert arbitrary rows into the visits table (path, referrer, lang, sid are attacker-controlled strings; sid is capped at 64 chars, the others are not length-limited). Cost/abuse risk on D1 writes, plus polluted analytics.
- The visits table stores raw IP addresses, user agents, and geolocation for every visitor with no retention/purge job in the repo — a privacy/PII exposure worth a decision, particularly for a Canadian insurance professional's site. There is no privacy-policy page in this repo at all.
- index.html is 1815 lines / 175KB in a single file, which puts it well past the 300-line-per-file rule in the global CLAUDE.md. That is a deliberate exception (see importantDecisions) but it makes edits fiddly and diffs large.
- The exact deploy path (Pages git integration vs manual wrangler pages deploy) is written down nowhere, so a fresh account cannot confidently ship a change.

### Testing status

No test framework, no test files, no CI configuration (there is no .github directory). The only automated verification is the production-side watchdog: scripts/uptime.sh (HTTP 200 within 10s + four required brand strings + >50KB body) running every 5 minutes via lisha-uptime.timer on the VPS, alerting through deploy/alert.sh into the Supabase ops_alerts table. Nothing was executed in this session — the site's current liveness is documented and strongly evidenced but UNVERIFIED by me.

### Next steps

1. ssh root@149.28.37.35, read /opt/lisha-website/deploy/alert.sh, port its Supabase ops_alerts block into the local deploy/alert.sh, then `git add deploy scripts` and commit — this is the single outstanding loose end.
2. Rewrite README.md: fix "Advisor" → "agent", and document the live URL, the Cloudflare Pages project name (lishainsurance), the D1 binding/database, how to apply schema.sql, the /visits viewer and its VISITS_PASSWORD secret, and the exact deploy command.
3. Confirm and write down how a change actually ships (is the Pages project connected to the GitHub repo, or is it manual `wrangler pages deploy`?). Until that is known, do not promise Kohei that a push is live.
4. Add basic abuse protection to functions/log.js: a length cap on path/referrer/lang, and either a Cloudflare rate-limiting rule or a simple per-IP throttle. Tighten access-control-allow-origin from * to the site's own origin.
5. Decide a retention policy for the visits table (e.g. purge rows older than 90 days) and add a scheduled Worker or a manual command for it, given the table holds IPs and user agents.
6. Make the /visits password comparison constant-time and consider putting the page behind Cloudflare Access instead of a shared Basic-auth password.
7. Create ~/.claude/projects/-Users-koheikubota/memory/project_lisha_website.md and add a one-line pointer in MEMORY.md — this project currently has no memory entry at all, which is why its details keep getting rediscovered.

### Critical context

- lishainsurance.com is a real client-facing site for a licensed insurance professional. Treat copy, credentials, and compliance-sensitive wording carefully; the "agent, not advisor" correction in 4bca34a was a real correction, and titles are regulated language.
- The lishainsurance.com Cloudflare zone is also the parent of kuro.lishainsurance.com (Kuro finance app) and chobo.lishainsurance.com (Chobo day-sheet app), both nginx vhosts on VPS 149.28.37.35. DNS changes in this zone can affect those apps. Cloudflare DNS zone id 2ce9c6ace0269bee388b6b9d53a29510, account 4ed4eb3055f8f7ab9e8bbc55c6dc57df (per memory/project_chobo.md).
- The site itself is on Cloudflare Pages, but /opt/lisha-website on the VPS exists purely to host the uptime watchdog. Do not confuse the two: there is no web server for this site on the VPS.
- Alerts do not go to Slack — the SLACK_WEBHOOK code in deploy/alert.sh is dead by design. The live sink is Supabase public.ops_alerts with project key `lisha-website`, dashboard https://inbox.sakurawetdreams.com/ops/.
- deploy/systemd/lisha-alert@.service and lisha-uptime.service both read SLACK_WEBHOOK from /opt/mianbao-leadhunter/backend/.env (EnvironmentFile with a `-` prefix so a missing file is tolerated) — that same file is where the Supabase credentials live for the shared /opt/lib/post_ops_alert.sh helper.
- This project is the source of the deploy/alert.sh + systemd watchdog pattern shared with sakurachat-server (identical structure, identical Slack-dead-code problem, both untracked).

### Secrets / environment required (names only — no values here or anywhere)

- VISITS_PASSWORD — Cloudflare Pages secret for the /visits Basic-auth gate. Set with `npx wrangler pages secret put VISITS_PASSWORD --project-name=lishainsurance` (quoted in functions/visits.js). If unset the endpoint returns HTTP 500 with that instruction rather than exposing data.
- SLACK_WEBHOOK — referenced by deploy/alert.sh and the systemd units, sourced from /opt/mianbao-leadhunter/backend/.env or /opt/lisha-website/.env on the VPS. Never set; dead code.
- SUPABASE_URL / SUPABASE_KEY — read by the server-side helper /opt/lib/post_ops_alert.sh from /opt/mianbao-leadhunter/backend/.env on 149.28.37.35.
- Cloudflare API/OAuth credentials for wrangler — held in Kohei's local wrangler config, not in this repo. Note from memory: the wrangler OAuth token has lacked dns-write permission in the past.
- No .env file exists in this repo and none is needed for the static site itself.

### Related projects

Kuro (https://kuro.lishainsurance.com) — subdomain of the same Cloudflare zone, VPS port 3200, Chobo (https://chobo.lishainsurance.com) — subdomain of the same Cloudflare zone, VPS port 3500, sakurachat-server (/Users/koheikubota/Desktop/Projects/sakurachat-server) — same untracked deploy/ + scripts/ watchdog pattern, same Supabase alert sink, mianbao-leadhunter (/opt/mianbao-leadhunter on the VPS) — origin of the alert.sh/systemd pattern and holder of the Supabase credentials; the /visits live-now panel is explicitly modelled on it ("Mianbao-style real-time presence"), Sakura Toronto (Cloudflare Workers) — the other Cloudflare-hosted property in Kohei's portfolio, but on a strictly separate domain per Kohei's rule

### Uncertain / unverified

- Whether the Cloudflare Pages project is git-connected (push-to-deploy) or deployed manually with wrangler. Nothing in the repo says, and there is no CI config.
- Whether schema.sql has actually been applied to the production D1 database, and whether the two schema columns added in 981b068 (sid, last_ping and their indexes) were applied to the live DB rather than only to the file. If not, /log writes would fail — but the watchdog only checks the marketing page, not /log, so a broken tracker could go unnoticed.
- Whether the site is up right now. I did not issue any network request. Liveness is evidenced by the README, the systemd probe URL, and the JSON-LD canonical URL, all pointing at https://lishainsurance.com.
- Whether the systemd timer is currently enabled and firing on the VPS.
- Whether Lisha herself uses /visits, and therefore how sensitive the shared password is.
