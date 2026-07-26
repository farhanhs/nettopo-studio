"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type DeviceType =
  | "router" | "modem" | "firewall" | "switch" | "server"
  | "nas" | "erp" | "access-point" | "client";

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

const TYPES: { value: DeviceType; label: string; glyph: string }[] = [
  { value: "router", label: "Router", glyph: "⇆" },
  { value: "modem", label: "電信商數據機", glyph: "◈" },
  { value: "firewall", label: "Firewall", glyph: "▦" },
  { value: "switch", label: "Switch", glyph: "≋" },
  { value: "server", label: "Server", glyph: "▤" },
  { value: "nas", label: "NAS", glyph: "▥" },
  { value: "erp", label: "ERP", glyph: "E" },
  { value: "access-point", label: "無線 AP", glyph: "⌁" },
  { value: "client", label: "終端設備", glyph: "▱" },
];

const TYPE_MAP = Object.fromEntries(TYPES.map((item) => [item.value, item]));
const STORAGE_KEY = "nettopo-studio-v1";
const SAMPLE: Project = {
  groups: [
    { id: "g-hq", name: "台北總公司", kind: "site", color: "#526cf5" },
    { id: "g-vlan", name: "VLAN 20｜Server Zone", kind: "vlan", color: "#18a674" },
  ],
  devices: [
    { id: "d-modem", name: "中華電信數據機", type: "modem", ip: "114.x.x.x", x: 90, y: 120, groupId: "g-hq" },
    { id: "d-fw", name: "FortiGate 90G", type: "firewall", ip: "192.168.1.1", x: 330, y: 120, groupId: "g-hq" },
    { id: "d-sw", name: "核心交換器", type: "switch", ip: "192.168.1.2", x: 570, y: 120, groupId: "g-hq" },
    { id: "d-nas", name: "Synology NAS", type: "nas", ip: "192.168.20.10", x: 800, y: 120, groupId: "g-vlan" },
  ],
  links: [
    { id: "l1", from: "d-modem", to: "d-fw", kind: "wired", fromPort: "LAN1", toPort: "WAN1", speed: "1 Gbps" },
    { id: "l2", from: "d-fw", to: "d-sw", kind: "wired", fromPort: "LAN2", toPort: "Port 1", vlan: "Trunk", speed: "10 Gbps" },
    { id: "l3", from: "d-sw", to: "d-nas", kind: "wired", fromPort: "Port 8", toPort: "LAN1", vlan: "20", speed: "1 Gbps" },
  ],
};

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function Home() {
  const [project, setProject] = useState<Project>(SAMPLE);
  const loadedRef = useRef(false);
  const [tab, setTab] = useState<"devices" | "links" | "groups">("devices");
  const [selectedId, setSelectedId] = useState<string>();
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [notice, setNotice] = useState("資料僅儲存在這台裝置的瀏覽器");

  useEffect(() => {
    queueMicrotask(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setProject(JSON.parse(saved));
      loadedRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (loadedRef.current) localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  }, [project]);

  const selected = project.devices.find((device) => device.id === selectedId);
  const groupBounds = useMemo(() => {
    return project.groups.map((group) => {
      const members = project.devices.filter((device) => device.groupId === group.id);
      if (!members.length) return { ...group, x: 30, y: 340, w: 240, h: 160 };
      const xs = members.map((d) => d.x);
      const ys = members.map((d) => d.y);
      return {
        ...group,
        x: Math.max(20, Math.min(...xs) - 28),
        y: Math.max(20, Math.min(...ys) - 52),
        w: Math.max(...xs) - Math.min(...xs) + 236,
        h: Math.max(...ys) - Math.min(...ys) + 164,
      };
    });
  }, [project.groups, project.devices]);

  function addDevice(data: FormData) {
    const count = Math.max(1, Math.min(20, Number(data.get("count")) || 1));
    const baseName = String(data.get("name") || "新設備");
    const type = String(data.get("type")) as DeviceType;
    const additions = Array.from({ length: count }, (_, index): Device => ({
      id: uid("dev"),
      name: count > 1 ? `${baseName} ${index + 1}` : baseName,
      type,
      ip: String(data.get("ip") || ""),
      mac: String(data.get("mac") || ""),
      model: String(data.get("model") || ""),
      location: String(data.get("location") || ""),
      url: String(data.get("url") || ""),
      username: String(data.get("username") || ""),
      password: String(data.get("password") || ""),
      groupId: String(data.get("groupId") || "") || undefined,
      x: 70 + ((project.devices.length + index) % 4) * 235,
      y: 80 + Math.floor((project.devices.length + index) / 4) * 175,
    }));
    setProject((current) => ({ ...current, devices: [...current.devices, ...additions] }));
    setShowDeviceForm(false);
    setNotice(`已新增 ${count} 台設備`);
  }

  function addLink(data: FormData) {
    const from = String(data.get("from"));
    const to = String(data.get("to"));
    if (!from || !to || from === to) {
      setNotice("請選擇兩台不同設備");
      return;
    }
    const link: Link = {
      id: uid("link"),
      from,
      to,
      kind: String(data.get("kind")) as Link["kind"],
      fromPort: String(data.get("fromPort") || ""),
      toPort: String(data.get("toPort") || ""),
      vlan: String(data.get("vlan") || ""),
      speed: String(data.get("speed") || ""),
    };
    setProject((current) => ({ ...current, links: [...current.links, link] }));
    setShowLinkForm(false);
    setNotice("連線已建立");
  }

  function addGroup(data: FormData) {
    const group: Group = {
      id: uid("group"),
      name: String(data.get("name") || "新容器"),
      kind: String(data.get("kind")) as Group["kind"],
      color: String(data.get("color") || "#526cf5"),
    };
    setProject((current) => ({ ...current, groups: [...current.groups, group] }));
    setShowGroupForm(false);
    setNotice("容器已建立，可在設備資料中指定");
  }

  function autoLayout() {
    const ordered = [...project.devices].sort((a, b) => {
      const order: DeviceType[] = ["modem", "router", "firewall", "switch", "access-point", "server", "nas", "erp", "client"];
      return order.indexOf(a.type) - order.indexOf(b.type);
    });
    const positions = new Map(ordered.map((device, index) => [
      device.id,
      { x: 70 + (index % 4) * 235, y: 80 + Math.floor(index / 4) * 175 },
    ]));
    setProject((current) => ({
      ...current,
      devices: current.devices.map((device) => ({ ...device, ...positions.get(device.id)! })),
    }));
    setNotice("已依設備角色自動整理");
  }

  function removeSelected() {
    if (!selectedId) return;
    setProject((current) => ({
      ...current,
      devices: current.devices.filter((d) => d.id !== selectedId),
      links: current.links.filter((l) => l.from !== selectedId && l.to !== selectedId),
    }));
    setSelectedId(undefined);
    setNotice("設備與相關連線已移除");
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
          <button className="secondary" onClick={autoLayout}>⌁ 自動整理</button>
          <button className="primary" onClick={() => window.print()}>⇩ 匯出 PDF</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <nav className="tabs">
            <button className={tab === "devices" ? "active" : ""} onClick={() => setTab("devices")}>設備</button>
            <button className={tab === "links" ? "active" : ""} onClick={() => setTab("links")}>連線</button>
            <button className={tab === "groups" ? "active" : ""} onClick={() => setTab("groups")}>容器</button>
          </nav>

          {tab === "devices" && <>
            <div className="panel-heading"><div><h2>設備清單</h2><p>{project.devices.length} 台設備</p></div><button className="icon-button" onClick={() => setShowDeviceForm(true)}>＋</button></div>
            <div className="device-list">
              {project.devices.map((device) => <button key={device.id} className={`device-row ${selectedId === device.id ? "selected" : ""}`} onClick={() => setSelectedId(device.id)}>
                <span className={`device-icon type-${device.type}`}>{TYPE_MAP[device.type].glyph}</span>
                <span><strong>{device.name}</strong><small>{TYPE_MAP[device.type].label} · {device.ip || "未設定 IP"}</small></span>
              </button>)}
            </div>
            <button className="wide-button" onClick={() => setShowDeviceForm(true)}>＋ 新增設備</button>
          </>}

          {tab === "links" && <>
            <div className="panel-heading"><div><h2>實體與無線連線</h2><p>{project.links.length} 條連線</p></div><button className="icon-button" onClick={() => setShowLinkForm(true)}>＋</button></div>
            <div className="link-list">
              {project.links.map((link) => {
                const a = project.devices.find((d) => d.id === link.from);
                const b = project.devices.find((d) => d.id === link.to);
                return <div className="link-row" key={link.id}><span>{link.kind === "wired" ? "━" : "┈"}</span><div><strong>{a?.name} → {b?.name}</strong><small>{link.fromPort || "Port"} / {link.toPort || "Port"} · {link.speed || "未標示速率"} {link.vlan && `· VLAN ${link.vlan}`}</small></div></div>;
              })}
            </div>
            <button className="wide-button" onClick={() => setShowLinkForm(true)}>＋ 建立連線</button>
          </>}

          {tab === "groups" && <>
            <div className="panel-heading"><div><h2>架構容器</h2><p>分點、網域、VLAN</p></div><button className="icon-button" onClick={() => setShowGroupForm(true)}>＋</button></div>
            <div className="group-list">
              {project.groups.map((group) => <div className="group-row" key={group.id}><span style={{ background: group.color }} /><div><strong>{group.name}</strong><small>{group.kind === "site" ? "分點" : group.kind === "domain" ? "網域" : "VLAN"}</small></div></div>)}
            </div>
            <button className="wide-button" onClick={() => setShowGroupForm(true)}>＋ 新增容器</button>
          </>}
          <div className="local-note">🔒 本機模式<br /><span>拓樸與機密欄位只存於此瀏覽器。共用電腦請勿保存帳密。</span></div>
        </aside>

        <section className="canvas-wrap">
          <div className="canvas-toolbar">
            <span className="status">{notice}</span>
            <div><button title="縮小">−</button><span>100%</span><button title="放大">＋</button><button title="全螢幕">⛶</button></div>
          </div>
          <div className="canvas" id="topology-canvas">
            {groupBounds.map((group) => <div key={group.id} className={`group-box group-${group.kind}`} style={{ left: group.x, top: group.y, width: group.w, height: group.h, borderColor: group.color, background: `${group.color}0d` }}>
              <span style={{ color: group.color }}>{group.kind === "site" ? "分點" : group.kind === "domain" ? "網域" : "VLAN"} · {group.name}</span>
            </div>)}
            <svg className="links-layer" aria-label="設備連線">
              {project.links.map((link) => {
                const a = project.devices.find((d) => d.id === link.from);
                const b = project.devices.find((d) => d.id === link.to);
                if (!a || !b) return null;
                const x1 = a.x + 82, y1 = a.y + 48, x2 = b.x + 82, y2 = b.y + 48;
                return <g key={link.id}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} className={link.kind === "wireless" ? "wireless-line" : "wired-line"} />
                  <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8}>{[link.speed, link.vlan && `VLAN ${link.vlan}`].filter(Boolean).join(" · ")}</text>
                </g>;
              })}
            </svg>
            {project.devices.map((device) => <button key={device.id} className={`canvas-device ${selectedId === device.id ? "selected" : ""}`} style={{ left: device.x, top: device.y }} onClick={() => setSelectedId(device.id)}>
              <span className={`canvas-glyph type-${device.type}`}>{TYPE_MAP[device.type].glyph}</span>
              <strong>{device.name}</strong><small>{device.ip || TYPE_MAP[device.type].label}</small>
            </button>)}
            {!project.devices.length && <div className="empty-state"><b>＋</b><h2>開始建立網路拓樸</h2><p>從左側新增設備，再確認設備間的連線。</p><button className="primary" onClick={() => setShowDeviceForm(true)}>新增第一台設備</button></div>}
          </div>
        </section>

        <aside className="inspector">
          <h2>設備資料</h2>
          {selected ? <div className="inspect-body">
            <div className={`inspect-icon type-${selected.type}`}>{TYPE_MAP[selected.type].glyph}</div>
            <h3>{selected.name}</h3><p>{TYPE_MAP[selected.type].label}</p>
            <dl>
              <div><dt>IP 位址</dt><dd>{selected.ip || "—"}</dd></div>
              <div><dt>MAC</dt><dd>{selected.mac || "—"}</dd></div>
              <div><dt>型號</dt><dd>{selected.model || "—"}</dd></div>
              <div><dt>位置</dt><dd>{selected.location || "—"}</dd></div>
              <div><dt>管理網址</dt><dd>{selected.url || "—"}</dd></div>
              <div><dt>帳號</dt><dd>{selected.username ? "••••••••" : "—"}</dd></div>
              <div><dt>密碼</dt><dd>{selected.password ? "••••••••" : "—"}</dd></div>
            </dl>
            <button className="danger" onClick={removeSelected}>刪除設備</button>
          </div> : <div className="inspect-empty">點選畫布或設備清單中的設備，即可檢視資料。</div>}
        </aside>
      </section>

      {showDeviceForm && <Modal title="新增設備" onClose={() => setShowDeviceForm(false)}>
        <form action={addDevice} className="form-grid">
          <label>設備名稱<input name="name" required placeholder="例如：核心交換器" /></label>
          <label>設備類型<select name="type">{TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
          <label>數量<input name="count" type="number" min="1" max="20" defaultValue="1" /></label>
          <label>所屬容器<select name="groupId"><option value="">未分類</option>{project.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          <label>IP 位址<input name="ip" placeholder="192.168.1.1" /></label>
          <label>MAC 位址<input name="mac" placeholder="00:00:00:00:00:00" /></label>
          <label>品牌／型號<input name="model" placeholder="FortiGate 90G" /></label>
          <label>實體位置<input name="location" placeholder="機房 A 櫃" /></label>
          <label className="full">管理網址<input name="url" placeholder="https://192.168.1.1" /></label>
          <div className="secret-warning full">⚠ 帳密將儲存在此瀏覽器，未經密碼庫等級加密。請勿在共用電腦輸入正式密碼。</div>
          <label>管理帳號<input name="username" autoComplete="off" /></label>
          <label>管理密碼<input name="password" type="password" autoComplete="new-password" /></label>
          <FormActions onCancel={() => setShowDeviceForm(false)} />
        </form>
      </Modal>}

      {showLinkForm && <Modal title="建立設備連線" onClose={() => setShowLinkForm(false)}>
        <form action={addLink} className="form-grid">
          <label>來源設備<select name="from" required><option value="">請選擇</option>{project.devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label>目的設備<select name="to" required><option value="">請選擇</option>{project.devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label>連線方式<select name="kind"><option value="wired">實體有線</option><option value="wireless">無線連線</option></select></label>
          <label>連線速率<select name="speed"><option value="">未標示</option><option>100 Mbps</option><option>1 Gbps</option><option>2.5 Gbps</option><option>10 Gbps</option><option>40 Gbps</option></select></label>
          <label>來源介面／Port<input name="fromPort" placeholder="WAN1 / Port 1" /></label>
          <label>目的介面／Port<input name="toPort" placeholder="LAN1 / Port 24" /></label>
          <label className="full">VLAN<input name="vlan" placeholder="例如：10、20 或 Trunk" /></label>
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

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal"><header><h2>{title}</h2><button onClick={onClose}>×</button></header>{children}</section>
  </div>;
}

function FormActions({ onCancel }: { onCancel: () => void }) {
  return <div className="form-actions full"><button type="button" className="secondary" onClick={onCancel}>取消</button><button type="submit" className="primary">確認新增</button></div>;
}
