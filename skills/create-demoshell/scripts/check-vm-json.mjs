// Demoshell VM JSON checker — generated file, do not edit.
//
//   node check-vm-json.mjs <file.vm.json>
//
// Prints ✓ and a one-line summary when the file will import in Demoshell
// (project page → ⋯ → Import VM from JSON), or ✗ and the first problem.
// Format: https://demoshell.com/docs/vm-json

// scripts/check-vm-json.ts
import { readFileSync } from "node:fs";

// src/guides.ts
var MAX_GUIDE_TITLE_CHARS = 200;
var MAX_CTA_LABEL_CHARS = 120;
var MAX_CTA_URL_CHARS = 1024;
function makeStep(over = {}) {
  return {
    title: "",
    body: "",
    kind: "command",
    pattern: "",
    match_mode: "exact",
    require_success: true,
    output_contains: null,
    replay_command: null,
    optional: false,
    web_match: null,
    ...over
  };
}
function lintGuide(steps) {
  if (steps.length === 0) return "add at least one step before publishing";
  for (const [i, step] of steps.entries()) {
    const n = i + 1;
    if (!step.title.trim()) return `step ${n} needs a title`;
    if (step.kind === "manual" && !step.body.trim()) {
      return `step ${n} is a manual step, so it needs a hint saying what to do`;
    }
    if (step.kind === "command" && !step.pattern.trim()) {
      return `step ${n} needs the command the visitor types`;
    }
    if (step.kind === "command" && step.match_mode === "keys" && !KEY_SPEC_RE.test(step.pattern.trim())) {
      return `step ${n} watches for a key press, so it needs a single key like s, /, CTRL-R, ALT-I, Tab, Enter, Esc or Space`;
    }
    const web = (step.web_match ?? "").trim();
    if (web && step.kind === "command") {
      return `step ${n} ticks from the terminal, so it cannot also watch the page \u2014 make it a manual step`;
    }
    if (web && !WEB_MATCH_RE.test(web)) {
      return `step ${n} watches the page, so its action needs a path like /welcome, POST /api/signup, or * for any request`;
    }
    if (step.kind === "command" && (step.match_mode === "exact" || step.match_mode === "starts_with") && KEY_CHORD_RE.test(step.pattern.trim())) {
      return `step ${n} is a key press, not a command \u2014 set it to KEY PRESS so it ticks when the visitor presses it`;
    }
  }
  return null;
}
var KEY_CHORD_RE = /^(?:(?:c-|ctrl[-+]|\^)[a-z]|(?:alt[-+]|m-)[a-z]|tab|enter|return|esc|escape|space)$/i;
var PLAIN_KEY_RE = /^[!-~]$/;
var WEB_MATCH_RE = /^(?:\*|(?:(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+)?\/\S*)$/i;
var KEY_SPEC_RE = new RegExp(`(?:${PLAIN_KEY_RE.source})|(?:${KEY_CHORD_RE.source})`, "i");

// src/validation.ts
var MAX_SLUG_LEN = 40;
var ALLOWED_BASE_IMAGES = ["min", "docker"];
var MAX_SCRIPT_BYTES = 64 * 1024;
var MAX_AFTER_LOAD_BYTES = 4 * 1024;
var MAX_START_COMMAND_LEN = 512;
var MAX_START_WAIT_S = 10 * 60;
var MIN_TIMEOUT_S = 1;
var MAX_TIMEOUT_S = 60 * 60;
var MAX_WEB_URL_CHARS = 255;
var MAX_RAW_WEB_URL_CHARS = 1024;
var MAX_VCPUS = 4;
var VCPU_CHOICES = Array.from({ length: MAX_VCPUS }, (_v, i) => i + 1);
function validateSlug(slug, label = "value") {
  if (!slug) return `${label} is required`;
  if (slug.length > MAX_SLUG_LEN) return `${label} must be at most ${MAX_SLUG_LEN} characters`;
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return `${label} may only contain lowercase letters, digits, and hyphens`;
  }
  if (slug.startsWith("-") || slug.endsWith("-")) {
    return `${label} must not start or end with a hyphen`;
  }
  return null;
}
function byteLen(s) {
  return new TextEncoder().encode(s).length;
}
var WEB_URL_MESSAGES = {
  empty: "The web page address is empty",
  https: "The web page address must use http://, not https:// \u2014 the page comes from the app inside the VM, which is reached over plain HTTP",
  not_http: "The web page address must start with http:// (for example http://localhost:7700/)",
  host: "The page must come from the VM \u2014 use http://localhost:<port>/\u2026 or http://127.0.0.1:<port>/\u2026",
  port: "The web page address needs a port between 1 and 65535",
  chars: "The web page address contains a space or a control character",
  placeholder: "The web page address must not contain { or } \u2014 a {{versions.\u2026}} placeholder is substituted in the build script and the commands, never in an address",
  too_long: `The web page address is too long (max ${MAX_WEB_URL_CHARS} characters once normalised)`
};
var WEB_URL_WS = "\\u0009-\\u000d\\u0020\\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
var WEB_URL_TRIM = new RegExp(`^[${WEB_URL_WS}]+|[${WEB_URL_WS}]+$`, "g");
var WEB_URL_BAD_CHAR = new RegExp(`[${WEB_URL_WS}\\u0000-\\u001f\\u007f-\\u009f]`);
function validateWebUrl(input) {
  const fail2 = (slug) => ({ ok: false, slug, error: WEB_URL_MESSAGES[slug] });
  const raw = input.replace(WEB_URL_TRIM, "");
  if (!raw) return fail2("empty");
  if ([...raw].length > MAX_RAW_WEB_URL_CHARS) return fail2("too_long");
  if (WEB_URL_BAD_CHAR.test(raw)) return fail2("chars");
  if (raw.includes("{") || raw.includes("}")) return fail2("placeholder");
  const lower = raw.toLowerCase();
  if (lower.startsWith("https://")) return fail2("https");
  if (!lower.startsWith("http://")) return fail2("not_http");
  const rest = raw.slice("http://".length);
  const delim = rest.search(/[/?#]/);
  const authority = delim === -1 ? rest : rest.slice(0, delim);
  let remainder = delim === -1 ? "" : rest.slice(delim);
  if (/[@[\]]/.test(authority)) return fail2("host");
  const colon = authority.indexOf(":");
  let port = 80;
  let host = authority;
  if (colon !== -1) {
    host = authority.slice(0, colon);
    const digits = authority.slice(colon + 1);
    if (!/^[0-9]+$/.test(digits)) return fail2("port");
    port = Number(digits);
    if (port < 1 || port > 65535) return fail2("port");
  }
  if (host.toLowerCase() !== "localhost" && host.toLowerCase() !== "127.0.0.1") return fail2("host");
  const hash = remainder.indexOf("#");
  if (hash !== -1) remainder = remainder.slice(0, hash);
  const path2 = remainder === "" ? "/" : remainder.startsWith("?") ? `/${remainder}` : remainder;
  const normalized = `http://localhost:${port}${path2}`;
  if ([...normalized].length > MAX_WEB_URL_CHARS) return fail2("too_long");
  return { ok: true, normalized, port, path: path2 };
}
var MAX_RECIPE_FILES = 64;
var MAX_RECIPE_FILES_TOTAL_BYTES = 256 * 1024;
var MAX_RECIPE_FILE_PATH_BYTES = 255;
var RECIPE_PATH_CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
function refusedPlace(path2) {
  if (path2 === "/tmp/build.sh") {
    return "This is where the build script itself is written, so a file cannot go here";
  }
  if (path2 === "/.demoshell-files" || path2.startsWith("/.demoshell-files/")) {
    return "This folder holds the files on their way into the VM and is removed afterwards";
  }
  if (path2 === "/root/.arm64js-after-load") {
    return "The after-load script replaces this file later in the build, so it would be gone from the VM";
  }
  if (path2.includes("ARM64JS_BUILD_")) return "ARM64JS_BUILD_ is reserved by the build runner and cannot be in a path";
  for (const root of ["/proc", "/sys", "/dev"]) {
    if (path2 === root || path2.startsWith(`${root}/`)) return "Files cannot be written under /proc, /sys or /dev";
  }
  return null;
}
function recipeFilePathError(path2) {
  if (!path2.startsWith("/")) {
    return { rule: "relative", message: path2 ? "The path must start with /" : "Enter the file's path" };
  }
  if (byteLen(path2) > MAX_RECIPE_FILE_PATH_BYTES) {
    return { rule: "path_too_long", message: `The path is longer than ${MAX_RECIPE_FILE_PATH_BYTES} bytes` };
  }
  if (RECIPE_PATH_CONTROL.test(path2)) return { rule: "control", message: "The path contains a control character" };
  if (path2.includes("'")) return { rule: "quote", message: "The path must not contain ' (a single quote)" };
  if (path2.endsWith("/"))
    return { rule: "trailing_slash", message: "The path must name a file, so it cannot end with /" };
  if (path2.slice(1).split("/").some((seg) => seg === "" || seg === "." || seg === "..")) {
    return { rule: "segment", message: "The path must not contain . or .. or an empty part (//)" };
  }
  const why = refusedPlace(path2);
  if (why) return { rule: "refused", message: why };
  return null;
}
function recipeFileModeIsValid(mode) {
  return /^0?[0-7]{3}$/.test(mode);
}
function recipeFilesTotalBytes(files) {
  return files.reduce((n, f) => n + byteLen(f.content), 0);
}
function validateRecipeFiles(files) {
  const out = [];
  if (files.length > MAX_RECIPE_FILES) {
    out.push({
      index: null,
      field: "files",
      rule: "too_many",
      message: `A recipe holds at most ${MAX_RECIPE_FILES} files (this one has ${files.length})`
    });
  }
  const seen = /* @__PURE__ */ new Set();
  files.forEach((f, index) => {
    const pathError = recipeFilePathError(f.path);
    if (pathError) out.push({ index, field: "path", ...pathError });
    if (f.mode !== void 0 && !recipeFileModeIsValid(f.mode)) {
      out.push({
        index,
        field: "mode",
        rule: "mode",
        message: "Mode must be three or four octal digits, such as 0644 or 0755 (no setuid, setgid or sticky bit)"
      });
    }
    if (!pathError) {
      if (seen.has(f.path)) {
        out.push({ index, field: "path", rule: "duplicate", message: "Another file already uses this path" });
      }
      seen.add(f.path);
    }
  });
  const valid = files.filter((f) => !recipeFilePathError(f.path)).map((f) => f.path);
  const isValid = (f) => !recipeFilePathError(f.path);
  files.forEach((f, index) => {
    const inner = isValid(f) ? valid.find((p) => p.startsWith(`${f.path}/`)) : void 0;
    if (inner) {
      out.push({
        index,
        field: "path",
        rule: "nested",
        message: `${inner} would need this path to be a folder, but it is a file`
      });
    }
  });
  files.forEach((f, index) => {
    const outer = isValid(f) ? valid.find((p) => f.path.startsWith(`${p}/`)) : void 0;
    if (outer) {
      out.push({
        index,
        field: "path",
        rule: "nested",
        message: `This puts the file inside ${outer}, but that is a file, not a folder`
      });
    }
  });
  const total = recipeFilesTotalBytes(files);
  if (total > MAX_RECIPE_FILES_TOTAL_BYTES) {
    out.push({
      index: null,
      field: "files",
      rule: "too_large",
      message: `The files add up to ${Math.ceil(total / 1024)} KiB; the limit is ${MAX_RECIPE_FILES_TOTAL_BYTES / 1024} KiB`
    });
  }
  return out;
}
function validateRecipe(r, ctx = {}) {
  if (!ALLOWED_BASE_IMAGES.includes(r.base_image)) {
    return `Base image must be one of: ${ALLOWED_BASE_IMAGES.join(", ")}`;
  }
  if (byteLen(r.script) > MAX_SCRIPT_BYTES) {
    return `Script exceeds ${MAX_SCRIPT_BYTES} bytes`;
  }
  const afterLoad = (r.after_load ?? "").trim();
  if (byteLen(afterLoad) > MAX_AFTER_LOAD_BYTES) {
    return `After VM load exceeds ${MAX_AFTER_LOAD_BYTES} bytes`;
  }
  const start = (r.start_command ?? "").trim();
  if (start.length > MAX_START_COMMAND_LEN) {
    return `Start command exceeds ${MAX_START_COMMAND_LEN} characters`;
  }
  if (afterLoad && start) {
    return "A VM has either an after-load script or a start command, not both";
  }
  if (/[\n\r]/.test(start)) return "Start command must be a single line";
  const webUrl = (r.web_url ?? "").replace(WEB_URL_TRIM, "");
  if (webUrl) {
    const web = validateWebUrl(webUrl);
    if (!web.ok) return web.error;
  } else if (ctx.startup === "web") {
    return WEB_URL_MESSAGES.empty;
  }
  const wait = r.start_wait_s ?? 0;
  if (!Number.isInteger(wait) || wait < 0 || wait > MAX_START_WAIT_S) {
    return `Wait before snapshotting must be between 0 and ${MAX_START_WAIT_S} seconds`;
  }
  if (!Number.isInteger(r.timeout_s) || r.timeout_s < MIN_TIMEOUT_S || r.timeout_s > MAX_TIMEOUT_S) {
    return `Timeout must be between ${MIN_TIMEOUT_S} and ${MAX_TIMEOUT_S} seconds`;
  }
  const vcpus = r.vcpus ?? 1;
  if (!Number.isInteger(vcpus) || vcpus < 1 || vcpus > MAX_VCPUS) {
    return `vCPUs must be between 1 and ${MAX_VCPUS}`;
  }
  return null;
}
function validateWatchTarget(kind, target) {
  if (kind === "github_release") {
    const parts2 = target.split("/");
    const ok = parts2.length === 2 && parts2.every((p) => p.length > 0 && /^[A-Za-z0-9._-]+$/.test(p));
    return ok ? null : "GitHub target must be 'owner/repo'";
  }
  if (!target) return "Docker target is required";
  if (target.startsWith("/") || target.endsWith("/")) return "Docker target must not start or end with '/'";
  if (target.split("/").some((seg) => seg.length === 0)) return "Docker target has an empty path segment";
  if (!/^[A-Za-z0-9._/:-]+$/.test(target)) return "Docker target has an invalid character";
  return null;
}

// src/vmdoc.ts
var VM_DOC_KIND = "demoshell.vm";
var VM_DOC_VERSION = 1;
var MAX_GUIDE_STEPS = 100;
var MAX_GUIDE_FIELD_CHARS = 4e3;
var VISIBILITIES = ["public", "private"];
var MODES = ["interactive", "manifest"];
var ORDER_MODES = ["fixed", "free"];
var STEP_KINDS = ["command", "manual"];
var MATCH_MODES = ["exact", "starts_with", "regex", "keys"];
var WATCH_KINDS = ["github_release", "docker_tag"];
var DocError = class extends Error {
};
function fail(message) {
  throw new DocError(message);
}
function obj(value, where) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${where} must be an object`);
  }
  return value;
}
function str(value, where, fallback) {
  if (value === void 0 || value === null) {
    if (fallback !== void 0) return fallback;
    fail(`${where} is required`);
  }
  if (typeof value !== "string") fail(`${where} must be text`);
  return value;
}
function optStr(value, where) {
  if (value === void 0 || value === null) return null;
  if (typeof value !== "string") fail(`${where} must be text`);
  return value.trim() ? value : null;
}
function bool(value, where, fallback) {
  if (value === void 0 || value === null) return fallback;
  if (typeof value !== "boolean") fail(`${where} must be true or false`);
  return value;
}
function int(value, where, fallback) {
  if (value === void 0 || value === null) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value)) fail(`${where} must be a whole number`);
  return value;
}
function oneOf(value, where, allowed, fallback) {
  if (value === void 0 || value === null) {
    if (fallback !== void 0) return fallback;
    fail(`${where} is required`);
  }
  if (typeof value !== "string" || !allowed.includes(value)) {
    fail(`${where} must be one of: ${allowed.join(", ")}`);
  }
  return value;
}
function capped(value, where, max) {
  if ([...value].length > max) fail(`${where} must be at most ${max} characters`);
  return value;
}
function referencedWatches(text2) {
  const out = [];
  let rest = text2;
  for (; ; ) {
    const open = rest.indexOf("{{");
    if (open < 0) break;
    const after = rest.slice(open + 2);
    const close = after.indexOf("}}");
    if (close < 0) break;
    const inner = after.slice(0, close).trim();
    if (inner.startsWith("versions.")) out.push(inner.slice("versions.".length).trim());
    rest = after.slice(close + 2);
  }
  return out;
}
function parseVmDoc(text2) {
  let raw;
  try {
    raw = JSON.parse(text2);
  } catch {
    return { ok: false, error: "That is not valid JSON." };
  }
  try {
    return { ok: true, doc: readDoc(raw) };
  } catch (e) {
    if (e instanceof DocError) return { ok: false, error: e.message };
    throw e;
  }
}
function readDoc(raw) {
  const root = obj(raw, "The file");
  if (root.kind !== VM_DOC_KIND) {
    fail(`This is not a VM export file (its "kind" should be "${VM_DOC_KIND}").`);
  }
  const version = int(root.version, '"version"', 0);
  if (version < 1) fail('"version" is required.');
  if (version > VM_DOC_VERSION) {
    fail(`This file was written by a newer version (${version}); this one reads up to ${VM_DOC_VERSION}.`);
  }
  const vmRaw = obj(root.vm, '"vm"');
  const tag = str(vmRaw.tag, '"vm.tag"');
  const tagError = validateSlug(tag, "VM name");
  if (tagError) fail(tagError);
  const vm2 = {
    tag,
    visibility: oneOf(vmRaw.visibility, '"vm.visibility"', VISIBILITIES, "public"),
    mode: vmRaw.mode === void 0 || vmRaw.mode === null ? null : oneOf(vmRaw.mode, '"vm.mode"', MODES),
    description: optStr(vmRaw.description, '"vm.description"')
  };
  const watches2 = readWatches(root.watches);
  const recipe2 = readRecipe(root.recipe, watches2);
  const guide2 = readGuide(root.guide);
  return { kind: VM_DOC_KIND, version: VM_DOC_VERSION, vm: vm2, recipe: recipe2, watches: watches2, guide: guide2 };
}
function readWatches(raw) {
  if (raw === void 0 || raw === null) return [];
  if (!Array.isArray(raw)) fail('"watches" must be a list');
  const seen = /* @__PURE__ */ new Set();
  return raw.map((entry, i) => {
    const w = obj(entry, `"watches[${i}]"`);
    const name = str(w.name, `"watches[${i}].name"`);
    const nameError = validateSlug(name, `Watch name in "watches[${i}]"`);
    if (nameError) fail(nameError);
    if (seen.has(name)) fail(`Two watches are both named "${name}".`);
    seen.add(name);
    const kind = oneOf(w.kind, `"watches[${i}].kind"`, WATCH_KINDS);
    const target = str(w.target, `"watches[${i}].target"`);
    const targetError = validateWatchTarget(kind, target);
    if (targetError) fail(`"watches[${i}].target": ${targetError}`);
    return {
      name,
      kind,
      target,
      tag_filter: optStr(w.tag_filter, `"watches[${i}].tag_filter"`),
      enabled: bool(w.enabled, `"watches[${i}].enabled"`, true)
    };
  });
}
function readRecipe(raw, watches2) {
  if (raw === void 0 || raw === null) return null;
  const r = obj(raw, '"recipe"');
  const recipe2 = {
    base_image: str(r.base_image, '"recipe.base_image"'),
    script: str(r.script, '"recipe.script"', ""),
    after_load: optStr(r.after_load, '"recipe.after_load"'),
    start_command: optStr(r.start_command, '"recipe.start_command"'),
    // Absent ⇒ a terminal demo. `validateRecipe` runs the same grammar the API
    // does over it, so a mistyped address is named here rather than as a 400 on
    // the import's third call.
    web_url: optStr(r.web_url, '"recipe.web_url"'),
    start_wait_s: int(r.start_wait_s, '"recipe.start_wait_s"', 0),
    timeout_s: int(r.timeout_s, '"recipe.timeout_s"', 600),
    vcpus: int(r.vcpus, '"recipe.vcpus"', 1),
    // Absent ⇒ off, and the API refuses `true` unless the org is on the paid
    // plan — so an imported document cannot hand a free org guest internet.
    net_enabled: bool(r.net_enabled, '"recipe.net_enabled"', false)
  };
  const files = readFiles(r.files);
  if (files.length) recipe2.files = files;
  const error = validateRecipe(recipe2);
  if (error) fail(error);
  const defined = new Set(watches2.map((w) => w.name));
  const missing = [
    ...referencedWatches(recipe2.script),
    ...referencedWatches(recipe2.start_command ?? ""),
    ...referencedWatches(recipe2.after_load ?? "")
  ].filter((name) => !defined.has(name));
  if (missing.length) {
    const unique = [...new Set(missing)];
    fail(`The recipe uses {{versions.${unique[0]}}}, but no watch named "${unique[0]}" is in "watches".`);
  }
  return recipe2;
}
function readFiles(raw) {
  if (raw === void 0 || raw === null) return [];
  if (!Array.isArray(raw)) fail('"recipe.files" must be a list');
  const files = raw.map((entry, i) => {
    const f = obj(entry, `"recipe.files[${i}]"`);
    const file = {
      path: str(f.path, `"recipe.files[${i}].path"`),
      content: str(f.content, `"recipe.files[${i}].content"`)
    };
    if (f.mode !== void 0 && f.mode !== null) file.mode = str(f.mode, `"recipe.files[${i}].mode"`);
    return file;
  });
  const problem = validateRecipeFiles(files)[0];
  if (problem) {
    const where = problem.index === null ? '"recipe.files"' : `"recipe.files[${problem.index}].${problem.field}"`;
    fail(`${where}: ${problem.message}`);
  }
  return files;
}
function readGuide(raw) {
  if (raw === void 0 || raw === null) return null;
  const g = obj(raw, '"guide"');
  const stepsRaw = g.steps;
  if (stepsRaw !== void 0 && stepsRaw !== null && !Array.isArray(stepsRaw)) {
    fail('"guide.steps" must be a list');
  }
  const list = stepsRaw ?? [];
  if (list.length > MAX_GUIDE_STEPS) {
    fail(`A guide holds at most ${MAX_GUIDE_STEPS} steps.`);
  }
  const steps = list.map((entry, i) => readStep(entry, i));
  const ctaUrl = optStr(g.cta_url, '"guide.cta_url"');
  if (ctaUrl) {
    capped(ctaUrl, '"guide.cta_url"', MAX_CTA_URL_CHARS);
    const lower = ctaUrl.toLowerCase();
    if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
      fail('"guide.cta_url" must start with http:// or https://');
    }
  }
  const guide2 = {
    title: capped(str(g.title, '"guide.title"', ""), '"guide.title"', MAX_GUIDE_TITLE_CHARS),
    order_mode: oneOf(g.order_mode, '"guide.order_mode"', ORDER_MODES, "fixed"),
    cta_label: optStr(g.cta_label, '"guide.cta_label"'),
    cta_url: ctaUrl,
    publish: bool(g.publish, '"guide.publish"', false),
    steps
  };
  if (guide2.cta_label) capped(guide2.cta_label, '"guide.cta_label"', MAX_CTA_LABEL_CHARS);
  if (guide2.publish) {
    const lint = lintGuide(steps);
    if (lint) fail(`This guide is marked to publish, but ${lint}.`);
  }
  return guide2;
}
function readStep(entry, i) {
  const s = obj(entry, `"guide.steps[${i}]"`);
  const field = (value, name, fallback = "") => capped(str(value, `"guide.steps[${i}].${name}"`, fallback), `"guide.steps[${i}].${name}"`, MAX_GUIDE_FIELD_CHARS);
  const optField = (value, name) => {
    const v = optStr(value, `"guide.steps[${i}].${name}"`);
    return v === null ? null : capped(v, `"guide.steps[${i}].${name}"`, MAX_GUIDE_FIELD_CHARS);
  };
  return makeStep({
    title: field(s.title, "title"),
    body: field(s.body, "body"),
    kind: oneOf(s.kind, `"guide.steps[${i}].kind"`, STEP_KINDS, "command"),
    pattern: field(s.pattern, "pattern"),
    match_mode: oneOf(s.match_mode, `"guide.steps[${i}].match_mode"`, MATCH_MODES, "exact"),
    require_success: bool(s.require_success, `"guide.steps[${i}].require_success"`, true),
    output_contains: optField(s.output_contains, "output_contains"),
    replay_command: optField(s.replay_command, "replay_command"),
    optional: bool(s.optional, `"guide.steps[${i}].optional"`, false),
    web_match: optField(s.web_match, "web_match")
  });
}

// scripts/check-vm-json.ts
var path = process.argv[2];
if (!path) {
  console.error("usage: check-vm-json <file.vm.json>");
  process.exit(2);
}
var text;
try {
  text = readFileSync(path, "utf8");
} catch (e) {
  console.error(`could not read ${path}: ${e instanceof Error ? e.message : e}`);
  process.exit(2);
}
var result = parseVmDoc(text);
if (!result.ok) {
  console.error(`\u2717 ${path}
  ${result.error}`);
  process.exit(1);
}
var { vm, recipe, watches, guide } = result.doc;
var parts = [
  `VM "${vm.tag}" (${vm.visibility}${vm.mode ? `, ${vm.mode}` : ""})`,
  recipe ? `recipe on ${recipe.base_image}, ${recipe.vcpus} vCPU` : "no recipe",
  `${watches.length} watch${watches.length === 1 ? "" : "es"}`,
  guide ? `guide "${guide.title}" with ${guide.steps.length} step${guide.steps.length === 1 ? "" : "s"} (${guide.publish ? "publish" : "draft"})` : "no guide"
];
console.log(`\u2713 ${path}
  ${parts.join(" \xB7 ")}`);
