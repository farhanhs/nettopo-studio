import type { MaskedCredentialRow } from "@/app/lib/topology-transfer";

export function MaskedCredentialPreview({ credentials }: { credentials: MaskedCredentialRow[] }) {
  if (credentials.length === 0) return <p className="import-empty">本次預覽沒有可顯示的遮蔽帳密資料。</p>;

  return (
    <div className="import-table">
      <div className="import-table-head credential-grid">
        <span>設備</span>
        <span>類型</span>
        <span>帳號</span>
        <span>密碼</span>
      </div>
      {credentials.map((credential, index) => (
        <div className="credential-grid" key={`${credential.projectDeviceId}-${credential.kind}-${index}`}>
          <span>{credential.deviceName ?? credential.projectDeviceId}</span>
          <span>{credential.kind}</span>
          <span>{credential.usernameMasked ?? "未提供"}</span>
          <span>{credential.secretMasked}</span>
        </div>
      ))}
    </div>
  );
}
