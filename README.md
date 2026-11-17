# nova-harvest

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/0xzunid/nova-harvest/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/0xzunid/nova-harvest/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Harvest the dying light.**

A neon arcade space harvester, built for make.fun's [best-game-01](https://make.fun/bounty/best-game-01) bounty. Pilot the harvester ship *Lumen* through a dying nebula: collect starshards, blast void mites, chain combos, and survive the waves.

## How to play

- **Move** — mouse, or WASD / arrow keys
- **Fire** — Space or mouse click
- **Pause** — P · **Mute** — M · **Restart** — R · **Start** — Enter
- Collect starshards to build your combo multiplier (up to x8). Shoot mites, weavers and bulwarks. Grab power-ups: Aegis shield, Magnet, Overdrive. You have 3 hull — a hit costs one and breaks your combo. Clear each wave to advance; the nebula only gets faster.

## Run it

The game is plain static files under `game/` — no build step, no network request:

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

Open `game/index.html` in desktop Chrome and play.

## Entry

This repository is a make.fun entry. `main.ts` (Node 22, standard library only) hands the game in: it copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored make.fun library.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
