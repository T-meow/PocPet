# PocPet

[中文](README.md)

PocPet is an offline-first virtual pet app for desktop, mobile and the web, built with Tauri, React, TypeScript and Rust.

May a little virtual companionship ease a lonely soul.

## Features

- Care for your pet's hunger, cleanliness, mood, energy and health.
- Use a Pomodoro timer, complete daily wishes and companion activities, and collect achievements and seasonal stories.
- Develop learning, gardening, sports and cooking skills.
- Grow crops, raise animals, fish, cook, trade and improve farm facilities and decorations.
- Explore five regions from the outpost to gather supplies, clues and treasures.
- Collect golden apples and trophies, and customize pets with Mods.

## Development and manual playtesting

The frontend requires Node.js and npm. Native development also needs Rust and the Tauri system dependencies; Android builds require a JDK, Android SDK and NDK.

```bash
npm ci
npm run serve:local
```

Use **http://127.0.0.1:5173** for local testing. `npm run dev` uses the same entry point. An occupied port causes an error; reuse an existing project server instead of opening another port or creating separate saves under localhost.

There is one routine code check:

```bash
npm test
```

It checks TypeScript, save compatibility and recovery, error handling and application module loading. Gameplay and visual effects are checked manually. Documentation, wording and styling changes do not require routine builds.

Create a reusable save with all facilities unlocked:

```bash
npm run save:test:facilities
```

Import `output/test-saves/full-facilities.pocpet.json` through the save and recovery section in Settings. See the [local testing reference](docs/本地测试与复用存档.md) for details. Use `npm run tauri:dev` for native development.

## Packaging and releases

```bash
npm run package
```

The interactive command defaults to a Windows x64 EXE and an Android arm64 test-signed APK in `release/`. Add `--type windows,android --dry-run` to preview the commands. Other architectures and platforms require explicit selection. The tool synchronizes versions, backs up existing artifacts and verifies the output; see the [packaging reference](docs/打包流程与统一脚本.md).

[GitHub Actions](.github/workflows/release.yml) runs the unified checks and builds both frontend editions for regular pushes and PRs. Official `v<version>` tags trigger all platform builds, a GitHub Release, update manifests and web deployment. Manual builds default to two platforms unless `full_build` is selected. For an independent web deployment, use [pages.yml](.github/workflows/pages.yml) with `source=main`, the version and the pushed commit.

## Saves and Mods

Settings supports JSON v2 save export and import, including supported older formats. Imports reset time baselines to avoid immediate offline settlement; unsupported newer saves cannot overwrite progress. Exports contain the current Mod identity but not its images, so keep the Mod file separately.

Mod v1/v2 can replace artwork and text and add safe namespaced items. See [CodeWiki](docs/CODEWIKI.md), the [Mod parser](src/core/mod.ts) and the [reference index](docs/README.md).

## License and contributions

Code is licensed under [GPL-3.0-or-later](LICENSE.md). AI-generated or AI-assisted pet artwork is excluded from the GPL license and may not be used commercially. Other asset sources are listed in their respective manifests.

Most code was created with AI assistance and reviewed, integrated, debugged and released by the maintainer. Issues with reproduction steps and independent forks are welcome. Contributions must respect the license, existing save and Mod compatibility, and third-party asset rights.
