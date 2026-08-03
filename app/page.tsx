"use client";

import ELK from "elkjs/lib/elk.bundled.js";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  Position,
  ViewportPortal,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LOGIN_PROFILE, validateLogin } from "./lib/login-auth";
import {
  LAYOUT_DESCRIPTIONS,
  orderLayersByConnectivity,
  resolveLayoutMode,
} from "./lib/topology-layout";
import {
  linkVisualClass,
  routePath,
  routeTopologyLink,
  TOPOLOGY_NODE_HEIGHT as NODE_HEIGHT,
  TOPOLOGY_NODE_WIDTH as NODE_WIDTH,
} from "./lib/topology-routing";
import { useTopologyStore } from "./lib/topology-store";
import {
  buildImportPlan,
  materializeImport,
  projectExportToJson,
  projectToCsvFiles,
  type ImportPlan,
  type ImportStrategy,
} from "./lib/topology-transfer";
import {
  buildCanvasProject,
  deviceQuantity,
  type CanvasDevice,
  type CanvasLink,
} from "./lib/topology-visibility";
import type { Device, DeviceType, Group, Link, Project, SiteRecord, TopologyRecord, UserRecord } from "./lib/topology-types";
type Selection = { kind: "device"; id: string } | { kind: "link"; id: string };
type LayoutMode = "auto-detect" | "three-tier" | "spine-leaf" | "layered";
type DeviceGraph = {
  degree: Map<string, number>;
  switchDegree: Map<string, number>;
  endpointDegree: Map<string, number>;
};

const TYPES: { value: DeviceType; label: string; glyph: string }[] = [
  { value: "router", label: "Router", glyph: "R" },
  { value: "modem", label: "電信商數據機", glyph: "M" },
  { value: "firewall", label: "Firewall", glyph: "F" },
  { value: "switch", label: "Switch", glyph: "S" },
  { value: "server", label: "Server", glyph: "SV" },
  { value: "nas", label: "NAS", glyph: "N" },
  { value: "erp", label: "ERP", glyph: "E" },
  { value: "access-point", label: "無線 AP", glyph: "AP" },
  { value: "client", label: "終端設備", glyph: "C" },
  { value: "ssid", label: "SSID", glyph: "Wi" },
  { value: "mesh-node", label: "Mesh 節點", glyph: "MN" },
  { value: "printer", label: "印表機", glyph: "P" },
  { value: "camera", label: "監視器", glyph: "CAM" },
  { value: "pos", label: "POS", glyph: "POS" },
  { value: "iot", label: "IoT 設備", glyph: "IoT" },
];

const TYPE_MAP = Object.fromEntries(TYPES.map((item) => [item.value, item])) as Record<DeviceType, (typeof TYPES)[number]>;
const DEVICE_ORDER: DeviceType[] = ["modem", "router", "firewall", "switch", "access-point", "mesh-node", "ssid", "server", "nas", "erp", "pos", "printer", "camera", "iot", "client"];
const LAYOUT_LABELS: Record<LayoutMode, string> = {
  "auto-detect": "自動偵測",
  "three-tier": "三層式",
  "spine-leaf": "Spine-Leaf",
  layered: "一般分層",
};
const ROLE_LABELS: Record<UserRecord["role"], string> = {
  boss: "老闆",
  site_manager: "站長",
  engineer: "工程師",
  sales_procurement: "採購與業務",
};
const DEV_IDENTITIES = [
  { email: "sean.sie@dus.local", label: "sean.sie / 謝慶宣" },
  { email: "manner@company.local", label: "manner / 老闆" },
  { email: "north1.manager@company.local", label: "北一站站長" },
  { email: "north2.manager@company.local", label: "北二站站長" },
  { email: "engineer@company.local", label: "工程師" },
  { email: "sales@company.local", label: "採購與業務" },
];
const PANEL_LAYOUT_KEY = "nettopo-panel-layout-v1";
const MAX_DEVICE_QUANTITY = 10_000;

const DEFAULT_PANEL_LAYOUT = { sidebar: 24, canvas: 52, inspector: 24 };
const PANEL_LIMITS = {
  sidebar: { minPercent: 14, maxPercent: 34, minSize: "280px", maxSize: "440px" },
  canvas: { minPercent: 36, minSize: "520px" },
  inspector: { minPercent: 16, maxPercent: 36, minSize: "300px", maxSize: "520px" },
};

const elk = new ELK();
const LOGIN_SESSION_KEY = "nettopo-login-session";

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function normalizePort(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function endpointKey(deviceId: string, port?: string) {
  const normalizedPort = normalizePort(port);
  return normalizedPort ? `${deviceId}:${normalizedPort}` : "";
}

function linkPairKey(link: Pick<Link, "from" | "to" | "fromPort" | "toPort">) {
  const a = endpointKey(link.from, link.fromPort);
  const b = endpointKey(link.to, link.toPort);
  return [a, b].sort().join("|");
}

function validateLink(project: Project, link: Link, ignoreId?: string) {
  if (!link.from || !link.to || link.from === link.to) return "請選擇兩台不同設備。";
  if (link.kind !== "wired") return "";

  const fromEndpoint = endpointKey(link.from, link.fromPort);
  const toEndpoint = endpointKey(link.to, link.toPort);
  if (!fromEndpoint || !toEndpoint) return "實體有線連線需要填寫來源與目的介面。";

  const duplicatePair = linkPairKey(link);
  for (const existing of project.links) {
    if (existing.id === ignoreId || existing.kind !== "wired") continue;
    if (linkPairKey(existing) === duplicatePair) {
      return "已有相同兩端設備與介面的連線；連線視為雙向，不需要建立反向重複連線。";
    }
    const existingEndpoints = [
      endpointKey(existing.from, existing.fromPort),
      endpointKey(existing.to, existing.toPort),
    ];
    if (existingEndpoints.includes(fromEndpoint) || existingEndpoints.includes(toEndpoint)) {
      return "其中一個設備介面已被其他實體連線使用；同一個實體介面不能接到兩條線。";
    }
  }

  return "";
}

function safePanelLayout(value: string | null) {
  if (!value) return DEFAULT_PANEL_LAYOUT;
  try {
    const parsed = JSON.parse(value) as Partial<typeof DEFAULT_PANEL_LAYOUT>;
    const sidebar = Number(parsed.sidebar);
    const canvas = Number(parsed.canvas);
    const inspector = Number(parsed.inspector);
    const total = sidebar + canvas + inspector;
    if (
      Number.isFinite(sidebar) &&
      Number.isFinite(canvas) &&
      Number.isFinite(inspector) &&
      Math.abs(total - 100) < 0.5 &&
      sidebar >= PANEL_LIMITS.sidebar.minPercent &&
      sidebar <= PANEL_LIMITS.sidebar.maxPercent &&
      canvas >= PANEL_LIMITS.canvas.minPercent &&
      inspector >= PANEL_LIMITS.inspector.minPercent &&
      inspector <= PANEL_LIMITS.inspector.maxPercent
    ) return { sidebar, canvas, inspector };
  } catch {
    return DEFAULT_PANEL_LAYOUT;
  }
  return DEFAULT_PANEL_LAYOUT;
}

function isSafePanelLayout(layout: Record<string, number>) {
  return safePanelLayout(JSON.stringify(layout)) !== DEFAULT_PANEL_LAYOUT;
}

function deviceToNode(device: CanvasDevice, selected: boolean): Node {
  if (device.collapsedGroup) {
    return {
      id: device.id,
      type: "default",
      position: { x: device.x, y: device.y },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      selected: false,
      draggable: false,
      data: {
        label: (
          <div className="flow-device flow-group-summary">
            <span className="flow-group-mark" style={{ background: device.collapsedGroup.color }} />
            <strong>{device.collapsedGroup.name}</strong>
            <small>{device.memberCount} 個節點 · {device.totalQuantity} 台設備</small>
            <span className="flow-group-action">點擊展開</span>
          </div>
        ),
      },
      className: "flow-node flow-group-node",
      style: { borderColor: device.collapsedGroup.color },
    };
  }

  const quantity = deviceQuantity(device);
  return {
    id: device.id,
    type: "default",
    position: { x: device.x, y: device.y },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    selected,
    data: {
      label: (
        <div className="flow-device">
          <span className={`flow-glyph type-${device.type}`}>{TYPE_MAP[device.type].glyph}</span>
          <strong>{device.name}</strong>
          <small>{device.ip || TYPE_MAP[device.type].label}</small>
          {quantity > 1 && <span className="flow-quantity">x{quantity}</span>}
        </div>
      ),
    },
    className: `flow-node type-${device.type}`,
  };
}

function linkToEdge(link: CanvasLink, selected: boolean, project: Project): Edge {
  const fromDevice = project.devices.find((device) => device.id === link.from);
  const toDevice = project.devices.find((device) => device.id === link.to);
  const labelParts = [link.aggregateCount && link.aggregateCount > 1 ? `${link.aggregateCount} 條連線` : undefined, link.speed, link.vlan && `VLAN ${link.vlan}`].filter(Boolean);

  return {
    id: link.id,
    source: link.from,
    target: link.to,
    sourceHandle: null,
    targetHandle: null,
    type: "smoothstep",
    label: labelParts.join(" · "),
    selected,
    animated: link.kind === "wireless",
    data: {
      fromName: fromDevice?.name,
      toName: toDevice?.name,
    },
    className: `${link.kind === "wireless" ? "flow-edge-wireless" : "flow-edge-wired"} ${linkVisualClass(link)}`,
  };
}

function deviceName(device: Device) {
  return `${device.name} ${device.model ?? ""} ${device.location ?? ""}`.toLowerCase();
}

function hasAnyKeyword(device: Device, keywords: string[]) {
  const text = deviceName(device);
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function buildDeviceGraph(project: Project): DeviceGraph {
  const byId = new Map(project.devices.map((device) => [device.id, device]));
  const degree = new Map(project.devices.map((device) => [device.id, 0]));
  const switchDegree = new Map(project.devices.map((device) => [device.id, 0]));
  const endpointDegree = new Map(project.devices.map((device) => [device.id, 0]));

  for (const link of project.links) {
    const from = byId.get(link.from);
    const to = byId.get(link.to);
    if (!from || !to) continue;
    degree.set(from.id, (degree.get(from.id) ?? 0) + 1);
    degree.set(to.id, (degree.get(to.id) ?? 0) + 1);
    if (to.type === "switch") switchDegree.set(from.id, (switchDegree.get(from.id) ?? 0) + 1);
    if (from.type === "switch") switchDegree.set(to.id, (switchDegree.get(to.id) ?? 0) + 1);
    if (isEndpointDevice(to)) endpointDegree.set(from.id, (endpointDegree.get(from.id) ?? 0) + 1);
    if (isEndpointDevice(from)) endpointDegree.set(to.id, (endpointDegree.get(to.id) ?? 0) + 1);
  }

  return { degree, switchDegree, endpointDegree };
}

function isEndpointDevice(device: Device) {
  return ["server", "nas", "erp", "client", "access-point", "mesh-node", "ssid", "printer", "camera", "pos", "iot"].includes(device.type);
}

function canWriteTopology(user: UserRecord | undefined, topology: TopologyRecord | undefined) {
  if (!user) return false;
  if (user.role === "boss") return true;
  if (user.role === "sales_procurement") return false;
  if (!topology) return true;
  if (user.role === "site_manager") return Boolean(topology.siteId && user.siteIds.includes(topology.siteId));
  return topology.ownerUserId === user.id || topology.createdByUserId === user.id;
}

function editableSites(user: UserRecord | undefined, sites: SiteRecord[]) {
  if (!user || user.role === "boss" || user.role === "sales_procurement") return sites;
  return sites.filter((site) => user.siteIds.includes(site.id));
}

function sortDevices(devices: Device[], graph: DeviceGraph) {
  return [...devices].sort((a, b) => {
    const degreeDiff = (graph.degree.get(b.id) ?? 0) - (graph.degree.get(a.id) ?? 0);
    if (degreeDiff) return degreeDiff;
    const typeDiff = DEVICE_ORDER.indexOf(a.type) - DEVICE_ORDER.indexOf(b.type);
    if (typeDiff) return typeDiff;
    return a.name.localeCompare(b.name);
  });
}

function applyColumnLayout(project: Project, layers: Device[][]) {
  const left = 80;
  const top = 90;
  const columnGap = 260;
  const rowGap = 150;
  const devices = project.devices.map((device) => ({ ...device }));
  const byId = new Map(devices.map((device) => [device.id, device]));

  orderLayersByConnectivity(layers, project).forEach((layer, layerIndex) => {
    const layerHeight = Math.max(0, (layer.length - 1) * rowGap);
    layer.forEach((device, rowIndex) => {
      const target = byId.get(device.id);
      if (!target) return;
      target.x = left + layerIndex * columnGap;
      target.y = top + rowIndex * rowGap - layerHeight / 2 + 220;
    });
  });

  return { ...project, devices };
}

function applyRowLayout(project: Project, rows: Device[][]) {
  const left = 120;
  const top = 90;
  const columnGap = 240;
  const rowGap = 170;
  const devices = project.devices.map((device) => ({ ...device }));
  const byId = new Map(devices.map((device) => [device.id, device]));

  orderLayersByConnectivity(rows, project).forEach((row, rowIndex) => {
    const rowWidth = Math.max(0, (row.length - 1) * columnGap);
    row.forEach((device, columnIndex) => {
      const target = byId.get(device.id);
      if (!target) return;
      target.x = left + columnIndex * columnGap - rowWidth / 2 + 360;
      target.y = top + rowIndex * rowGap;
    });
  });

  return { ...project, devices };
}

function classifyThreeTier(project: Project) {
  const graph = buildDeviceGraph(project);
  const devices = project.devices;
  const source = sortDevices(devices.filter((device) => device.type === "modem" || hasAnyKeyword(device, ["wan", "internet", "isp", "電信", "數據機"])), graph);
  const edge = sortDevices(devices.filter((device) => device.type === "firewall" || device.type === "router"), graph);
  const switches = devices.filter((device) => device.type === "switch");
  const namedCore = switches.filter((device) => hasAnyKeyword(device, ["core", "backbone", "核心", "主幹"]));
  const core = namedCore.length > 0
    ? sortDevices(namedCore, graph)
    : sortDevices([...switches], graph).slice(0, Math.max(1, Math.min(2, Math.ceil(switches.length / 4))));
  const coreIds = new Set(core.map((device) => device.id));
  const distribution = sortDevices(
    switches.filter((device) =>
      !coreIds.has(device.id) &&
      (hasAnyKeyword(device, ["distribution", "dist", "aggregation", "匯聚", "彙聚"]) || (graph.degree.get(device.id) ?? 0) >= 3),
    ),
    graph,
  );
  const distributionIds = new Set(distribution.map((device) => device.id));
  const access = sortDevices(
    devices.filter((device) =>
      (device.type === "switch" && !coreIds.has(device.id) && !distributionIds.has(device.id)) ||
      ["access-point", "mesh-node", "ssid"].includes(device.type),
    ),
    graph,
  );
  const endpoint = sortDevices(devices.filter((device) => ["server", "nas", "erp", "client", "printer", "camera", "pos", "iot"].includes(device.type)), graph);
  const used = new Set([...source, ...edge, ...core, ...distribution, ...access, ...endpoint].map((device) => device.id));
  const other = sortDevices(devices.filter((device) => !used.has(device.id)), graph);

  return [source, edge, core, distribution, access, endpoint, other].filter((layer) => layer.length > 0);
}

function classifySpineLeaf(project: Project) {
  const graph = buildDeviceGraph(project);
  const switches = project.devices.filter((device) => device.type === "switch");
  const namedSpines = switches.filter((device) => hasAnyKeyword(device, ["spine", "core", "backbone", "核心", "主幹"]));
  const spines = namedSpines.length > 0
    ? sortDevices(namedSpines, graph)
    : sortDevices(switches.filter((device) => (graph.switchDegree.get(device.id) ?? 0) >= 2 && (graph.endpointDegree.get(device.id) ?? 0) === 0), graph);
  const spineIds = new Set(spines.map((device) => device.id));
  const leaves = sortDevices(
    switches.filter((device) =>
      !spineIds.has(device.id) &&
      (hasAnyKeyword(device, ["leaf", "access", "tor", "接入"]) || (graph.endpointDegree.get(device.id) ?? 0) > 0 || (graph.switchDegree.get(device.id) ?? 0) > 0),
    ),
    graph,
  );
  const leafIds = new Set(leaves.map((device) => device.id));
  const edge = sortDevices(project.devices.filter((device) => device.type === "modem" || device.type === "router" || device.type === "firewall"), graph);
  const endpoints = sortDevices(project.devices.filter((device) => isEndpointDevice(device)), graph);
  const endpointRows = Array.from({ length: Math.ceil(endpoints.length / 6) }, (_, index) =>
    endpoints.slice(index * 6, index * 6 + 6),
  );
  const other = sortDevices(project.devices.filter((device) => !spineIds.has(device.id) && !leafIds.has(device.id) && !edge.includes(device) && !endpoints.includes(device)), graph);

  return [edge, spines, leaves, ...endpointRows, other].filter((row) => row.length > 0);
}

async function layoutByMode(project: Project, mode: LayoutMode) {
  const resolved = resolveLayoutMode(project, mode);
  if (resolved === "three-tier") return applyColumnLayout(project, classifyThreeTier(project));
  if (resolved === "spine-leaf") return applyRowLayout(project, classifySpineLeaf(project));
  return layoutWithElk(project);
}

async function layoutWithElk(project: Project) {
  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "70",
      "elk.layered.spacing.nodeNodeBetweenLayers": "90",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    },
    children: [...project.devices]
      .sort((a, b) => DEVICE_ORDER.indexOf(a.type) - DEVICE_ORDER.indexOf(b.type))
      .map((device) => ({ id: device.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
    edges: project.links.map((link) => ({ id: link.id, sources: [link.from], targets: [link.to] })),
  };

  const result = await elk.layout(graph);
  const positions = new Map((result.children ?? []).map((child) => [child.id, { x: child.x ?? 0, y: child.y ?? 0 }]));

  return {
    ...project,
    devices: project.devices.map((device) => {
      const next = positions.get(device.id);
      return next ? { ...device, x: next.x + 80, y: next.y + 90 } : device;
    }),
  };
}

function LoginGate({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setAuthenticated(sessionStorage.getItem(LOGIN_SESSION_KEY) === "authenticated");
    });
  }, []);

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submittedAccount = String(form.get("account") ?? "");
    const submittedPassword = String(form.get("password") ?? "");
    if (!validateLogin(submittedAccount, submittedPassword)) {
      setError("帳號或密碼錯誤，請重新輸入。");
      setPassword("");
      return;
    }

    sessionStorage.setItem(LOGIN_SESSION_KEY, "authenticated");
    setAuthenticated(true);
    setPassword("");
    setError("");
  }

  function logout() {
    sessionStorage.removeItem(LOGIN_SESSION_KEY);
    setAuthenticated(false);
    setAccount("");
    setPassword("");
  }

  if (!authenticated) {
    return (
      <main className="login-shell">
        <section className="login-intro" aria-label="系統介紹">
          <div className="login-brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <i />
            <i />
          </div>
          <p className="login-eyebrow">DIGITAL UNITED SERVICE</p>
          <h1>數位聯合服務網路設備拓樸工具</h1>
          <p className="login-description">
            集中管理網路設備、連線關係與站點拓樸，讓維運資訊更清楚、更容易追蹤。
          </p>
          <ul className="login-features" aria-label="系統功能">
            <li><span>01</span>視覺化設備與連線關係</li>
            <li><span>02</span>集中管理客戶與站點資料</li>
            <li><span>03</span>快速掌握拓樸異動狀態</li>
          </ul>
        </section>

        <section className="login-panel">
          <form
            className="login-card"
            aria-label="登入工作平台"
            onSubmit={submitLogin}
          >
            <header>
              <p>歡迎使用</p>
              <h2>登入工作平台</h2>
              <span>請輸入您的員工帳號與密碼</span>
            </header>

            <label>
              帳號
              <input
                autoComplete="username"
                autoFocus
                name="account"
                onChange={(event) => setAccount(event.target.value)}
                placeholder="請輸入帳號"
                required
                value={account}
              />
            </label>

            <label>
              密碼
              <input
                autoComplete="current-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="請輸入密碼"
                required
                type="password"
                value={password}
              />
            </label>

            {error && <p className="login-error" role="alert">{error}</p>}

            <button className="login-submit" type="submit">登入系統</button>
            <small className="login-security-note">帳密僅用於本次系統登入，不會出現在網址列。</small>
          </form>
        </section>
      </main>
    );
  }

  return (
    <>
      {children}
      <aside className="session-profile" aria-label="登入者資料">
        <span className="session-avatar" aria-hidden="true">{LOGIN_PROFILE.name.slice(0, 1)}</span>
        <span>
          <small>登入者</small>
          <strong>{LOGIN_PROFILE.name}</strong>
          <em>員工編號 {LOGIN_PROFILE.employeeId}</em>
        </span>
        <button onClick={logout} type="button">登出</button>
      </aside>
    </>
  );
}

export default function Home() {
  return (
    <LoginGate>
      <TopologyApp />
    </LoginGate>
  );
}

function TopologyApp() {
  const {
    customers,
    topologies,
    sites,
    currentUser,
    permissions,
    activeCustomerId,
    activeTopologyId,
    project,
    ready,
    saving,
    devUserEmail,
    initialize,
    setDevUserEmail,
    setProject,
    saveDeviceCredential,
    selectCustomer,
    selectTopology,
    createCustomer,
    createTopology,
    importProject,
    renameCustomer,
    renameTopology,
    duplicateCustomer,
    duplicateTopology,
    deleteCustomer,
    deleteTopology,
  } = useTopologyStore();
  const [panelLayout, setPanelLayout] = useState<Record<string, number>>(DEFAULT_PANEL_LAYOUT);
  const [panelLayoutReady, setPanelLayoutReady] = useState(false);
  const [tab, setTab] = useState<"devices" | "links" | "groups">("devices");
  const [selection, setSelection] = useState<Selection>();
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showTopologyForm, setShowTopologyForm] = useState(false);
  const [showTransfer, setShowTransfer] = useState<"import" | "export">();
  const [importPlan, setImportPlan] = useState<ImportPlan>();
  const [importStrategy, setImportStrategy] = useState<ImportStrategy>("new");
  const [importName, setImportName] = useState("匯入拓樸");
  const [importBusy, setImportBusy] = useState(false);
  const [customerAction, setCustomerAction] = useState<"rename" | "duplicate" | "delete">();
  const [topologyAction, setTopologyAction] = useState<"rename" | "duplicate" | "delete">();
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("auto-detect");
  const [groupCollapseOverrides, setGroupCollapseOverrides] = useState<Record<string, Record<string, boolean>>>({});
  const [notice, setNotice] = useState("資料儲存在這台裝置的 IndexedDB");
  const loadedRef = useRef(false);

  useEffect(() => {
    queueMicrotask(() => {
      const storedPanelLayout = localStorage.getItem(PANEL_LAYOUT_KEY);
      const nextPanelLayout = safePanelLayout(storedPanelLayout);
      if (storedPanelLayout && nextPanelLayout === DEFAULT_PANEL_LAYOUT) localStorage.removeItem(PANEL_LAYOUT_KEY);
      setPanelLayout(nextPanelLayout);
      setPanelLayoutReady(true);
      loadedRef.current = true;
    });
  }, []);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!loadedRef.current || !panelLayoutReady) return;
    if (isSafePanelLayout(panelLayout)) localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(panelLayout));
    else localStorage.removeItem(PANEL_LAYOUT_KEY);
  }, [panelLayout, panelLayoutReady]);

  const activeCustomer = customers.find((customer) => customer.id === activeCustomerId);
  const activeTopology = topologies.find((topology) => topology.id === activeTopologyId);
  const currentTopologies = topologies.filter((topology) => topology.customerId === activeCustomerId);
  const activeSite = sites.find((site) => site.id === activeTopology?.siteId);
  const availableSites = editableSites(currentUser, sites);
  const canCreateRecords = permissions.canCreate;
  const canWriteActiveTopology = canWriteTopology(currentUser, activeTopology);
  const canManageActiveCustomer = currentUser?.role === "boss" || canWriteActiveTopology;
  const canDeleteActiveCustomer = currentUser?.role === "boss";

  const selectedDevice = selection?.kind === "device" ? project.devices.find((device) => device.id === selection.id) : undefined;
  const selectedLink = selection?.kind === "link" ? project.links.find((link) => link.id === selection.id) : undefined;
  const topologyCollapseOverrides = useMemo(
    () => groupCollapseOverrides[activeTopologyId ?? ""] ?? {},
    [activeTopologyId, groupCollapseOverrides],
  );
  const effectiveProject = useMemo<Project>(() => ({
    ...project,
    groups: project.groups.map((group) => topologyCollapseOverrides[group.id] === undefined
      ? group
      : { ...group, collapsed: topologyCollapseOverrides[group.id] }),
  }), [project, topologyCollapseOverrides]);
  const canvasProject = useMemo(() => buildCanvasProject(effectiveProject), [effectiveProject]);
  const totalDeviceQuantity = useMemo(
    () => project.devices.reduce((sum, device) => sum + deviceQuantity(device), 0),
    [project.devices],
  );

  const nodes = useMemo(
    () => canvasProject.devices.map((device) => deviceToNode(device, selection?.kind === "device" && selection.id === device.id)),
    [canvasProject.devices, selection],
  );

  const edges = useMemo(
    () => canvasProject.links.map((link) => linkToEdge(link, selection?.kind === "link" && selection.id === link.id, canvasProject)),
    [canvasProject, selection],
  );
  const renderedCanvasLinks = useMemo(
    () => [...canvasProject.links].sort((left, right) =>
      Number(selection?.kind === "link" && selection.id === left.id)
      - Number(selection?.kind === "link" && selection.id === right.id)),
    [canvasProject.links, selection],
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (!canWriteActiveTopology) return;
    const updated = applyNodeChanges(changes, nodes);
    const positionById = new Map(updated.map((node) => [node.id, node.position]));
    setProject((current) => ({
      ...current,
      devices: current.devices.map((device) => {
        const position = positionById.get(device.id);
        return position ? { ...device, x: position.x, y: position.y } : device;
      }),
    }));
  }, [canWriteActiveTopology, nodes, setProject]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    applyEdgeChanges(changes, edges);
  }, [edges]);

  async function addDevice(data: FormData) {
    if (!canWriteActiveTopology) {
      setNotice("目前身分沒有編輯此拓樸的權限");
      return;
    }
    const quantity = Math.max(1, Math.min(MAX_DEVICE_QUANTITY, Math.trunc(Number(data.get("quantity")) || 1)));
    const name = clean(data.get("name")) || "新設備";
    const type = (clean(data.get("type")) || "client") as DeviceType;
    const username = clean(data.get("username"));
    const password = clean(data.get("password"));
    const addition: Device = {
      id: uid("dev"),
      name,
      type,
      ip: clean(data.get("ip")),
      mac: clean(data.get("mac")),
      model: clean(data.get("model")),
      location: clean(data.get("location")),
      url: clean(data.get("url")),
      username,
      password,
      quantity,
      groupId: clean(data.get("groupId")) || undefined,
      x: 80 + (project.devices.length % 4) * 240,
      y: 100 + Math.floor(project.devices.length / 4) * 170,
    };
    setProject((current) => ({ ...current, devices: [...current.devices, addition] }));
    setSelection({ kind: "device", id: addition.id });
    setShowDeviceForm(false);
    try {
      await saveDeviceCredential(addition.id, username, password);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Credential save failed.");
      return;
    }
    setNotice(`已新增數量型節點：${name} x${quantity}`);
  }

  function addLink(data: FormData) {
    if (!canWriteActiveTopology) {
      setNotice("目前身分沒有編輯此拓樸的權限");
      return;
    }
    const link: Link = {
      id: uid("link"),
      from: clean(data.get("from")),
      to: clean(data.get("to")),
      kind: (clean(data.get("kind")) || "wired") as Link["kind"],
      fromPort: clean(data.get("fromPort")),
      toPort: clean(data.get("toPort")),
      vlan: clean(data.get("vlan")),
      speed: clean(data.get("speed")),
    };
    const error = validateLink(project, link);
    if (error) {
      setNotice(error);
      return;
    }
    setProject((current) => ({ ...current, links: [...current.links, link] }));
    setSelection({ kind: "link", id: link.id });
    setShowLinkForm(false);
    setNotice("連線已建立");
  }

  function addGroup(data: FormData) {
    if (!canWriteActiveTopology) {
      setNotice("目前身分沒有編輯此拓樸的權限");
      return;
    }
    const group: Group = {
      id: uid("group"),
      name: clean(data.get("name")) || "新容器",
      kind: (clean(data.get("kind")) || "site") as Group["kind"],
      color: clean(data.get("color")) || "#526cf5",
      collapsed: false,
    };
    setProject((current) => ({ ...current, groups: [...current.groups, group] }));
    setShowGroupForm(false);
    setNotice("容器已建立，可在設備資料中指定");
  }

  async function autoLayout() {
    if (!canWriteActiveTopology) {
      setNotice("目前身分沒有編輯此拓樸的權限");
      return;
    }
    setNotice("正在整理拓樸...");
    const resolvedMode = resolveLayoutMode(project, layoutMode);
    const modeLabel = LAYOUT_LABELS[resolvedMode];
    setProject(await layoutByMode(project, layoutMode));
    setNotice(`${modeLabel} 整理完成。${LAYOUT_DESCRIPTIONS[resolvedMode]} 已分散共用端點與平行連線位置。`);
  }

  async function addCustomer(data: FormData) {
    const name = clean(data.get("name"));
    if (!name) {
      setNotice("請輸入客戶名稱");
      return;
    }
    await createCustomer(name, clean(data.get("siteId")) || undefined);
    setSelection(undefined);
    setShowCustomerForm(false);
    setNotice(`已建立客戶：${name}`);
  }

  async function addTopology(data: FormData) {
    const name = clean(data.get("name")) || "新拓樸";
    const copyCurrent = clean(data.get("copyCurrent")) === "on";
    await createTopology(name, copyCurrent, clean(data.get("siteId")) || activeTopology?.siteId);
    setSelection(undefined);
    setShowTopologyForm(false);
    setNotice(`已建立拓樸：${name}`);
  }

  async function prepareImport(files: FileList | null) {
    if (!files?.length) return;
    setImportBusy(true);
    try {
      const sources = await Promise.all([...files].map(async (file) => ({
        name: file.name,
        text: await file.text(),
      })));
      const plan = buildImportPlan(sources);
      setImportPlan(plan);
      setImportName(plan.suggestedName);
    } finally {
      setImportBusy(false);
    }
  }

  async function confirmImport() {
    if (!importPlan?.canApply) return;
    if (importStrategy === "new" && !canCreateRecords) {
      setNotice("目前角色沒有建立新拓樸的權限。");
      return;
    }
    if (importStrategy !== "new" && !canWriteActiveTopology) {
      setNotice("目前角色沒有修改此拓樸的權限。");
      return;
    }

    setImportBusy(true);
    try {
      const imported = materializeImport(project, importPlan, importStrategy);
      await importProject(imported, importStrategy, importName, activeTopology?.siteId);
      setSelection(undefined);
      setShowTransfer(undefined);
      setImportPlan(undefined);
      setImportStrategy("new");
      setNotice(`匯入完成：${importPlan.summary.devices} 個設備、${importPlan.summary.links} 條連線、${importPlan.summary.groups} 個群組。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "匯入失敗。");
    } finally {
      setImportBusy(false);
    }
  }

  function exportJson(safe: boolean) {
    const name = (activeTopology?.name || "topology").replace(/[\\/:*?"<>|]+/g, "-");
    downloadText(
      `${name}${safe ? "-safe" : ""}.json`,
      projectExportToJson(project, { safe, topologyName: activeTopology?.name }),
      "application/json;charset=utf-8",
    );
  }

  function exportCsv(safe: boolean) {
    const files = projectToCsvFiles(project, { safe });
    for (const [filename, content] of Object.entries(files)) {
      downloadText(filename, content, "text/csv;charset=utf-8");
    }
  }

  async function renameActiveCustomer(data: FormData) {
    if (!activeCustomerId) return;
    const name = clean(data.get("name"));
    if (!name) {
      setNotice("請輸入客戶名稱");
      return;
    }
    await renameCustomer(activeCustomerId, name);
    setCustomerAction(undefined);
    setNotice(`客戶已改名為：${name}`);
  }

  async function renameActiveTopology(data: FormData) {
    if (!activeTopologyId) return;
    const name = clean(data.get("name"));
    if (!name) {
      setNotice("請輸入拓樸名稱");
      return;
    }
    await renameTopology(activeTopologyId, name);
    setTopologyAction(undefined);
    setNotice(`拓樸已改名為：${name}`);
  }

  async function duplicateActiveCustomer() {
    if (!activeCustomerId || !activeCustomer) return;
    await duplicateCustomer(activeCustomerId);
    setSelection(undefined);
    setCustomerAction(undefined);
    setNotice(`已複製客戶：${activeCustomer.name}`);
  }

  async function duplicateActiveTopology() {
    if (!activeTopologyId || !activeTopology) return;
    await duplicateTopology(activeTopologyId);
    setSelection(undefined);
    setTopologyAction(undefined);
    setNotice(`已複製拓樸：${activeTopology.name}`);
  }

  async function deleteActiveCustomer() {
    if (!activeCustomerId || !activeCustomer) return;
    const name = activeCustomer.name;
    await deleteCustomer(activeCustomerId);
    setSelection(undefined);
    setCustomerAction(undefined);
    setNotice(`已刪除客戶：${name}`);
  }

  async function deleteActiveTopology() {
    if (!activeTopologyId || !activeTopology) return;
    const name = activeTopology.name;
    await deleteTopology(activeTopologyId);
    setSelection(undefined);
    setTopologyAction(undefined);
    setNotice(`已刪除拓樸：${name}`);
  }

  async function updateDevice(id: string, data: FormData) {
    if (!canWriteActiveTopology) {
      setNotice("目前身分沒有編輯此拓樸的權限");
      return;
    }
    const nextType = (clean(data.get("type")) || "client") as DeviceType;
    const username = clean(data.get("username"));
    const password = clean(data.get("password"));
    setProject((current) => ({
      ...current,
      devices: current.devices.map((device) => device.id === id ? {
        ...device,
        name: clean(data.get("name")) || device.name,
        type: TYPE_MAP[nextType] ? nextType : device.type,
        ip: clean(data.get("ip")),
        mac: clean(data.get("mac")),
        model: clean(data.get("model")),
        location: clean(data.get("location")),
        url: clean(data.get("url")),
        quantity: Math.max(1, Math.min(MAX_DEVICE_QUANTITY, Math.trunc(Number(data.get("quantity")) || 1))),
        username,
        password,
        groupId: clean(data.get("groupId")) || undefined,
      } : device),
    }));
    try {
      await saveDeviceCredential(id, username, password);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Credential save failed.");
      return;
    }
    setNotice("設備資料已更新");
  }

  function toggleGroupCollapsed(groupId: string) {
    const group = effectiveProject.groups.find((candidate) => candidate.id === groupId);
    if (!group) return;
    const collapsed = !group.collapsed;
    const topologyId = activeTopologyId ?? "";
    setGroupCollapseOverrides((current) => ({
      ...current,
      [topologyId]: { ...(current[topologyId] ?? {}), [groupId]: collapsed },
    }));
    if (canWriteActiveTopology) {
      setProject((current) => ({
        ...current,
        groups: current.groups.map((candidate) => candidate.id === groupId ? { ...candidate, collapsed } : candidate),
      }));
    }
    if (collapsed && selectedDevice?.groupId === groupId) setSelection(undefined);
    setNotice(`${group.name} 已${collapsed ? "折疊" : "展開"}${canWriteActiveTopology ? "並儲存狀態" : "（僅套用於目前檢視）"}`);
  }

  function updateLink(id: string, data: FormData) {
    if (!canWriteActiveTopology) {
      setNotice("目前身分沒有編輯此拓樸的權限");
      return;
    }
    const next: Link = {
      id,
      from: clean(data.get("from")),
      to: clean(data.get("to")),
      kind: (clean(data.get("kind")) || "wired") as Link["kind"],
      fromPort: clean(data.get("fromPort")),
      toPort: clean(data.get("toPort")),
      vlan: clean(data.get("vlan")),
      speed: clean(data.get("speed")),
    };
    const error = validateLink(project, next, id);
    if (error) {
      setNotice(error);
      return;
    }
    setProject((current) => ({
      ...current,
      links: current.links.map((link) => link.id === id ? next : link),
    }));
    setNotice("連線資料已更新");
  }

  function removeSelected() {
    if (!canWriteActiveTopology) {
      setNotice("目前身分沒有編輯此拓樸的權限");
      return;
    }
    if (!selection) return;
    if (selection.kind === "device") {
      setProject((current) => ({
        ...current,
        devices: current.devices.filter((device) => device.id !== selection.id),
        links: current.links.filter((link) => link.from !== selection.id && link.to !== selection.id),
      }));
      setNotice("設備與相關連線已移除");
    } else {
      setProject((current) => ({ ...current, links: current.links.filter((link) => link.id !== selection.id) }));
      setNotice("連線已移除");
    }
    setSelection(undefined);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">N</span>
          <div><strong>NetTopo Studio</strong><small>網路架構拓樸編輯器</small></div>
        </div>
        <div className="project-switcher" aria-label="客戶與拓樸切換">
          <div className="switcher-field">
            <label htmlFor="customer-select">客戶</label>
            <div className="switcher-row">
              <select
                id="customer-select"
                value={activeCustomerId ?? ""}
                onChange={(event) => {
                  void selectCustomer(event.target.value);
                  setSelection(undefined);
                  setNotice("已切換客戶");
                }}
                disabled={!ready || customers.length === 0}
              >
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
              <button className="mini-action" onClick={() => setShowCustomerForm(true)} disabled={!canCreateRecords}>新增</button>
            </div>
            <div className="switch-actions">
              <button onClick={() => setCustomerAction("rename")} disabled={!activeCustomerId || !canManageActiveCustomer}>改名</button>
              <button onClick={() => setCustomerAction("duplicate")} disabled={!activeCustomerId || !canCreateRecords}>複製</button>
              <button className="danger-link" onClick={() => setCustomerAction("delete")} disabled={!activeCustomerId || !canDeleteActiveCustomer}>刪除</button>
            </div>
          </div>
          <div className="switcher-field">
            <label htmlFor="topology-select">拓樸</label>
            <div className="switcher-row">
              <select
                id="topology-select"
                value={activeTopologyId ?? ""}
                onChange={(event) => {
                  void selectTopology(event.target.value);
                  setSelection(undefined);
                  setNotice("已切換拓樸");
                }}
                disabled={!ready || currentTopologies.length === 0}
              >
                {currentTopologies.map((topology) => <option key={topology.id} value={topology.id}>{topology.name}</option>)}
              </select>
              <button className="mini-action" onClick={() => setShowTopologyForm(true)} disabled={!activeCustomerId || !canCreateRecords}>新增</button>
            </div>
            <div className="switch-actions">
              <button onClick={() => setTopologyAction("rename")} disabled={!activeTopologyId || !canWriteActiveTopology}>改名</button>
              <button onClick={() => setTopologyAction("duplicate")} disabled={!activeTopologyId || !canCreateRecords}>複製</button>
              <button className="danger-link" onClick={() => setTopologyAction("delete")} disabled={!activeTopologyId || !canWriteActiveTopology}>刪除</button>
            </div>
          </div>
          <div className="save-state">
            <span className={`saved-dot ${saving ? "saving" : ""}`} />
            <small>{saving ? "儲存中" : "已自動儲存"}</small>
            {currentUser && <span className="role-badge">{ROLE_LABELS[currentUser.role]} · {currentUser.name}</span>}
          </div>
        </div>
        <div className="top-actions">
          <label className="identity-picker">
            <span>測試身分</span>
            <select
              value={devUserEmail}
              onChange={(event) => {
                void setDevUserEmail(event.target.value);
                setSelection(undefined);
                setNotice("正在切換測試身分...");
              }}
            >
              {DEV_IDENTITIES.map((identity) => <option key={identity.email} value={identity.email}>{identity.label}</option>)}
            </select>
          </label>
          <label className="layout-picker">
            <span>排版模式</span>
            <select value={layoutMode} onChange={(event) => setLayoutMode(event.target.value as LayoutMode)}>
              <option value="auto-detect">自動偵測</option>
              <option value="three-tier">三層式</option>
              <option value="spine-leaf">Spine-Leaf</option>
              <option value="layered">一般分層</option>
            </select>
          </label>
          <button className="mini-action" onClick={() => setShowTransfer("import")}>匯入</button>
          <button className="mini-action" onClick={() => setShowTransfer("export")}>匯出</button>
          <button className="secondary" onClick={autoLayout} disabled={!canWriteActiveTopology}>自動整理</button>
          <button className="primary" onClick={() => window.print()}>匯出 PDF</button>
        </div>
      </header>

      {!panelLayoutReady || !ready ? (
        <div className="workspace workspace-loading">
          <span>正在載入拓樸工作區...</span>
        </div>
      ) : <PanelGroup
        key={`${panelLayout.sidebar}-${panelLayout.canvas}-${panelLayout.inspector}`}
        className="workspace"
        defaultLayout={panelLayout}
        orientation="horizontal"
        resizeTargetMinimumSize={{ fine: 16, coarse: 28 }}
        onLayoutChanged={(layout) => {
          if (isSafePanelLayout(layout)) setPanelLayout(layout);
        }}
      >
        <Panel id="sidebar" className="workspace-panel sidebar-panel" minSize={PANEL_LIMITS.sidebar.minSize} maxSize={PANEL_LIMITS.sidebar.maxSize}>
          <aside className="sidebar">
            <nav className="tabs">
              <button className={tab === "devices" ? "active" : ""} onClick={() => setTab("devices")}>設備</button>
              <button className={tab === "links" ? "active" : ""} onClick={() => setTab("links")}>連線</button>
              <button className={tab === "groups" ? "active" : ""} onClick={() => setTab("groups")}>容器</button>
            </nav>

            {tab === "devices" && (
              <>
                <div className="panel-heading"><div><h2>設備清單</h2><p>{project.devices.length} 個節點 · {totalDeviceQuantity} 台設備</p></div>{canWriteActiveTopology && <button className="icon-button" onClick={() => setShowDeviceForm(true)}>+</button>}</div>
                <div className="device-list">
                  {project.devices.map((device) => (
                    <button key={device.id} className={`device-row ${selection?.kind === "device" && selection.id === device.id ? "selected" : ""}`} onClick={() => setSelection({ kind: "device", id: device.id })}>
                      <span className={`device-icon type-${device.type}`}>{TYPE_MAP[device.type].glyph}</span>
                      <span><strong>{device.name}{deviceQuantity(device) > 1 && ` x${deviceQuantity(device)}`}</strong><small>{TYPE_MAP[device.type].label} · {device.ip || "未設定 IP"}</small></span>
                    </button>
                  ))}
                </div>
                {canWriteActiveTopology && <button className="wide-button" onClick={() => setShowDeviceForm(true)}>+ 新增設備</button>}
              </>
            )}

            {tab === "links" && (
              <>
                <div className="panel-heading"><div><h2>實體與無線連線</h2><p>{project.links.length} 條連線</p></div>{canWriteActiveTopology && <button className="icon-button" onClick={() => setShowLinkForm(true)}>+</button>}</div>
                <div className="link-list">
                  {project.links.map((link) => {
                    const a = project.devices.find((device) => device.id === link.from);
                    const b = project.devices.find((device) => device.id === link.to);
                    return (
                      <button className={`link-row ${linkVisualClass(link)} ${selection?.kind === "link" && selection.id === link.id ? "selected" : ""}`} key={link.id} onClick={() => setSelection({ kind: "link", id: link.id })}>
                        <span>{link.kind === "wired" ? "--" : "~"}</span>
                        <div><strong>{a?.name} → {b?.name}</strong><small>{link.fromPort || "Port"} / {link.toPort || "Port"} · {link.speed || "未標示速率"} {link.vlan && `· VLAN ${link.vlan}`}</small></div>
                      </button>
                    );
                  })}
                </div>
                {canWriteActiveTopology && <button className="wide-button" onClick={() => setShowLinkForm(true)}>+ 建立連線</button>}
              </>
            )}

            {tab === "groups" && (
              <>
                <div className="panel-heading"><div><h2>架構容器</h2><p>分點、網域、VLAN</p></div>{canWriteActiveTopology && <button className="icon-button" onClick={() => setShowGroupForm(true)}>+</button>}</div>
                <div className="group-list">
                  {effectiveProject.groups.map((group) => {
                    const members = project.devices.filter((device) => device.groupId === group.id);
                    const quantity = members.reduce((sum, device) => sum + deviceQuantity(device), 0);
                    return (
                      <div className="group-row" key={group.id}>
                        <span style={{ background: group.color }} />
                        <div>
                          <strong>{group.name}</strong>
                          <small>{group.kind === "site" ? "分點" : group.kind === "domain" ? "網域" : "VLAN"} · {members.length} 節點 / {quantity} 台</small>
                        </div>
                        <button
                          type="button"
                          className="group-toggle"
                          title={group.collapsed ? "展開群組" : "折疊群組"}
                          aria-label={group.collapsed ? `展開 ${group.name}` : `折疊 ${group.name}`}
                          aria-pressed={Boolean(group.collapsed)}
                          onClick={() => toggleGroupCollapsed(group.id)}
                          disabled={members.length === 0}
                        >
                          {group.collapsed ? "+" : "−"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                {canWriteActiveTopology && <button className="wide-button" onClick={() => setShowGroupForm(true)}>+ 新增容器</button>}
            </>
            )}
            <div className="local-note">權限模式<br /><span>{activeCustomer?.name ?? "未選客戶"} / {activeTopology?.name ?? "未選拓樸"} / {activeSite?.name ?? "未指定站點"}。{canWriteActiveTopology ? "目前身分可編輯此拓樸。" : "目前身分僅可讀取此拓樸。"}</span></div>
          </aside>
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        <Panel id="canvas" className="workspace-panel canvas-panel" minSize={PANEL_LIMITS.canvas.minSize}>
          <section className="canvas-wrap">
            <div className="canvas-toolbar">
              <span className="status">{notice}</span>
              <span className="toolbar-hint">滑鼠滾輪縮放 · 拖曳空白處平移 · 拖曳設備調整位置</span>
            </div>
            <div className="flow-shell">
              <ReactFlow
                nodes={nodes}
                edges={[]}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => {
                  const collapsedGroup = canvasProject.devices.find((device) => device.id === node.id)?.collapsedGroup;
                  if (collapsedGroup) toggleGroupCollapsed(collapsedGroup.id);
                  else setSelection({ kind: "device", id: node.id });
                }}
                onEdgeClick={(_, edge) => setSelection({ kind: "link", id: edge.id })}
                fitView
                minZoom={0.25}
                maxZoom={2}
              >
                <ViewportPortal>
                  <svg className="flow-link-overlay" width="4000" height="2400">
                    {renderedCanvasLinks.map((link) => {
                      const route = routeTopologyLink(link, canvasProject);
                      if (!route) return null;
                      const label = [link.aggregateCount && link.aggregateCount > 1 ? `${link.aggregateCount} 條連線` : undefined, link.speed, link.vlan && `VLAN ${link.vlan}`].filter(Boolean).join(" · ");
                      const selected = selection?.kind === "link" && selection.id === link.id;
                      const labelWidth = Math.max(42, label.length * 6.5 + 16);
                      const path = routePath(route.points);
                      return (
                        <g key={link.id} data-link-id={link.id} data-route-kind={route.kind} className={`flow-link ${linkVisualClass(link)} ${route.kind} ${selected ? "selected" : ""}`}>
                          <path className="hit-line" d={path} onClick={() => setSelection({ kind: "link", id: link.id })} />
                          {selected && <path className="selection-line" d={path} />}
                          <path className="visible-line" d={path} onClick={() => setSelection({ kind: "link", id: link.id })} />
                          {label && (
                            <g className="flow-link-label" transform={`translate(${route.labelPoint.x} ${route.labelPoint.y})`}>
                              <rect x={-labelWidth / 2} y={-12} width={labelWidth} height="18" rx="5" />
                              <text y="1">{label}</text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </ViewportPortal>
                <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
                <Controls showInteractive={false} />
                <MiniMap pannable zoomable nodeStrokeWidth={3} />
              </ReactFlow>
            </div>
          </section>
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        <Panel id="inspector" className="workspace-panel inspector-panel" minSize={PANEL_LIMITS.inspector.minSize} maxSize={PANEL_LIMITS.inspector.maxSize}>
          <aside className="inspector">
            <h2>資訊欄位</h2>
            {selectedDevice && <DeviceInspector device={selectedDevice} groups={project.groups} canEdit={canWriteActiveTopology} onSave={(data) => updateDevice(selectedDevice.id, data)} onDelete={removeSelected} />}
            {selectedLink && <LinkInspector link={selectedLink} devices={project.devices} canEdit={canWriteActiveTopology} onSave={(data) => updateLink(selectedLink.id, data)} onDelete={removeSelected} />}
            {!selectedDevice && !selectedLink && <div className="inspect-empty">點選畫布、設備清單或連線清單，即可在這裡編輯資料。</div>}
          </aside>
        </Panel>
      </PanelGroup>}

      {showDeviceForm && <Modal title="新增設備" onClose={() => setShowDeviceForm(false)}>
        <form action={addDevice} className="form-grid">
          <DeviceFields groups={project.groups} />
          <FormActions onCancel={() => setShowDeviceForm(false)} />
        </form>
      </Modal>}

      {showLinkForm && <Modal title="建立設備連線" onClose={() => setShowLinkForm(false)}>
        <form action={addLink} className="form-grid">
          <LinkFields devices={project.devices} />
          <FormActions onCancel={() => setShowLinkForm(false)} />
        </form>
      </Modal>}

      {showGroupForm && <Modal title="新增架構容器" onClose={() => setShowGroupForm(false)}>
        <form action={addGroup} className="form-grid">
          <label className="full">容器名稱<input name="name" required placeholder="例如：台中分點、CORP.LOCAL、VLAN 20" /></label>
          <label>分類<select name="kind"><option value="site">分點</option><option value="domain">網域</option><option value="vlan">VLAN</option></select></label>
          <label>識別色<input name="color" type="color" defaultValue="#526cf5" /></label>
          <FormActions onCancel={() => setShowGroupForm(false)} />
        </form>
      </Modal>}

      {showCustomerForm && <Modal title="新增客戶" onClose={() => setShowCustomerForm(false)}>
        <form action={addCustomer} className="form-grid">
          <label className="full">客戶名稱<input name="name" required placeholder="例如：興恆毅、A 客戶總公司" /></label>
          <SiteField sites={availableSites} defaultSiteId={activeTopology?.siteId} />
          <div className="secret-warning full">新增客戶會建立一張空白的「現況拓樸」，方便與其他客戶資料分開保存。</div>
          <FormActions onCancel={() => setShowCustomerForm(false)} submitLabel="建立客戶" />
        </form>
      </Modal>}

      {showTopologyForm && <Modal title="新增拓樸" onClose={() => setShowTopologyForm(false)}>
        <form action={addTopology} className="form-grid">
          <label className="full">拓樸名稱<input name="name" required placeholder="例如：更新後拓樸、B 分店現況" /></label>
          <SiteField sites={availableSites} defaultSiteId={activeTopology?.siteId} />
          <label className="check-row full"><input name="copyCurrent" type="checkbox" defaultChecked /> 複製目前拓樸作為新版草稿</label>
          <FormActions onCancel={() => setShowTopologyForm(false)} submitLabel="建立拓樸" />
        </form>
      </Modal>}

      {showTransfer === "import" && <Modal title="匯入拓樸資料" onClose={() => {
        setShowTransfer(undefined);
        setImportPlan(undefined);
        setImportStrategy("new");
      }}>
        <div className="transfer-panel">
          <div className="transfer-drop">
            <strong>選擇 JSON 或 CSV 檔案</strong>
            <p>JSON 一次一個；CSV 請使用 devices.csv、links.csv、groups.csv，可同時選取。</p>
            <input
              type="file"
              accept=".json,.csv,application/json,text/csv"
              multiple
              onChange={(event) => void prepareImport(event.target.files)}
            />
          </div>

          {importBusy && <p className="transfer-loading">正在解析與驗證檔案…</p>}

          {importPlan && <>
            <div className="import-summary">
              <span><strong>{importPlan.summary.devices}</strong>設備</span>
              <span><strong>{importPlan.summary.links}</strong>連線</span>
              <span><strong>{importPlan.summary.groups}</strong>群組</span>
              <span className={importPlan.canApply ? "summary-ok" : "summary-error"}>
                {importPlan.canApply ? "可匯入" : "需修正"}
              </span>
            </div>

            <div className="import-issues" aria-live="polite">
              {importPlan.issues.length === 0
                ? <p className="issue-ok">資料與跨表關聯驗證通過。</p>
                : importPlan.issues.map((issue, index) => (
                  <p className={`issue-${issue.severity}`} key={`${issue.code}-${index}`}>
                    <strong>{issue.severity === "error" ? "錯誤" : "警告"}</strong>
                    {issue.message}
                    {issue.path && <small>{issue.path}</small>}
                  </p>
                ))}
            </div>

            <div className="import-options">
              <label>
                套用策略
                <select value={importStrategy} onChange={(event) => setImportStrategy(event.target.value as ImportStrategy)}>
                  <option value="new">建立新拓樸（預設）</option>
                  <option value="merge">合併到目前拓樸</option>
                  <option value="replace">取代目前拓樸</option>
                </select>
              </label>
              {importStrategy === "new" && <label>
                新拓樸名稱
                <input value={importName} onChange={(event) => setImportName(event.target.value)} />
              </label>}
            </div>

            {importStrategy === "replace" && <p className="replace-warning">取代會完整覆蓋目前拓樸的設備、連線與群組。</p>}

            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setShowTransfer(undefined)}>取消</button>
              <button type="button" className="primary" disabled={!importPlan.canApply || importBusy} onClick={() => void confirmImport()}>
                {importBusy ? "匯入中…" : "確認匯入"}
              </button>
            </div>
          </>}
        </div>
      </Modal>}

      {showTransfer === "export" && <Modal title="匯出拓樸資料" onClose={() => setShowTransfer(undefined)}>
        <div className="transfer-panel export-options">
          <div>
            <h3>JSON 完整備份</h3>
            <p>包含 schemaVersion 與所有設備欄位，適合備份及還原。</p>
            <button className="primary" type="button" onClick={() => exportJson(false)}>下載完整 JSON</button>
          </div>
          <div>
            <h3>JSON 安全分享版</h3>
            <p>自動移除帳密、管理網址、IP、MAC 與設備位置。</p>
            <button className="secondary" type="button" onClick={() => exportJson(true)}>下載安全 JSON</button>
          </div>
          <div>
            <h3>CSV 三檔</h3>
            <p>輸出 devices.csv、links.csv、groups.csv，適合試算表編輯。</p>
            <div className="export-buttons">
              <button className="secondary" type="button" onClick={() => exportCsv(false)}>完整 CSV</button>
              <button className="secondary" type="button" onClick={() => exportCsv(true)}>安全 CSV</button>
            </div>
          </div>
        </div>
      </Modal>}

      {customerAction === "rename" && <Modal title="重新命名客戶" onClose={() => setCustomerAction(undefined)}>
        <form action={renameActiveCustomer} className="form-grid">
          <label className="full">客戶名稱<input name="name" required defaultValue={activeCustomer?.name} /></label>
          <FormActions onCancel={() => setCustomerAction(undefined)} submitLabel="儲存名稱" />
        </form>
      </Modal>}

      {topologyAction === "rename" && <Modal title="重新命名拓樸" onClose={() => setTopologyAction(undefined)}>
        <form action={renameActiveTopology} className="form-grid">
          <label className="full">拓樸名稱<input name="name" required defaultValue={activeTopology?.name} /></label>
          <FormActions onCancel={() => setTopologyAction(undefined)} submitLabel="儲存名稱" />
        </form>
      </Modal>}

      {customerAction === "duplicate" && <Modal title="複製客戶" onClose={() => setCustomerAction(undefined)}>
        <div className="confirm-panel">
          <p>將複製「{activeCustomer?.name}」以及底下所有拓樸，並切換到新的客戶複本。</p>
          <div className="form-actions">
            <button type="button" className="secondary" onClick={() => setCustomerAction(undefined)}>取消</button>
            <button type="button" className="primary" onClick={duplicateActiveCustomer}>複製客戶</button>
          </div>
        </div>
      </Modal>}

      {topologyAction === "duplicate" && <Modal title="複製拓樸" onClose={() => setTopologyAction(undefined)}>
        <div className="confirm-panel">
          <p>將在目前客戶底下複製「{activeTopology?.name}」，並切換到新的拓樸複本。</p>
          <div className="form-actions">
            <button type="button" className="secondary" onClick={() => setTopologyAction(undefined)}>取消</button>
            <button type="button" className="primary" onClick={duplicateActiveTopology}>複製拓樸</button>
          </div>
        </div>
      </Modal>}

      {customerAction === "delete" && <Modal title="刪除客戶" onClose={() => setCustomerAction(undefined)}>
        <div className="confirm-panel danger-confirm">
          <p>確定要刪除「{activeCustomer?.name}」嗎？此客戶底下所有拓樸都會一併刪除。</p>
          <div className="form-actions">
            <button type="button" className="secondary" onClick={() => setCustomerAction(undefined)}>取消</button>
            <button type="button" className="danger" onClick={deleteActiveCustomer}>刪除客戶</button>
          </div>
        </div>
      </Modal>}

      {topologyAction === "delete" && <Modal title="刪除拓樸" onClose={() => setTopologyAction(undefined)}>
        <div className="confirm-panel danger-confirm">
          <p>確定要刪除「{activeTopology?.name}」嗎？如果這是該客戶最後一張拓樸，系統會自動補一張空白現況拓樸。</p>
          <div className="form-actions">
            <button type="button" className="secondary" onClick={() => setTopologyAction(undefined)}>取消</button>
            <button type="button" className="danger" onClick={deleteActiveTopology}>刪除拓樸</button>
          </div>
        </div>
      </Modal>}
    </main>
  );
}

function DeviceFields({ device, groups }: { device?: Device; groups: Group[] }) {
  return (
    <>
      <label>設備名稱<input name="name" required defaultValue={device?.name} placeholder="例如：核心交換器" /></label>
      <label>設備類型<select name="type" defaultValue={device?.type}>{TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
      <label>代表數量<input name="quantity" type="number" min="1" max={MAX_DEVICE_QUANTITY} defaultValue={device?.quantity ?? 1} /></label>
      <label>所屬容器<select name="groupId" defaultValue={device?.groupId ?? ""}><option value="">未分類</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
      <label>IP 位址<input name="ip" defaultValue={device?.ip} placeholder="192.168.1.1" /></label>
      <label>MAC 位址<input name="mac" defaultValue={device?.mac} placeholder="00:00:00:00:00:00" /></label>
      <label>品牌／型號<input name="model" defaultValue={device?.model} placeholder="FortiGate 90G" /></label>
      <label>實體位置<input name="location" defaultValue={device?.location} placeholder="機房 A 櫃" /></label>
      <label className="full">管理網址<input name="url" defaultValue={device?.url} placeholder="https://192.168.1.1" /></label>
      <div className="secret-warning full">帳密只儲存在此瀏覽器，未經密碼庫等級加密。請勿在共用電腦輸入正式密碼。</div>
      <label>管理帳號<input name="username" defaultValue={device?.username} autoComplete="off" /></label>
      <label>管理密碼<input name="password" type="password" defaultValue={device?.password} autoComplete="new-password" /></label>
    </>
  );
}

function LinkFields({ link, devices }: { link?: Link; devices: Device[] }) {
  return (
    <>
      <label>來源設備<select name="from" required defaultValue={link?.from ?? ""}><option value="">請選擇</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</select></label>
      <label>目的設備<select name="to" required defaultValue={link?.to ?? ""}><option value="">請選擇</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</select></label>
      <label>連線方式<select name="kind" defaultValue={link?.kind ?? "wired"}><option value="wired">實體有線</option><option value="wireless">無線連線</option></select></label>
      <label>連線速率<select name="speed" defaultValue={link?.speed ?? ""}><option value="">未標示</option><option>100 Mbps</option><option>1 Gbps</option><option>2.5 Gbps</option><option>5 Gbps</option><option>10 Gbps</option><option>25 Gbps</option><option>40 Gbps</option><option>100 Gbps</option></select></label>
      <label>來源介面／Port<input name="fromPort" defaultValue={link?.fromPort} placeholder="WAN1 / Port 1" /></label>
      <label>目的介面／Port<input name="toPort" defaultValue={link?.toPort} placeholder="LAN1 / Port 24" /></label>
      <label className="full">VLAN<input name="vlan" defaultValue={link?.vlan} placeholder="例如：10、20 或 Trunk" /></label>
    </>
  );
}

function SiteField({ sites, defaultSiteId }: { sites: SiteRecord[]; defaultSiteId?: string }) {
  return (
    <label className="full">
      所屬站點
      <select name="siteId" defaultValue={defaultSiteId ?? sites[0]?.id ?? ""} required>
        {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
      </select>
    </label>
  );
}

function DeviceInspector({ device, groups, canEdit, onSave, onDelete }: { device: Device; groups: Group[]; canEdit: boolean; onSave: (data: FormData) => void; onDelete: () => void }) {
  return (
    <form action={onSave} className="inspector-form">
      <div className={`inspect-icon type-${device.type}`}>{TYPE_MAP[device.type].glyph}</div>
      <DeviceFields device={device} groups={groups} />
      {canEdit ? (
        <div className="inspector-actions">
          <button type="button" className="danger" onClick={onDelete}>刪除設備</button>
          <button type="submit" className="primary">儲存設備</button>
        </div>
      ) : <div className="inspect-empty">目前身分只有讀取權限。</div>}
    </form>
  );
}

function LinkInspector({ link, devices, canEdit, onSave, onDelete }: { link: Link; devices: Device[]; canEdit: boolean; onSave: (data: FormData) => void; onDelete: () => void }) {
  return (
    <form action={onSave} className="inspector-form">
      <div className="inspect-link-icon">{link.kind === "wired" ? "--" : "~"}</div>
      <LinkFields link={link} devices={devices} />
      {canEdit ? (
        <div className="inspector-actions">
          <button type="button" className="danger" onClick={onDelete}>刪除連線</button>
          <button type="submit" className="primary">儲存連線</button>
        </div>
      ) : <div className="inspect-empty">目前身分只有讀取權限。</div>}
    </form>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal"><header><h2>{title}</h2><button onClick={onClose}>×</button></header>{children}</section>
  </div>;
}

function FormActions({ onCancel, submitLabel = "確認新增" }: { onCancel: () => void; submitLabel?: string }) {
  return <div className="form-actions full"><button type="button" className="secondary" onClick={onCancel}>取消</button><button type="submit" className="primary">{submitLabel}</button></div>;
}
