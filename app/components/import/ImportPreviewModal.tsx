import { useState } from "react";

import type { MissingInfoItem } from "@/app/lib/topology-missing-info";
import type { ImportPlan, ImportStrategy } from "@/app/lib/topology-transfer";
import { ImportIssueList } from "./ImportIssueList";
import { ImportSummary } from "./ImportSummary";
import { MaskedCredentialPreview } from "./MaskedCredentialPreview";
import { MissingInfoChecklist } from "./MissingInfoChecklist";

type ImportPreviewModalProps = {
  plan: ImportPlan;
  strategy: ImportStrategy;
  importName: string;
  busy: boolean;
  warningAcknowledged: boolean;
  onStrategyChange: (strategy: ImportStrategy) => void;
  onNameChange: (name: string) => void;
  onWarningAcknowledgedChange: (acknowledged: boolean) => void;
  onExcludeDevice: (deviceId: string) => void;
  onExcludeMissing: (id: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

type ImportTab = "summary" | "devices" | "links" | "missing" | "credentials";

function severityRank(item: MissingInfoItem) {
  if (item.severity === "blocking") return 0;
  if (item.severity === "warning") return 1;
  return 2;
}

export function ImportPreviewModal({
  plan,
  strategy,
  importName,
  busy,
  warningAcknowledged,
  onStrategyChange,
  onNameChange,
  onWarningAcknowledgedChange,
  onExcludeDevice,
  onExcludeMissing,
  onCancel,
  onConfirm,
}: ImportPreviewModalProps) {
  const [tab, setTab] = useState<ImportTab>("summary");
  const needsWarningAck = plan.summary.missingWarnings > 0;
  const canConfirm = plan.canApply && (!needsWarningAck || warningAcknowledged) && !busy;
  const sortedMissing = [...plan.missingInfo].sort((left, right) => severityRank(left) - severityRank(right) || left.id.localeCompare(right.id));

  return (
    <>
      <ImportSummary plan={plan} />

      <div className="import-preview-tabs">
        <button className={tab === "summary" ? "active" : ""} type="button" onClick={() => setTab("summary")}>摘要</button>
        <button className={tab === "devices" ? "active" : ""} type="button" onClick={() => setTab("devices")}>設備</button>
        <button className={tab === "links" ? "active" : ""} type="button" onClick={() => setTab("links")}>連線</button>
        <button className={tab === "missing" ? "active" : ""} type="button" onClick={() => setTab("missing")}>缺失資料</button>
        <button className={tab === "credentials" ? "active" : ""} type="button" onClick={() => setTab("credentials")}>遮蔽帳密</button>
      </div>

      <div className="import-preview-body">
        {tab === "summary" && (
          <div className="import-summary-page">
            <p>來源：{plan.sourceNames.join("、")}</p>
            <ImportIssueList issues={plan.issues} />
          </div>
        )}
        {tab === "devices" && (
          <div className="import-table">
            {plan.project.devices.map((device) => (
              <div className="device-import-row" key={device.id}>
                <strong>{device.name}</strong>
                <span>{device.type}</span>
                <span>{device.ip ?? "IP 未提供"}</span>
                <span>{device.groupId ?? "未分組"}</span>
              </div>
            ))}
          </div>
        )}
        {tab === "links" && (
          <div className="import-table">
            {plan.project.links.map((link) => (
              <div className="link-import-row" key={link.id}>
                <strong>{link.from} → {link.to}</strong>
                <span>{link.kind}</span>
                <span>{[link.fromPort, link.toPort].filter(Boolean).join(" / ") || "Port 未提供"}</span>
                <span>{[link.vlan && `VLAN ${link.vlan}`, link.speed].filter(Boolean).join(" / ") || "細節未提供"}</span>
              </div>
            ))}
          </div>
        )}
        {tab === "missing" && <MissingInfoChecklist items={sortedMissing} onExcludeDevice={onExcludeDevice} onExcludeMissing={onExcludeMissing} />}
        {tab === "credentials" && <MaskedCredentialPreview credentials={plan.maskedCredentials} />}
      </div>

      <div className="import-options">
        <label>
          匯入策略
          <select value={strategy} onChange={(event) => onStrategyChange(event.target.value as ImportStrategy)}>
            <option value="new">建立新拓樸</option>
            <option value="merge">合併到目前拓樸</option>
            <option value="replace">取代目前拓樸</option>
          </select>
        </label>
        {strategy === "new" && <label>
          新拓樸名稱
          <input value={importName} onChange={(event) => onNameChange(event.target.value)} />
        </label>}
      </div>

      {strategy === "replace" && <p className="replace-warning">取代會覆蓋目前拓樸的設備、連線與群組。確認前不會寫入。</p>}

      {needsWarningAck && (
        <label className="check-row import-warning-ack">
          <input type="checkbox" checked={warningAcknowledged} onChange={(event) => onWarningAcknowledgedChange(event.target.checked)} />
          我已檢視缺失資料，了解未確認項目可能影響拓樸完整性，仍要匯入。
        </label>
      )}

      <div className="form-actions">
        <button type="button" className="secondary" onClick={onCancel}>取消</button>
        <button type="button" className="primary" disabled={!canConfirm} onClick={onConfirm}>
          {busy ? "匯入中..." : "確認寫入"}
        </button>
      </div>
    </>
  );
}
