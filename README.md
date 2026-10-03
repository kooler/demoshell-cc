# Demoshell plugin for Claude Code

[Demoshell](https://demoshell.com) runs a live demo of your terminal app in the
visitor's browser: a small Linux VM with your app installed, plus an optional guide
that walks them through it.

This plugin adds one skill: `create-demoshell`. Use it inside a GitHub repository or point it to an Github repo to create the demo. Result of its work is a `<name>.vm.json` file -- the build recipe and the guide for that app that you can  import in your Demoshell account.

## Install

In Claude Code:

```
/plugin marketplace add kooler/demoshell-cc
/plugin install demoshell@demoshell
```

