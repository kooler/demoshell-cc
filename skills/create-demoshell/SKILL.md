---
name: create-demoshell
description: >-
  Write a Demoshell VM JSON file for a terminal app, so it runs as a live demo in
  the browser. Use when asked to "create a Demoshell demo", "make a browser demo
  of my CLI/TUI app", "write a Demoshell VM", or to fix or update a
  `.vm.json` file exported from Demoshell.
---

# Create a Demoshell demo

Demoshell runs a small Linux VM inside the visitor's browser tab. A demo is that VM
with an app already installed, plus an optional guide: a short checklist beside the
terminal that ticks itself as the visitor works through it.

This skill writes **one file**, `<name>.vm.json`. The user imports it in the
Demoshell app (project page → **⋯** → **Import VM from JSON**) and presses
**▶ Build** there. The skill does nothing else: it does not sign in, build, publish,
or change the user's repository.

Public docs, for anything this page does not cover:
- the file format: https://demoshell.com/docs/vm-json
- recipes and base images: https://demoshell.com/docs/create-vm
- guides: https://demoshell.com/docs/guides
- what fits: https://demoshell.com/docs/what-fits

## Step 1: ask, then wait

Ask these two questions before any research, and do not continue until both are
answered.

1. **Which app.** Check whether the current directory is inside a git repository
   (`git rev-parse --is-inside-work-tree`).
   - Inside one: ask "Make a demo for this repository, or for another public GitHub
     repository?"
   - Not inside one: ask "Which public GitHub repository should the demo be for?"
2. **Guide or not.** Ask "Only the VM, or the VM plus a guide?" and explain it in
   one or two sentences: *A guide is a short checklist shown next to the terminal
   that tells visitors what to try. Each step ticks itself off as they do it.*

If the user hands over an existing `.vm.json` instead, skip to
[Updating an existing demo](#updating-an-existing-demo).

## Step 2: learn the app from the repository

Read the README, the install instructions and the release page. Work out:

- what the app does, and what a visitor should see it do in about a minute,
- whether it is a full-screen terminal app (it takes over the screen and is driven by
  keys) or a command-line tool (the visitor types commands at a prompt),
- how it gets installed, from the table below.

Use only what is public. Never use files from the user's computer, such as a local
build: the VM downloads everything itself, from the internet, while it builds. When
the user picked their local repository, the demo gets the version that is published
(the package or the public release), not their local changes. Say so if the local
copy looks ahead of the last release.

A private repository is fine as long as the app can be installed from a public place
listed below.

### How the app gets onto the VM

The VM is **Alpine Linux 3.23 on arm64 (aarch64)**, with musl, not glibc. The minimal
image has busybox (`sh`, `wget`, `tar`, `gzip`) and `apk`, and nothing else: no bash,
curl, git, python or node until the script installs them.

**Only ready-built software.** The VM runs on an emulated CPU, which is far too slow
to compile anything. Accept the first route that works:

| Route | Use it when | How |
|---|---|---|
| Alpine package | The app is in Alpine 3.23 `main` or `community` for aarch64. Check the exact name at `https://pkgs.alpinelinux.org/packages?name=<name>&branch=v3.23&arch=aarch64`. A name from a README is not proof. | `apk add --no-cache <pkg>` |
| GitHub release binary | A release has a Linux arm64/aarch64 asset that is **static or built for musl**. Names with `musl`, or Go builds, are usually fine. A `-gnu` / glibc build will not run. If unsure, download it and run `file` on it: `statically linked` or `ld-musl-aarch64` is fine, `ld-linux-aarch64` is not. | `busybox wget -q -O - <url> \| tar -xz -C /usr/local/bin <binary>` |
| npm package | Plain JavaScript, or it ships a ready-built `linux-arm64` musl binary. | `apk add --no-cache nodejs npm` then `npm install -g <pkg>` |
| pip package | Pure Python (`py3-none-any` wheels), or `musllinux_*_aarch64` wheels, **including every dependency**. | `apk add --no-cache python3` then `python3 -m venv /opt/<app>` and `/opt/<app>/bin/pip install --only-binary=:all: <pkg>`, then link the command into `/usr/local/bin` |

`--only-binary=:all:` makes a pip install fail at once instead of compiling. An npm
package that tries to compile fails by itself, because the image has no compiler.

**Refuse, and say why,** when:

- the only way to install it is compiling: `go install`, `cargo install`,
  `make`, `cargo build`, building from a clone, or a package that compiles C/C++
  during install. Tell the user: the VM's emulated CPU is too slow for compiling, so
  Demoshell can only install ready-built packages. Name what would unblock it: an
  Alpine package, or a static/musl `linux-arm64` binary attached to their GitHub
  releases.
- the only builds are x86-64, or glibc-only on arm64,
- it is a desktop or GUI app (the demo is a terminal),
- it needs several machines or services at once (Docker Compose is not supported
  yet),
- it runs on the JVM. The docs list heavy JVM stacks as not a good fit yet.

Do not write a file in those cases.

## Step 3: plan the demo

Defaults. Change one only when the user asks for it:

| Setting | Default | Only if the user asks |
|---|---|---|
| What the visitor sees | A terminal | A web page served by the app (`web_url`) |
| `base_image` | `min` | `docker`, for an app that runs containers |
| `vcpus` | `1` | More, for work that really runs in parallel |
| Version watches | none | A watch that rebuilds on each release (paid and open-source plans) |
| `net_enabled` | `false` | Internet for visitors (paid plan) |
| `visibility` | `public` | `private` |

Then decide what the visitor lands in:

- **A full-screen app**: `start_command` starts it, and the saved VM resumes inside
  it. Put setup in front on the same line: `cd /root/work && app`. No `after_load`
  and no `/etc/motd`, since the visitor never sees a prompt.
- **A command-line tool**: `after_load` opens the visitor's terminal in the right
  directory and prints a short hint, usually `cd /root/work` and `cat /etc/motd`. The
  script writes that motd.

**Prepare something to look at.** A file manager on an empty folder, a git tool with
no repository, or a search tool with nothing to search makes a bad demo. The script
creates a small sample project, a repository with a few commits, a data file: whatever
makes the app's best feature visible in the first minute. Do heavy work (downloads,
indexing) in the script, which runs once, never in `after_load`, which runs for every
visitor.

## Step 4: write the file

### The shape

```json
{
  "kind": "demoshell.vm",
  "version": 1,
  "vm": { "tag": "…", "visibility": "public", "mode": "manifest", "description": "…" },
  "recipe": { "base_image": "min", "script": "…", "start_command": "…", "start_wait_s": 3, "timeout_s": 600, "vcpus": 1 },
  "watches": [],
  "guide": { "title": "…", "order_mode": "fixed", "cta_label": "…", "cta_url": "https://…", "publish": true, "steps": [ … ] }
}
```

Leave `guide` out (or `null`) when the user wants only the VM. Never add ids,
timestamps or build results: the file holds only what a person writes.

### `vm`

- `tag`: the VM's name, after the app (`lazygit`, `ripgrep`). Lowercase letters,
  digits and hyphens, at most 40 characters, no hyphen at either end.
- `mode`: `manifest`.
- `description`: one short line about the app.

### `recipe`

| Field | Rule |
|---|---|
| `script` | At most 64 KB. Runs as root in one shell; a failing command fails the build. Must **exit**. |
| `start_command` | One line, at most 512 characters. The full-screen app, left running. Never with `after_load`. |
| `after_load` | At most 4 KB. Runs on every load, for every visitor. Only `cd` and a short message. Never with `start_command`. |
| `start_wait_s` | `0`–`600`. For a full-screen app, `2`–`5`, so the saved screen (and its screenshot) is fully drawn. |
| `timeout_s` | `1`–`3600`. `600` is a good default; raise it when the script downloads a lot. |
| `vcpus` | `1`. |

Writing the script:

- Install with one of the routes above. Print the version after installing
  (`app --version`), so a broken install fails the build instead of the demo.
- Pin a release binary's version in the URL. Put it in a variable at the top of the
  script, so the user sees where to change it.
- Keep it non-interactive. Nothing that prompts or opens a pager: set
  `GIT_PAGER=cat` and `PAGER=cat` where a tool would page, and configure git
  (`user.name`, `user.email`) before committing.
- Never start the long-running app at the end of the script. It goes in
  `start_command`.
- Nothing the script prints reaches the visitor, and its `cd` does not move their
  shell. That is what `after_load` is for.
- Call `busybox wget` and `git clone` plainly. No retry loops or helper functions: if
  the network drops, the build fails and the user runs it again.
- Keep guards that fail the build (`test -s file`, a version print). Remove any block
  you used to try out the guide's commands before handing the file over.

**Go apps.** Go's garbage collector is expensive on the emulated CPU. Wrap the binary
so the setting applies however it starts:

```sh
mv /usr/local/bin/app /usr/local/bin/app-real
printf '#!/bin/sh\nexport GOGC=off GOMEMLIMIT=400MiB\nexec /usr/local/bin/app-real "$@"\n' > /usr/local/bin/app
chmod +x /usr/local/bin/app
```

Use `GOGC=off GOMEMLIMIT=400MiB` for a tool that runs and exits. For an app that
keeps running (a full-screen app, a server) use `GOGC=400` instead.

### `guide`

Only when the user asked for one.

| Field | Rule |
|---|---|
| `title` | At most 200 characters. The outcome, not the app: "Stage and commit a change", not "lazygit guide". |
| `order_mode` | `fixed` when each step builds on the one before, `free` otherwise. |
| `cta_label`, `cta_url` | The link on the finish card: the project's docs or repository. The URL starts with `https://`. |
| `publish` | `true`. It goes live with the import if the user's email is verified, and stays a draft otherwise. |
| `steps` | 3 to 6. The path to a first success, not a manual. |

A step:

| Field | Rule |
|---|---|
| `title` | An instruction: "Search the index", not "Searching". |
| `kind` | `command` (the visitor types a command or presses a key) or `manual` (they press MARK DONE). |
| `pattern` | What the visitor types, or with `match_mode: "keys"` the key. Required on command steps. |
| `match_mode` | `exact` for a fixed command, `starts_with` when arguments vary, `regex` rarely, `keys` for a key press. |
| `body` | The hint. Required on manual steps. See the hint rules below. |
| `require_success` | Leave `true`. `false` only for a command that exits non-zero when it works. |
| `output_contains` | Optional. Text the command prints, the same on every run: no dates, timings, versions or paths with a user name. |
| `replay_command` | Required in practice on `starts_with` and `regex` steps: a full command the automatic check types after each build. Visitors never see it. |
| `optional` | `true` lets the visitor skip it. |

Key press steps (`match_mode: "keys"`) accept a single character (`s`, `/`, `?`;
`S` is a different key from `s`), Ctrl or Alt plus a letter (`C-r`, `Alt-i`), and
`Tab`, `Enter`, `Esc`, `Space`. Arrow and function keys are not accepted; a step
about them stays `manual`.

Rules for steps:

- **Inside a full-screen app, the terminal sees no commands.** Every step there is a
  `keys` step or a `manual` step.
- Every step must work on the VM exactly as the script leaves it. If a step opens
  `notes.md`, the script created `notes.md`.
- A step that changes something must be safe to run twice, because visitors repeat
  steps. Make the change its own guard: `mkdir -p`, `grep -q … || …`.
- Match what people actually type, not the long canonical form.
- Write about the app, never about the VM: no "this runs in your browser", no "the
  machine is emulated".

Hints (`body`):

- Write one only when it adds something: what a flag does, which part of the output
  to look at, or what the command does that the title cannot say. One short sentence.
- Leave it empty when the title and command say it all. A step titled "Branch the
  database" with `dolt checkout -b demo` needs no hint.
- Do not repeat the command; the visitor already sees it on the step.
- No selling, no story, no drama. Say what the command does, not what it means.
  "An ordinary SQL update; Dolt tracks it the way git tracks an edited file." is a
  hint. "The 2006 IAU vote, replayed." is not.

## Step 5: check the file

Save it as `<tag>.vm.json` in the current directory, unless the user named another
place. Then run the checker that ships with this skill. It is the same check the
import runs:

```sh
node "${CLAUDE_PLUGIN_ROOT}/skills/create-demoshell/scripts/check-vm-json.mjs" <tag>.vm.json
```

`✓` means the file will import. `✗` names the first problem; fix it and run the
checker again. Do not hand over a file that has not passed. If `node` is not
installed, say so: the import modal runs the same check and names the first problem.

## Step 6: hand it over

Tell the user, in this order:

1. Sign in at https://build.demoshell.com (accounts are free; building needs a
   verified email).
2. Open a project, then **⋯** → **Import VM from JSON**, and choose the file.
3. On the VM's page, press **▶ Build**. The build runs in their browser tab, so the
   tab stays open until the VM is saved.
4. Press **▶ Launch** to try the demo. The **Share** card has the link, a README
   badge and the embed code.

If the build fails, ask them to paste the build log. Fix the file, run the checker,
and have them import it again onto the same VM name: that replaces the recipe, and
they press **▶ Build** again.

## Updating an existing demo

**Export JSON** in a VM's **⋯** menu writes the same format. When the user brings one,
edit that file rather than starting over, and keep `vm.tag` unchanged. Importing it
onto the same name updates the VM. Tell the user what that does:

- It replaces the recipe and the guide draft, and adds watches the VM does not have.
- It keeps the VM's visibility and description, and every watch it already has.
- The published guide stays live; the new guide is a draft until they publish it in
  the guide editor.
- Nothing rebuilds until they press **▶ Build**.

## Worked example

A full-screen app, opened by `start_command`, with a guide of key presses and manual
steps:

```json
{
  "kind": "demoshell.vm",
  "version": 1,
  "vm": {
    "tag": "lazygit",
    "visibility": "public",
    "mode": "manifest",
    "description": "Terminal UI for git"
  },
  "recipe": {
    "base_image": "min",
    "script": "apk add --no-cache lazygit git\nlazygit --version\ngit config --global user.email demo@example.com\ngit config --global user.name Demo\nmkdir -p /root/project && cd /root/project\ngit init -q\nprintf '# Project\\n\\nA small sample.\\n' > README.md\ngit add README.md && git commit -qm 'Add readme'\nprintf 'print(\"hello\")\\n' > main.py\ngit add main.py && git commit -qm 'Add main.py'\nprintf 'print(\"hello, world\")\\n' > main.py",
    "start_command": "cd /root/project && lazygit",
    "start_wait_s": 3,
    "timeout_s": 600,
    "vcpus": 1
  },
  "watches": [],
  "guide": {
    "title": "Stage and commit a change",
    "order_mode": "fixed",
    "cta_label": "lazygit on GitHub",
    "cta_url": "https://github.com/jesseduffield/lazygit",
    "publish": true,
    "steps": [
      {
        "title": "Find the changed file",
        "body": "main.py is listed as modified in the Files panel on the left.",
        "kind": "manual"
      },
      {
        "title": "Stage it",
        "body": "The file turns from red to green.",
        "kind": "command",
        "pattern": "Space",
        "match_mode": "keys"
      },
      {
        "title": "Read the diff",
        "body": "The panel on the right shows the edited line.",
        "kind": "manual"
      },
      {
        "title": "Commit",
        "body": "Type a message and press Enter.",
        "kind": "command",
        "pattern": "c",
        "match_mode": "keys"
      }
    ]
  }
}
```

The script leaves a repository with history and one uncommitted edit, so every step
has something to act on the moment the visitor arrives. lazygit takes over the
screen, so the steps are key presses and manual steps, never typed commands.
