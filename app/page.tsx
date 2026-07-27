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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DeviceType =
  | "router"
  | "modem"
  | "firewall"
  | "switch"
  | "server"
  | "nas"
  | "erp"
  | "access-point"
  | "client";

type Device = {
  id: string;
  name: string;
  type: DeviceType;
  ip?: string;
  mac?: string;
  model?: string;
  location?: string;
  url?: string;
  username?: string;
  password?: string;
  x: number;
  y: number;
  groupId?: string;
};

type Link = {
  id: string;
  from: string;
  to: string;
  kind: "wired" | "wireless";
  fromPort?: string;
  toPort?: string;
  vlan?: string;
  speed?: string;
};

type Group = {
  id: string;
  name: string;
  kind: "site" | "domain" | "vlan";
  color: string;
};

type Project = { devices: Device[]; links: Link[]; groups: Group[] };
type Selection = { kind: "device"; id: string } | { kind: "link"; id: string };

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
];

const TYPE_MAP = Object.fromEntries(TYPES.map((item) => [item.value, item])) as Record<DeviceType, (typeof TYPES)[number]>;
const DEVICE_ORDER: DeviceType[] = ["modem", "router", "firewall", "switch", "access-point", "server", "nas", "erp", "client"];
const STORAGE_KEY = "nettopo-studio-v1";
const PANEL_LAYOUT_KEY = "nettopo-panel-layout-v1";
const NODE_WIDTH = 178;
const NODE_HEIGHT = 112;

const SAMPLE: Project = {
  groups: [
    { id: "g-hq", name: "台北總公司", kind: "site", color: "#526cf5" },
    { id: "g-vlan", name: "VLAN 20｜Server Zone", kind: "vlan", color: "#18a674" },
  ],
  devices: [
    { id: "d-modem", name: "中華電信數據機", type: "modem", ip: "114.x.x.x", x: 80, y: 150, groupId: "g-hq" },
    { id: "d-fw", name: "FortiGate 90G", type: "firewall", ip: "192.168.1.1", x: 330, y: 150, groupId: "g-hq" },
    { id: "d-sw", name: "核心交換器", type: "switch", ip: "192.168.1.2", x: 580, y: 150, groupId: "g-hq" },
    { id: "d-nas", name: "Synology NAS", type: "nas", ip: "192.168.20.10", x: 830, y: 150, groupId: "g-vlan" },
  ],
  links: [
    { id: "l1", from: "d-modem", to: "d-fw", kind: "wired", fromPort: "LAN1", toPort: "WAN1", speed: "1 Gbps" },
    { id: "l2", from: "d-fw", to: "d-sw", kind: "wired", fromPort: "LAN2", toPort: "Port 1", vlan: "Trunk", speed: "10 Gbps" },
    { id: "l3", from: "d-sw", to: "d-nas", kind: "wired", fromPort: "Port 8", toPort: "LAN1", vlan: "20", speed: "1 Gbps" },
  ],
};

const DEFAULT_PANEL_LAYOUT = { sidebar: 24, canvas: 52, inspector: 24 };
const PANEL_LIMITS = {
  sidebar: { min: 16, max: 32 },
  canvas: { min: 38, max: 72 },
  inspector: { min: 14, max: 34 },
};

const elk = new ELK();

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
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

function safeProject(value: string | null) {
  if (!value) return SAMPLE;
  try {
    const parsed = JSON.parse(value) as Project;
    if (Array.isArray(parsed.devices) && Array.isArray(parsed.links) && Array.isArray(parsed.groups)) return parsed;
  } catch {
    return SAMPLE;
  }
  return SAMPLE;
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
      sidebar >= PANEL_LIMITS.sidebar.min &&
      sidebar <= PANEL_LIMITS.sidebar.max &&
      canvas >= PANEL_LIMITS.canvas.min &&
      canvas <= PANEL_LIMITS.canvas.max &&
      inspector >= PANEL_LIMITS.inspector.min &&
      inspector <= PANEL_LIMITS.inspector.max
    ) return { sidebar, canvas, inspector };
  } catch {
    return DEFAULT_PANEL_LAYOUT;
  }
  return DEFAULT_PANEL_LAYOUT;
}

function isSafePanelLayout(layout: Record<string, number>) {
  return safePanelLayout(JSON.stringify(layout)) !== DEFAULT_PANEL_LAYOUT;
}

function deviceToNode(device: Device, selected: boolean): Node {
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
        </div>
      ),
    },
    className: `flow-node type-${device.type}`,
  };
}

function linkToEdge(link: Link, selected: boolean, project: Project): Edge {
  const fromDevice = project.devices.find((device) => device.id === link.from);
  const toDevice = project.devices.find((device) => device.id === link.to);
  const labelParts = [link.speed, link.vlan && `VLAN ${link.vlan}`].filter(Boolean);

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
    className: link.kind === "wireless" ? "flow-edge-wireless" : "flow-edge-wired",
  };
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

export default function Home() {
  const [project, setProject] = useState<Project>(SAMPLE);
  const [panelLayout, setPanelLayout] = useState<Record<string, number>>(DEFAULT_PANEL_LAYOUT);
  const [panelLayoutReady, setPanelLayoutReady] = useState(false);
  const [tab, setTab] = useState<"devices" | "links" | "groups">("devices");
  const [selection, setSelection] = useState<Selection>();
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [notice, setNotice] = useState("資料僅儲存在這台裝置的瀏覽器");
  const loadedRef = useRef(false);

  useEffect(() => {
    queueMicrotask(() => {
      setProject(safeProject(localStorage.getItem(STORAGE_KEY)));
      const storedPanelLayout = localStorage.getItem(PANEL_LAYOUT_KEY);
      const nextPanelLayout = safePanelLayout(storedPanelLayout);
      if (storedPanelLayout && nextPanelLayout === DEFAULT_PANEL_LAYOUT) localStorage.removeItem(PANEL_LAYOUT_KEY);
      setPanelLayout(nextPanelLayout);
      setPanelLayoutReady(true);
      loadedRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (loadedRef.current) localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  }, [project]);

  useEffect(() => {
    if (!loadedRef.current || !panelLayoutReady) return;
    if (isSafePanelLayout(panelLayout)) localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(panelLayout));
    else localStorage.removeItem(PANEL_LAYOUT_KEY);
  }, [panelLayout, panelLayoutReady]);

  const selectedDevice = selection?.kind === "device" ? project.devices.find((device) => device.id === selection.id) : undefined;
  const selectedLink = selection?.kind === "link" ? project.links.find((link) => link.id === selection.id) : undefined;

  const nodes = useMemo(
    () => project.devices.map((device) => deviceToNode(device, selection?.kind === "device" && selection.id === device.id)),
    [project.devices, selection],
  );

  const edges = useMemo(
    () => project.links.map((link) => linkToEdge(link, selection?.kind === "link" && selection.id === link.id, project)),
    [project, selection],
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const updated = applyNodeChanges(changes, nodes);
    const positionById = new Map(updated.map((node) => [node.id, node.position]));
    setProject((current) => ({
      ...current,
      devices: current.devices.map((device) => {
        const position = positionById.get(device.id);
        return position ? { ...device, x: position.x, y: position.y } : device;
      }),
    }));
  }, [nodes]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    applyEdgeChanges(changes, edges);
  }, [edges]);

  function addDevice(data: FormData) {
    const count = Math.max(1, Math.min(20, Number(data.get("count")) || 1));
    const baseName = clean(data.get("name")) || "新設備";
    const type = (clean(data.get("type")) || "client") as DeviceType;
    const additions = Array.from({ length: count }, (_, index): Device => ({
      id: uid("dev"),
      name: count > 1 ? `${baseName} ${index + 1}` : baseName,
      type,
      ip: clean(data.get("ip")),
      mac: clean(data.get("mac")),
      model: clean(data.get("model")),
      location: clean(data.get("location")),
      url: clean(data.get("url")),
      username: clean(data.get("username")),
      password: clean(data.get("password")),
      groupId: clean(data.get("groupId")) || undefined,
      x: 80 + ((project.devices.length + index) % 4) * 240,
      y: 100 + Math.floor((project.devices.length + index) / 4) * 170,
    }));
    setProject((current) => ({ ...current, devices: [...current.devices, ...additions] }));
    setSelection({ kind: "device", id: additions[0].id });
    setShowDeviceForm(false);
    setNotice(`已新增 ${count} 台設備`);
  }

  function addLink(data: FormData) {
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
    const group: Group = {
      id: uid("group"),
      name: clean(data.get("name")) || "新容器",
      kind: (clean(data.get("kind")) || "site") as Group["kind"],
      color: clean(data.get("color")) || "#526cf5",
    };
    setProject((current) => ({ ...current, groups: [...current.groups, group] }));
    setShowGroupForm(false);
    setNotice("容器已建立，可在設備資料中指定");
  }

  async function autoLayout() {
    setNotice("正在使用 ELK 整理拓樸...");
    setProject(await layoutWithElk(project));
    setNotice("已使用 ELK 自動整理拓樸");
  }

  function updateDevice(id: string, data: FormData) {
    const nextType = (clean(data.get("type")) || "client") as DeviceType;
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
        username: clean(data.get("username")),
        password: clean(data.get("password")),
        groupId: clean(data.get("groupId")) || undefined,
      } : device),
    }));
    setNotice("設備資料已更新");
  }

  function updateLink(id: string, data: FormData) {
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
        <div className="project-name"><span className="saved-dot" /> 我的網路架構 <small>自動儲存</small></div>
        <div className="top-actions">
          <button className="secondary" onClick={autoLayout}>自動整理</button>
          <button className="primary" onClick={() => window.print()}>匯出 PDF</button>
        </div>
      </header>

      {!panelLayoutReady ? (
        <div className="workspace workspace-loading">
          <span>Preparing topology workspace...</span>
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
        <Panel id="sidebar" className="workspace-panel" minSize={PANEL_LIMITS.sidebar.min} maxSize={PANEL_LIMITS.sidebar.max}>
          <aside className="sidebar">
            <nav className="tabs">
              <button className={tab === "devices" ? "active" : ""} onClick={() => setTab("devices")}>設備</button>
              <button className={tab === "links" ? "active" : ""} onClick={() => setTab("links")}>連線</button>
              <button className={tab === "groups" ? "active" : ""} onClick={() => setTab("groups")}>容器</button>
            </nav>

            {tab === "devices" && (
              <>
                <div className="panel-heading"><div><h2>設備清單</h2><p>{project.devices.length} 台設備</p></div><button className="icon-button" onClick={() => setShowDeviceForm(true)}>+</button></div>
                <div className="device-list">
                  {project.devices.map((device) => (
                    <button key={device.id} className={`device-row ${selection?.kind === "device" && selection.id === device.id ? "selected" : ""}`} onClick={() => setSelection({ kind: "device", id: device.id })}>
                      <span className={`device-icon type-${device.type}`}>{TYPE_MAP[device.type].glyph}</span>
                      <span><strong>{device.name}</strong><small>{TYPE_MAP[device.type].label} · {device.ip || "未設定 IP"}</small></span>
                    </button>
                  ))}
                </div>
                <button className="wide-button" onClick={() => setShowDeviceForm(true)}>+ 新增設備</button>
              </>
            )}

            {tab === "links" && (
              <>
                <div className="panel-heading"><div><h2>實體與無線連線</h2><p>{project.links.length} 條連線</p></div><button className="icon-button" onClick={() => setShowLinkForm(true)}>+</button></div>
                <div className="link-list">
                  {project.links.map((link) => {
                    const a = project.devices.find((device) => device.id === link.from);
                    const b = project.devices.find((device) => device.id === link.to);
                    return (
                      <button className={`link-row ${selection?.kind === "link" && selection.id === link.id ? "selected" : ""}`} key={link.id} onClick={() => setSelection({ kind: "link", id: link.id })}>
                        <span>{link.kind === "wired" ? "--" : "~"}</span>
                        <div><strong>{a?.name} → {b?.name}</strong><small>{link.fromPort || "Port"} / {link.toPort || "Port"} · {link.speed || "未標示速率"} {link.vlan && `· VLAN ${link.vlan}`}</small></div>
                      </button>
                    );
                  })}
                </div>
                <button className="wide-button" onClick={() => setShowLinkForm(true)}>+ 建立連線</button>
              </>
            )}

            {tab === "groups" && (
              <>
                <div className="panel-heading"><div><h2>架構容器</h2><p>分點、網域、VLAN</p></div><button className="icon-button" onClick={() => setShowGroupForm(true)}>+</button></div>
                <div className="group-list">
                  {project.groups.map((group) => <div className="group-row" key={group.id}><span style={{ background: group.color }} /><div><strong>{group.name}</strong><small>{group.kind === "site" ? "分點" : group.kind === "domain" ? "網域" : "VLAN"}</small></div></div>)}
                </div>
                <button className="wide-button" onClick={() => setShowGroupForm(true)}>+ 新增容器</button>
              </>
            )}
            <div className="local-note">本機模式<br /><span>拓樸與機密欄位只存於此瀏覽器。共用電腦請勿保存帳密。</span></div>
          </aside>
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        <Panel id="canvas" className="workspace-panel" minSize={PANEL_LIMITS.canvas.min}>
          <section className="canvas-wrap">
            <div className="canvas-toolbar">
              <span className="status">{notice}</span>
              <span className="toolbar-hint">滑鼠滾輪縮放 · 拖曳空白處平移 · 拖曳設備調整位置</span>
            </div>
            <div className="flow-shell">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => setSelection({ kind: "device", id: node.id })}
                onEdgeClick={(_, edge) => setSelection({ kind: "link", id: edge.id })}
                fitView
                minZoom={0.25}
                maxZoom={2}
              >
                <ViewportPortal>
                  <svg className="flow-link-overlay" width="4000" height="2400">
                    {project.links.map((link) => {
                      const from = project.devices.find((device) => device.id === link.from);
                      const to = project.devices.find((device) => device.id === link.to);
                      if (!from || !to) return null;
                      const x1 = from.x + NODE_WIDTH;
                      const y1 = from.y + NODE_HEIGHT / 2;
                      const x2 = to.x;
                      const y2 = to.y + NODE_HEIGHT / 2;
                      const label = [link.speed, link.vlan && `VLAN ${link.vlan}`].filter(Boolean).join(" · ");
                      const selected = selection?.kind === "link" && selection.id === link.id;
                      return (
                        <g key={link.id} className={`flow-link ${link.kind === "wireless" ? "wireless" : "wired"} ${selected ? "selected" : ""}`}>
                          <line className="hit-line" x1={x1} y1={y1} x2={x2} y2={y2} onClick={() => setSelection({ kind: "link", id: link.id })} />
                          <line className="visible-line" x1={x1} y1={y1} x2={x2} y2={y2} onClick={() => setSelection({ kind: "link", id: link.id })} />
                          <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 10}>{label}</text>
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

        <Panel id="inspector" className="workspace-panel" minSize={PANEL_LIMITS.inspector.min} maxSize={PANEL_LIMITS.inspector.max}>
          <aside className="inspector">
            <h2>資訊欄位</h2>
            {selectedDevice && <DeviceInspector device={selectedDevice} groups={project.groups} onSave={(data) => updateDevice(selectedDevice.id, data)} onDelete={removeSelected} />}
            {selectedLink && <LinkInspector link={selectedLink} devices={project.devices} onSave={(data) => updateLink(selectedLink.id, data)} onDelete={removeSelected} />}
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
    </main>
  );
}

function DeviceFields({ device, groups }: { device?: Device; groups: Group[] }) {
  return (
    <>
      <label>設備名稱<input name="name" required defaultValue={device?.name} placeholder="例如：核心交換器" /></label>
      <label>設備類型<select name="type" defaultValue={device?.type}>{TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
      {!device && <label>數量<input name="count" type="number" min="1" max="20" defaultValue="1" /></label>}
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
      <label>連線速率<select name="speed" defaultValue={link?.speed ?? ""}><option value="">未標示</option><option>100 Mbps</option><option>1 Gbps</option><option>2.5 Gbps</option><option>10 Gbps</option><option>40 Gbps</option></select></label>
      <label>來源介面／Port<input name="fromPort" defaultValue={link?.fromPort} placeholder="WAN1 / Port 1" /></label>
      <label>目的介面／Port<input name="toPort" defaultValue={link?.toPort} placeholder="LAN1 / Port 24" /></label>
      <label className="full">VLAN<input name="vlan" defaultValue={link?.vlan} placeholder="例如：10、20 或 Trunk" /></label>
    </>
  );
}

function DeviceInspector({ device, groups, onSave, onDelete }: { device: Device; groups: Group[]; onSave: (data: FormData) => void; onDelete: () => void }) {
  return (
    <form action={onSave} className="inspector-form">
      <div className={`inspect-icon type-${device.type}`}>{TYPE_MAP[device.type].glyph}</div>
      <DeviceFields device={device} groups={groups} />
      <div className="inspector-actions">
        <button type="button" className="danger" onClick={onDelete}>刪除設備</button>
        <button type="submit" className="primary">儲存設備</button>
      </div>
    </form>
  );
}

function LinkInspector({ link, devices, onSave, onDelete }: { link: Link; devices: Device[]; onSave: (data: FormData) => void; onDelete: () => void }) {
  return (
    <form action={onSave} className="inspector-form">
      <div className="inspect-link-icon">{link.kind === "wired" ? "--" : "~"}</div>
      <LinkFields link={link} devices={devices} />
      <div className="inspector-actions">
        <button type="button" className="danger" onClick={onDelete}>刪除連線</button>
        <button type="submit" className="primary">儲存連線</button>
      </div>
    </form>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal"><header><h2>{title}</h2><button onClick={onClose}>×</button></header>{children}</section>
  </div>;
}

function FormActions({ onCancel }: { onCancel: () => void }) {
  return <div className="form-actions full"><button type="button" className="secondary" onClick={onCancel}>取消</button><button type="submit" className="primary">確認新增</button></div>;
}
