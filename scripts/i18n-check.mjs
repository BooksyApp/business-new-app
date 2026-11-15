#!/usr/bin/env node
/**
 * Reports user-visible string literals that are not routed through t():
 * JSX text, string props (placeholder/title/aria-label/...), toast/alert/confirm/Error
 * arguments, and string / template literals rendered inside JSX expressions.
 * A line carrying `i18n-ignore` is skipped; scripts/i18n-allowlist.json lists
 * { "<text>": reason } strings that are intentionally left as they are.
 *   node scripts/i18n-check.mjs [--list]
 * Exit code 1 when anything is left (use in CI once the allowlist is settled).
 */
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ATTRS = new Set(["label", "placeholder", "aria-label", "title", "hint", "subtitle", "description", "where", "body", "emptyText", "alt", "helper", "heading", "who", "aria-roledescription", "tooltip", "caption", "summary", "helperText", "text", "message"]);
let allow = {};
try { allow = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/i18n-allowlist.json"), "utf8")); } catch { /* none */ }

function walk(d, o = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, o);
    else if (/\.tsx?$/.test(p) && !/\.test\.|\.d\.ts$/.test(p)) o.push(p);
  }
  return o;
}
const files = walk(path.join(ROOT, "src")).filter((f) => !f.includes("/src/i18n/") && !f.includes("/src/test/"));
const hasLetter = (s) => /\p{L}/u.test(s);
const WIDE = process.argv.includes("--wide");
const found = [];

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const lines = src.split("\n");
  const sf = ts.createSourceFile(f, src, 99, true, f.endsWith("x") ? 4 : 3);
  const add = (n, text, kind) => {
    const line = sf.getLineAndCharacterOfPosition(n.getStart()).line;
    const t = text.replace(/\s+/g, " ").trim();
    if (/^[GyYQqMLwIdDeEcihHKkmsSaBbzZ,.\-\s:/'’]+$/.test(t)) return; // date-fns patterns
    if (n.parent && ts.isArrayLiteralExpression(n.parent) && n.parent.elements[0] === n && n.parent.elements.length >= 2 && n.parent.parent && (ts.isArrayLiteralExpression(n.parent.parent) || ts.isAsExpression(n.parent.parent) || ts.isParenthesizedExpression(n.parent.parent))) return; // [value, label] tuples: the value is not text
    if (!hasLetter(t) || (t.match(/\p{L}/gu) || []).length < 2 || allow[t] || /i18n-ignore/.test(lines[line] ?? "")) return;
    if (found.some((x) => x.file === path.relative(ROOT, f) && x.line === line + 1 && x.text === t.slice(0, 70))) return;
    found.push({ file: path.relative(ROOT, f), line: line + 1, kind, text: t.slice(0, 70) });
  };
  const insideJsxExpr = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isJsxExpression(p)) {
        if (ts.isJsxAttribute(p.parent)) return ATTRS.has(p.parent.name.getText());
        return true;
      }
      if (ts.isFunctionLike(p) || ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p)) return false;
      if (ts.isCallExpression(p) && !(ts.isIdentifier(p.expression) && /^(t|tr|tDynamic)$/.test(p.expression.text))) { /* keep climbing: method calls inside {} */ if (/^(t|tr)$/.test(p.expression.getText())) return false; }
    }
    return false;
  };
  const isT = (n) => { for (let p = n.parent; p; p = p.parent) { if (ts.isCallExpression(p) && /^(t|tr|tDynamic|fmtDate|fmtNumber|translate)$/.test(p.expression.getText())) return true; if (ts.isFunctionLike(p) || ts.isStatement(p)) return false; } return false; };
  (function v(n) {
    if (ts.isImportDeclaration(n) || ts.isTypeNode(n)) return;
    if (ts.isJsxText(n)) add(n, n.text, "jsx-text");
    else if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer) && ATTRS.has(n.name.getText())) add(n, n.initializer.text, `attr:${n.name.getText()}`);
    else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !ts.isJsxAttribute(n.parent) && !(ts.isPropertyAssignment(n.parent) && n.parent.name === n) && !isT(n)) {
      const p = n.parent;
      if (ts.isCallExpression(p) && /^(toast(\.\w+)?|alert|confirm|prompt)$/.test(p.expression.getText())) add(n, n.text, "call");
      else if (ts.isNewExpression(p) && /Error$/.test(p.expression.getText())) add(n, n.text, "error");
      else if (ts.isPropertyAssignment(p) && /^(title|description|label|message|placeholder|subtitle|text|hint|body|emptyText|tooltip)$/.test(p.name.getText()) && /^[A-Z]/.test(n.text)) add(n, n.text, `prop:${p.name.getText()}`);
      else if (insideJsxExpr(n) && !(ts.isPropertyAssignment(p) && !/^(title|description|label|message|placeholder|subtitle|text|hint|body|emptyText|tooltip)$/.test(p.name.getText())) && !/^[A-Z][A-Z0-9_]+$/.test(n.text) && !/^[A-Za-z]*[a-z][A-Z]\w*$/.test(n.text) && !/\b(bg|text|border|ring)-/.test(n.text) && !/^(en-GB|en-US)$/.test(n.text) && !ts.isElementAccessExpression(p) && !(ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind)) && !ts.isCaseClause(p) && !/^[a-z0-9_.\-/:#]+$/.test(n.text)) add(n, n.text, "jsx-expr");
    } else if (ts.isTemplateExpression(n) && !isT(n)) {
      const lit = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join("");
      const p = n.parent;
      if (insideJsxExpr(n) || (ts.isCallExpression(p) && /^(toast(\.\w+)?|alert|confirm)$/.test(p.expression.getText())) || (ts.isNewExpression(p) && /Error$/.test(p.expression.getText())))
        if (!/^[\s\w\-/:.#%]*$/.test(lit) || /\s[a-z]{3,}\s/.test(lit)) add(n, lit, "template");
    }
    if (WIDE && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !isT(n) && !ts.isJsxAttribute(n.parent) && !(ts.isPropertyAssignment(n.parent) && n.parent.name === n) && !ts.isLiteralTypeNode(n.parent) && !ts.isElementAccessExpression(n.parent) && !ts.isCaseClause(n.parent) && !(ts.isBinaryExpression(n.parent) && /^[=!]==?$/.test(n.parent.operatorToken.getText())) && !(ts.isCallExpression(n.parent) && /^(console\.\w+|cn|clsx|require|import|fetch|request|localStorage\.\w+|sessionStorage\.\w+)$/.test(n.parent.expression.getText())) && /^\p{Lu}[\p{L}'’]*(\s+[\p{L}\p{N}'’,.&+()\-–—!?…:/%]+)+$/u.test(n.text.trim()) && !/^[A-Z][A-Za-z]+(\s[A-Z][A-Za-z]+)*$/.test("") ) add(n, n.text, "wide");
    ts.forEachChild(n, v);
  })(sf);
}

const byFile = {};
for (const x of found) (byFile[x.file] ??= []).push(x);
if (process.argv.includes("--list")) for (const x of found) console.log(`${x.file}:${x.line} [${x.kind}] ${x.text}`);
console.log(`i18n-check: ${found.length} leftover literal(s) in ${Object.keys(byFile).length} file(s)`);
process.exit(found.length ? 1 : 0);
