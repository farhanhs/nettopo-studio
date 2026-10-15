"use client";

import { useEffect, useMemo, useState } from "react";
import { Background, Controls, ReactFlow, ViewportPortal, type Node, type Edge } from "@xyflow/react";
import { projectTrustedNetworkView, type ProjectionItem, type ProjectionMode, type ProjectionOutcome, type ProjectionView, type TrustedEntityRef } from "../../lib/trusted-network-projection";
import type { ProjectV2 } from "../../lib/trusted-network-types";
import type { Project } from "../../lib/topology-types";
import { routePath, routeTopologyLinks } from "../../lib/topology-routing";
import styles from "./TrustedNetworkReader.module.css";

const entityKey = (ref: TrustedEntityRef) => `${ref.type}:${ref.id}`;
const labels: Record<TrustedEntityRef["type"], string> = { area: "區域", device: "設備", interface: "介面", vlan: "VLAN", subnet: "子網", "physical-link": "實體連線", "interface-vlan": "介面 / VLAN", "interface-subnet": "介面 / 子網", resiliency: "備援關係" };
const trustLabel = (item: ProjectionItem) => item.trust.state === "verified" ? "已核實" : item.trust.state === "mixed" ? "關聯尚未核實" : "未核實";
const issueLabels: Record<string, string> = {
  SELECTION_NOT_VISIBLE: "所選項目未通過目前的核實篩選或已不在此拓樸。",
  FOCUS_AREA_NOT_VISIBLE: "所選區域不在目前可見範圍。",
  LEGACY_INTERFACE_UNKNOWN: "舊資料：介面未知。",
  LEGACY_LOGICAL_RELATION_UNSTRUCTURED: "舊資料包含未結構化 VLAN 標記。",
  UNVERIFIED_CLOSURE_HIDDEN: "未核實項目及必要關聯已隱藏。",
  STALE_TRUST_RECORD_IGNORED: "資料已變更，舊核實紀錄不再適用。",
  NO_VISIBLE_ENTITIES: "目前沒有符合篩選的項目。",
};

export function TrustedNetworkReader({ project, scopeKey, onExit }: { project: ProjectV2 | null; scopeKey: string; onExit: () => void }) {
  const [view, setView] = useState<ProjectionView>("physical");
  const [mode, setMode] = useState<ProjectionMode>("all");
  const [selection, setSelection] = useState<TrustedEntityRef>();
  const [focusAreaId, setFocusAreaId] = useState<string>();
  const [collapsedAreaIds, setCollapsedAreaIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const request = useMemo(() => project ? { authorizedProject: project, view, mode, selection, focusAreaId, collapsedAreaIds } : null, [project, view, mode, selection, focusAreaId, collapsedAreaIds]);
  const [completed, setCompleted] = useState<{ request: typeof request; scopeKey: string; outcome: ProjectionOutcome }>();
  useEffect(() => {
    let active = true;
    if (request) void projectTrustedNetworkView(request).then((outcome) => { if (active) setCompleted({ request, scopeKey, outcome }); });
    return () => { active = false; };
  }, [request, scopeKey]);
  // Never display a completion from a previous document, filter or identity scope.
  const outcome = completed?.request === request && completed.scopeKey === scopeKey ? completed.outcome : undefined;
  const result = outcome?.ok ? outcome.result : undefined;
  const entries = useMemo(() => result ? [...result.items, ...result.relations, ...result.summaries] : [], [result]);
  const selected = entries.find((e) => result?.effectiveSelection && entityKey(e.ref) === entityKey(result.effectiveSelection));
  const selectedRelation = result?.relations.find((e) => selected && entityKey(e.ref) === entityKey(selected.ref));
  const selectedSummary = result?.summaries.find((e) => selected && entityKey(e.ref) === entityKey(selected.ref));
  const relatedRefs = [...(selected?.owner ? [selected.owner] : []), ...(selectedRelation ? [selectedRelation.from, selectedRelation.to] : []), ...(selectedSummary?.memberRefs ?? [])];
  const filtered = entries.filter((e) => `${e.label} ${labels[e.ref.type]} ${e.ref.id}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  function choose(item: ProjectionItem) {
    setSelection(item.ref);
    if (item.ref.type === "area") setFocusAreaId(item.ref.id);
    if (item.areaId) setCollapsedAreaIds((ids) => ids.filter((id) => id !== item.areaId));
  }
  function folded(item: ProjectionItem): boolean {
    if (result?.effectiveSelection && entityKey(item.ref) === entityKey(result.effectiveSelection)) return false;
    let area = item.areaId ?? (item.ref.type === "area" && item.owner?.type === "area" ? item.owner.id : undefined);
    while (area) {
      if (collapsedAreaIds.includes(area)) return true;
      const parent = result?.items.find((e) => e.ref.type === "area" && e.ref.id === area)?.owner;
      area = parent?.type === "area" ? parent.id : undefined;
    }
    return false;
  }
  return <section className={styles.reader} aria-label="可信網路唯讀檢視" data-reader-scope="authorized">
    <header className={styles.toolbar}>
      <strong>網路閱讀 <small>唯讀</small></strong>
      <div role="group" aria-label="投影模式" className={styles.segmented}>
        <button type="button" aria-pressed={view === "physical"} onClick={() => setView("physical")}>實體</button>
        <button type="button" aria-pressed={view === "logical"} onClick={() => setView("logical")}>邏輯</button>
      </div>
      <label className={styles.check}><input type="checkbox" checked={mode === "verified-only"} onChange={(e) => setMode(e.target.checked ? "verified-only" : "all")} />僅顯示已核實</label>
      <label className={styles.search}><span>搜尋</span><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      <button type="button" onClick={onExit}>返回編輯器</button>
    </header>
    {!project || outcome?.ok === false ? <p role="alert">無法顯示此拓樸投影。</p> : !result ? <p role="status">正在讀取投影...</p> : <>
      <nav className={styles.breadcrumb} aria-label="網路路徑">
        <button type="button" onClick={() => { setFocusAreaId(undefined); setSelection(undefined); }}>拓樸</button>
        {result.breadcrumb.map((item) => <button type="button" key={entityKey(item.ref)} onClick={() => choose(item)}>{item.label}</button>)}
      </nav>
      <div className={styles.status} role="status">
        {view === "logical" && !result.relations.length && <p>未記錄結構化邏輯關係</p>}
        {result.issues.map((issue, index) => <p key={`${issue.code}-${index}`}>{issueLabels[issue.code]}{issue.count !== undefined ? ` (${issue.count})` : ""}</p>)}
        {mode === "verified-only" && <p>隱藏 {result.hidden.unverifiedEntities} 個項目、{result.hidden.unverifiedRelations} 個關聯 <button type="button" onClick={() => setMode("all")}>重設篩選</button></p>}
      </div>
      <div className={styles.workspace}>
        <aside className={styles.inventory} aria-label="投影項目列表">
          <h2>項目 <small>{entries.length}</small></h2>
          {filtered.length === 0 && <p>沒有符合的項目</p>}
          {filtered.filter((item) => search || !folded(item)).map((item) => <div key={entityKey(item.ref)}>
            <button type="button" className={styles.row} aria-pressed={selected?.ref && entityKey(selected.ref) === entityKey(item.ref)} onClick={() => choose(item)} data-entity-type={item.ref.type}>
              <span>{labels[item.ref.type]}</span><strong>{item.label}</strong><small>{trustLabel(item)} · {item.trust.evidenceCount} 筆來源</small>
            </button>
            {item.ref.type === "area" && <button type="button" aria-expanded={!collapsedAreaIds.includes(item.ref.id)} onClick={() => setCollapsedAreaIds((ids) => ids.includes(item.ref.id) ? ids.filter((id) => id !== item.ref.id) : [...ids, item.ref.id])}>{collapsedAreaIds.includes(item.ref.id) ? "展開" : "收合"} {item.label}{item.hiddenChildCounts ? ` (${Object.values(item.hiddenChildCounts).reduce((a, b) => a + b, 0)})` : ""}</button>}
          </div>)}
        </aside>
        <ReaderCanvas items={result.items} relations={result.relations} project={project} view={view} selected={result.effectiveSelection} choose={choose} />
        <aside className={styles.inspector} aria-label="唯讀項目詳細資料">
          <h2>詳細資料</h2>
          {selected ? <>
            <h3>{selected.label}</h3><p>{labels[selected.ref.type]} · {trustLabel(selected)}</p>
            <dl><dt>ID</dt><dd>{selected.ref.id}</dd>{selected.trust.verifiedAt && <><dt>核實時間</dt><dd>{selected.trust.verifiedAt}</dd></>}</dl>
            {relatedRefs.length > 0 && <><h3>關聯項目</h3>{relatedRefs.map((r) => {
              const item = entries.find((e) => entityKey(e.ref) === entityKey(r));
              return item ? <button type="button" key={entityKey(r)} onClick={() => choose(item)}>{labels[r.type]} · {item.label}</button>
                : r.type === "physical-link" ? <button type="button" key={entityKey(r)} onClick={() => { setView("physical"); setSelection(r); }}>實體連線 · {r.id}</button> : null;
            })}</>}
            {selected.trust.safeReasonCodes.map((reason) => <p key={reason}>{issueLabels[reason] ?? "此項目或必要關聯尚未核實。"}</p>)}
            <h3>來源</h3>
            {!selected.evidence.length && <p>尚無來源紀錄</p>}
            {selected.evidence.map((source, index) => <div className={styles.evidence} key={index}><strong>{source.displayName}</strong><p>{source.method === "legacy-upcast" ? "舊資料／未核實" : source.method} · {source.sourceKind}</p>{source.safeSummary && <p>{source.safeSummary}</p>}{source.file && <p>{source.file}{source.line ? ` : ${source.line}` : ""}</p>}{source.templateVersion && <p>範本 {source.templateVersion}</p>}</div>)}
          </> : <p>沒有可見項目</p>}
        </aside>
      </div>
    </>}
  </section>;
}

function ReaderCanvas({ items, relations, project, view, selected, choose }: {
  items: readonly ProjectionItem[]; relations: readonly import("../../lib/trusted-network-projection").ProjectionRelation[];
  project: ProjectV2; view: ProjectionView; selected?: TrustedEntityRef; choose: (item: ProjectionItem) => void;
}) {
  const nodes = useMemo<Node[]>(() => items.map((item, index) => ({ id: entityKey(item.ref), position: { x: index % 3 * 270, y: Math.floor(index / 3) * 190 },
    data: { label: <div className={styles.node}><small>{labels[item.ref.type]}</small><strong>{item.label}</strong><span>{trustLabel(item)}</span></div> },
    style: { width: 178, height: 112, borderRadius: 6, borderColor: item.trust.state === "verified" ? "#13856a" : "#8a6576", borderStyle: item.trust.state === "verified" ? "solid" : "dashed" },
    selected: !!selected && entityKey(item.ref) === entityKey(selected), draggable: false, connectable: false,
  })), [items, selected]);
  const geometry = useMemo<Project>(() => ({ devices: nodes.map((n) => ({ id: n.id, name: n.id, type: "switch", ...n.position })), links: relations.map((r) => ({ id: entityKey(r.ref), from: entityKey(r.from), to: entityKey(r.to), kind: project.links.find((l) => l.id === r.ref.id)?.kind ?? "wired" })), groups: [] }), [nodes, relations, project.links]);
  const routes = useMemo(() => view === "physical" ? routeTopologyLinks(geometry, geometry.links) : new Map(), [view, geometry]);
  const edges = useMemo<Edge[]>(() => view === "logical" ? relations.map((r) => ({ id: entityKey(r.ref), source: entityKey(r.from), target: entityKey(r.to), type: "smoothstep", label: r.label, style: { stroke: "#13856a", strokeWidth: 2, strokeDasharray: r.trust.state === "verified" ? undefined : "6 4" } })) : [], [relations, view]);
  const blocked = relations.filter((r) => routes.get(entityKey(r.ref))?.status === "unresolved-no-path");
  return <section className={styles.canvasSection} aria-label="唯讀投影圖面">
    <div className={styles.canvas}>
      <ReactFlow key={`${view}:${items.map((i) => entityKey(i.ref)).join("|")}`} nodes={nodes} edges={edges} fitView minZoom={0.15} maxZoom={1.5} nodesDraggable={false} nodesConnectable={false} deleteKeyCode={null}
        onNodeClick={(_, n) => { const item = items.find((i) => entityKey(i.ref) === n.id); if (item) choose(item); }}
        onEdgeClick={(_, e) => { const item = relations.find((i) => entityKey(i.ref) === e.id); if (item) choose(item); }}>
        <Background gap={20} /><Controls showInteractive={false} />
        {view === "physical" && <ViewportPortal><svg className={styles.overlay} aria-hidden="true">{relations.map((relation) => {
          const route = routes.get(entityKey(relation.ref));
          if (!route || route.status !== "resolved") return null;
          return <path key={entityKey(relation.ref)} d={routePath(route.points)} fill="none" stroke={relation.trust.state === "verified" ? "#13856a" : "#705465"} strokeWidth={selected && entityKey(selected) === entityKey(relation.ref) ? 5 : 2.5} strokeDasharray={route.kind === "wireless" || relation.trust.state !== "verified" ? "7 4" : undefined} data-route-kind={route.kind} data-route-status={route.status} />;
        })}</svg></ViewportPortal>}
      </ReactFlow>
    </div>
    {blocked.map((r) => <p key={entityKey(r.ref)} data-diagnostic="route-unresolved">{r.label}：路徑受阻，關聯仍保留於列表。</p>)}
  </section>;
}
