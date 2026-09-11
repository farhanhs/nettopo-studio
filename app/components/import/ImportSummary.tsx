import type { ImportPlan } from "@/app/lib/topology-transfer";

export function ImportSummary({ plan }: { plan: ImportPlan }) {
  const status = plan.summary.missingBlocking > 0 || plan.issues.some((issue) => issue.severity === "error")
    ? "已阻擋"
    : plan.summary.missingWarnings > 0 || plan.issues.some((issue) => issue.severity === "warning")
      ? "需確認"
      : "可匯入";

  return (
    <div className="import-summary import-summary-expanded">
      <span><strong>{plan.sourceNames.length}</strong>來源檔</span>
      <span><strong>{plan.summary.devices}</strong>設備</span>
      <span><strong>{plan.summary.links}</strong>連線</span>
      <span><strong>{plan.summary.groups}</strong>群組</span>
      <span><strong>{plan.summary.maskedCredentials}</strong>遮蔽帳密</span>
      <span><strong>{plan.summary.missingBlocking}</strong>Blocking</span>
      <span><strong>{plan.summary.missingWarnings}</strong>Warning</span>
      <span className={plan.canApply ? "summary-ok" : "summary-error"}>{status}</span>
    </div>
  );
}
