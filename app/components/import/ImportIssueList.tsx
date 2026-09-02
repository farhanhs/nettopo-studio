import type { ImportIssue } from "@/app/lib/topology-transfer";

export function ImportIssueList({ issues }: { issues: ImportIssue[] }) {
  if (issues.length === 0) return <p className="issue-ok import-empty">schema 與關聯驗證目前沒有錯誤。</p>;

  return (
    <div className="import-issues" aria-live="polite">
      {issues.map((issue, index) => (
        <p className={`issue-${issue.severity}`} key={`${issue.code}-${index}`}>
          <strong>{issue.severity === "error" ? "錯誤" : issue.severity === "info" ? "資訊" : "警告"}</strong>
          {issue.message}
          {issue.path && <small>{issue.path}</small>}
        </p>
      ))}
    </div>
  );
}
