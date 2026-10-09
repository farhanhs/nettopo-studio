import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

function inspectorRenderBlock() {
  const start = pageSource.indexOf("{selectedDevice && <DeviceInspector");
  const end = pageSource.indexOf("{!selectedDevice && !selectedLink", start);
  assert.notEqual(start, -1, "DeviceInspector render block must exist");
  assert.notEqual(end, -1, "Inspector empty state must follow selected render block");
  return pageSource.slice(start, end);
}

function functionBlock(name) {
  const start = pageSource.indexOf(`function ${name}`);
  const end = pageSource.indexOf("\nfunction ", start + 1);
  assert.notEqual(start, -1, `${name} must exist`);
  return pageSource.slice(start, end === -1 ? undefined : end);
}

test("DEV_UIX_006 inspectors remount when the selected entity id changes", () => {
  const block = inspectorRenderBlock();

  assert.match(block, /<DeviceInspector key=\{`device-\$\{selectedDevice\.id\}`\}/);
  assert.match(block, /<LinkInspector key=\{`link-\$\{selectedLink\.id\}`\}/);
});

test("DEV_UIX_006 inspector saves target the current selected id only", () => {
  const block = inspectorRenderBlock();

  assert.match(block, /onSave=\{\(data\) => updateDevice\(selectedDevice\.id, data\)\}/);
  assert.match(block, /onSave=\{\(data\) => updateLink\(selectedLink\.id, data\)\}/);
  assert.doesNotMatch(block, /activeTopology\?\.id|activeCustomerId/);
});

test("DEV_UIX_006 keeps explicit save semantics and uncontrolled field lifecycle", () => {
  const deviceInspector = functionBlock("DeviceInspector");
  const linkInspector = functionBlock("LinkInspector");
  const deviceFields = functionBlock("DeviceFields");
  const linkFields = functionBlock("LinkFields");

  assert.match(deviceInspector, /<form action=\{onSave\}/);
  assert.match(linkInspector, /<form action=\{onSave\}/);
  assert.doesNotMatch(deviceInspector + linkInspector, /onChange=\{[^}]*update(Device|Link)|useEffect|setProject/);
  assert.match(deviceFields, /defaultValue=\{device\?\.name\}/);
  assert.match(deviceFields, /defaultValue=\{device\?\.type\}/);
  assert.match(deviceFields, /defaultValue=\{device\?\.ip\}/);
  assert.match(linkFields, /defaultValue=\{link\?\.from/);
  assert.match(linkFields, /defaultValue=\{link\?\.to/);
  assert.match(linkFields, /defaultValue=\{link\?\.speed/);
});
