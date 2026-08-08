# Discord Bot Integration Template - lintasAI

> Untuk tim yang pakai Discord sebagai komunikasi utama (instead of Slack/Signal).
> Audience: Owner setup, staff pakai.

---

## Bagian 1: Discord Server Structure Recommended

Bikin Discord server untuk project kamu (atau project apapun) dengan channel struktur:

```
[ akses Server ]

ANNOUNCEMENTS
├── #announcements (owner only post)
└── #releases (deploy notifications auto)

DISCUSSION
├── #general (chit-chat, non-work)
├── #<project>-help (Q&A staff <-> owner)
└── #<project>-design (UI/UX discussion + Figma share)

TASK MANAGEMENT
├── #<project>-task (owner post task baru)
├── #<project>-review (PR review request, links)
└── #<project>-daily (async daily standup)

NOTIFICATIONS (bot-driven)
├── #ci-builds (GitHub Action results)
├── #vercel-deploys (deploy success/fail)
└── #pr-events (PR opened/merged/closed)

BOT COMMANDS
└── #bot-commands (slash commands to bot)
```

Tools digital analogi: kayak struktur folder Google Drive yang clear per topik. Bukan 1 channel chaos chat semuanya.

## Bagian 2: Setup Discord Webhook (untuk Notifications)

### A. Bikin Webhook URL

1. Discord server kamu → Right-click channel #ci-builds → Edit Channel
2. Integrations → Webhooks → New Webhook
3. Nama: "GitHub Actions"
4. Copy Webhook URL (rahasia, jangan share)

Ulangi untuk:
- #vercel-deploys
- #pr-events

### B. Integrate ke GitHub Actions

Tambah di repo Settings → Secrets:
- DISCORD_WEBHOOK_CI: URL webhook #ci-builds
- DISCORD_WEBHOOK_DEPLOY: URL webhook #vercel-deploys
- DISCORD_WEBHOOK_PR: URL webhook #pr-events

Tambah workflow .github/workflows/discord-notif.yml:

```yaml
name: Discord Notifications
on:
  pull_request:
    types: [opened, closed, reopened]
  workflow_run:
    workflows: ["CI"]
    types: [completed]

jobs:
  notify-pr:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - name: PR Event
        run: |
          STATUS="${{ github.event.action }}"
          curl -H "Content-Type: application/json" \
            -d "{ \"content\": \"[PR-${{ github.event.pull_request.number }}] $STATUS by ${{ github.event.pull_request.user.login }}: ${{ github.event.pull_request.title }}\nURL: ${{ github.event.pull_request.html_url }}\" }" \
            ${{ secrets.DISCORD_WEBHOOK_PR }}

  notify-ci:
    if: github.event_name == 'workflow_run'
    runs-on: ubuntu-latest
    steps:
      - name: CI Result
        run: |
          STATUS="${{ github.event.workflow_run.conclusion }}"
          EMOJI=$( [ "$STATUS" = "success" ] && echo "OK" || echo "FAIL" )
          curl -H "Content-Type: application/json" \
            -d "{ \"content\": \"$EMOJI CI $STATUS: ${{ github.event.workflow_run.name }} on ${{ github.event.workflow_run.head_branch }}\" }" \
            ${{ secrets.DISCORD_WEBHOOK_CI }}
```

### C. Integrate ke Vercel

Vercel Dashboard → Project → Settings → Integrations → Discord → Add webhook URL #vercel-deploys.

Otomatis kasih notif:
- Deploy started
- Deploy success (with preview URL)
- Deploy failed (with error link)

## Bagian 3: Discord Bot Custom (Optional)

Untuk feature yang webhook tidak support, bikin bot custom.

### Use Case Bot Custom

1. /akses status - cek health prod (uptime, latency)
2. /akses task <ID> - lookup task description
3. /akses pr <number> - shortcut buka PR di GitHub
4. /akses deploy - trigger manual deploy (owner only)
5. /akses scale - cek Vercel + Supabase usage saat ini

### Setup Bot (Discord.js)

```bash
mkdir <project>-discord-bot && cd <project>-discord-bot
npm init -y
npm install discord.js dotenv

# .env
DISCORD_TOKEN=<from Discord Developer Portal>
GUILD_ID=<server ID>
GITHUB_TOKEN=<for PR lookup>
```

Create index.js dengan slash command handler.

Deploy bot ke:
- Railway $5/mo (recommended, easy)
- Atau Vercel functions (serverless, free tier)
- Atau self-host VPS

### Caveat untuk Bot Custom

- Setup effort: 4-8 jam awal
- Maintenance: 1-2 jam/bulan
- Cost: $0-5/mo
- Worth kalau owner sering perlu shortcut command

Untuk MVP: SKIP bot custom. Pakai webhook saja cukup.

## Bagian 4: Discord Notification Etiquette

Untuk staff non-programmer di tim:

DO:
- Reply ke channel sesuai topic (PR di #<project>-review, task di #<project>-task)
- Mention @owner kalau urgent (Discord notification active)
- Pakai thread untuk diskusi panjang (jangan flood channel utama)
- React emoji untuk acknowledge task

DON'T:
- Spam @everyone (jangan ping semua untuk non-urgent)
- Post sensitive info di public channel (credentials, customer data)
- Diskusi panjang di #ci-builds (channel ini cuma notif bot)

## Bagian 5: Discord vs Slack vs Telegram

| Aspect | Discord | Slack | Telegram |
|---|---|---|---|
| Cost | Free unlimited | Free 90-day history | Free unlimited |
| Voice/Video | Native built-in | Need Huddles | Need group call |
| Bot ecosystem | Strong (gaming origin) | Strong (work origin) | OK (custom bot) |
| Best for | Community + small team | Enterprise | Quick async |

Kit lintasAI default = Discord (user feedback).

## Bagian 6: Integrasi dengan lintasAI

Saat AI Claude Code execute task, AI bisa post update ke Discord via:
- GITHUB_TOKEN call ke API GitHub (PR creation triggers Discord webhook)
- atau langsung POST ke Discord webhook URL (set di env)

Owner setup webhook sekali, semua AI activity auto-broadcast ke channel.

## Bagian 7: Privacy + Security

- Webhook URL = rahasia, jangan commit ke git
- Audit Discord log periodic (Server Settings → Audit Log)
- Revoke webhook kalau staff resign (regenerate baru)
- Bot custom: rotate DISCORD_TOKEN tiap 90 hari

---
