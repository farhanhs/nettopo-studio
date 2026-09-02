import type { MissingInfoItem } from "@/app/lib/topology-missing-info";

type MissingInfoChecklistProps = {
  items: MissingInfoItem[];
  onExcludeDevice: (deviceId: string) => void;
  onExcludeMissing: (id: string) => void;
};

export function MissingInfoChecklist({ items, onExcludeDevice, onExcludeMissing }: MissingInfoChecklistProps) {
  if (items.length === 0) return <p className="import-empty">Missing Info Checklist 目前沒有缺失項目。</p>;

  return (
    <div className="missing-list">
      {items.map((item) => (
        <article className={`missing-item severity-${item.severity}`} key={item.id}>
          <div>
            <strong>{item.severity}</strong>
            <span>{item.question}</span>
            <small>{item.entityType}{item.entityId ? ` / ${item.entityId}` : ""} / {item.field}</small>
            {item.suggestion && <em>{item.suggestion}</em>}
            {item.sourceFile && <small>{item.sourceFile}{item.sourceLine ? `:${item.sourceLine}` : ""}</small>}
          </div>
          {item.severity === "blocking" && item.entityType === "device" && item.entityId && (
            <button className="secondary" type="button" onClick={() => onExcludeDevice(item.entityId!)}>排除設備</button>
          )}
          {item.severity === "blocking" && item.entityType !== "device" && (
            <button className="secondary" type="button" onClick={() => onExcludeMissing(item.id)}>排除此項</button>
          )}
        </article>
      ))}
    </div>
  );
}
