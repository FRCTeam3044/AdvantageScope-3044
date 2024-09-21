# ![AdvantageScope-3044](/banner.png)

[![Build](https://github.com/FRCTeam3044/AdvantageScope-3044/actions/workflows/build.yml/badge.svg)](https://github.com/FRCTeam3044/AdvantageScope-3044/actions/workflows/build.yml)

AdvantageScope-3044 is a fork of [AdvantageScope](https://github.com/Mechanical-Advantage/AdvantageScope) designed for use with [OxConfig](https://github.com/FRCTeam3044/OxConfig) to allow for realtime editng/tuning of values.

For current users of AdvantageScope looking to switch for OxConfig, AdvantageScope-3044 will try to stay as up-to-date as possible with the latest AdvantageScope features. It is currently a drop-in replacement, but since wpilib now bundles advantagescope it will not overwrite it. View the [online documentation](https://github.com/FRCTeam3044/AdvantageScope-3044/blob/main/docs/INDEX.md) which contains docs for the Tuner and Config editor, or find it in app.

Questions, suggestions, bug reports, or just want to chat? Come join us on our [Discord!](https://discord.gg/aBMPrADRCm)

AdvantageScope is a robot diagnostics, log review/analysis, and data visualization application for FIRST Robotics Competition teams. It reads logs in WPILOG, DS log, Hoot (CTRE), and RLOG file formats, plus live robot data viewing using NT4 or RLOG streaming. AdvantageScope can be used with any WPILib project, but is also optimized for use with our [AdvantageKit](https://github.com/Mechanical-Advantage/AdvantageKit) log replay framework. Note that **AdvantageKit is not required to use AdvantageScope**.

AdvantageScope includes the following tools:

- A Config Editor/Tuner system designed for use with OxConfig
- A wide selection of flexible graphs and charts
- 2D and 3D field visualizations of odometry data, with customizable CAD-based robots
- Synchronized video playback from a separately loaded match video
- Joystick visualization, showing driver actions on customizable controller representations
- Swerve drive module vector displays
- Console message review
- Log statistics analysis
- Flexible export options, with support for CSV and WPILOG

**View the [online documentation](/docs/INDEX.md) or find it offline by clicking the 📖 icon in the tab bar.**

Feedback, feature requests, and bug reports are welcome on the [issues page](https://github.com/FRCTeam3044/AdvantageScope-3044/issues).

![Example screenshot](/docs/resources/screenshot-light.png)

## Installation

1. Find the [latest release](https://github.com/FRCTeam3044/AdvantageScope-3044/releases/latest) under "Releases".
2. Download the appropriate build based on the OS & architecture. AdvantageScope supports Windows, macOS, and Linux on both x86 and ARM architectures.

> [!IMPORTANT]
> Before running AppImage builds on Ubuntu 23.10 or later, you must download the AppArmor profile from the releases page and copy it to `/etc/apparmor.d`.

## Building

To install Node.js dependencies, run:

```bash
npm install
```

[Emscripten](https://emscripten.org) also needs to be installed (instructions [here](https://emscripten.org/docs/getting_started/downloads.html)).

To build for the current platform, run:

```bash
npm run build
```

To build for another platform, run:

```bash
npm run build -- --win --x64 # For full list of options, run "npx electron-builder help"
```

To build the WPILib version, set the environment variable `ASCOPE_DISTRIBUTOR` to `WPILIB` before building:

```bash
export ASCOPE_DISTRIBUTOR=WPILIB
```

For development, run:

```bash
npm run watch
npm start
```

## Assets

For details on adding custom assets, see [Custom Assets](/docs/CUSTOM-ASSETS.md).

Bundled assets are stored under [`bundledAssets`](/bundledAssets/). Larger assets are downloaded automatically by AdvantageScope from the [AdvantageScopeAssets](https://github.com/Mechanical-Advantage/AdvantageScopeAssets/releases) repository.
