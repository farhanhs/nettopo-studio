"use client";

import { useState } from "react";

type FileDropZoneProps = {
  busy: boolean;
  onFiles: (files: FileList | File[]) => void;
};

export function FileDropZone({ busy, onFiles }: FileDropZoneProps) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      className={`transfer-drop file-drop-zone ${dragging ? "dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (event.dataTransfer.files.length > 0) onFiles(event.dataTransfer.files);
      }}
    >
      <strong>拖放或選擇拓樸資料</strong>
      <p>支援 .txt、.md、.csv；CSV bundle 第一階段請同時選取五份 CSV，drag 與 input 會走同一套預覽流程。</p>
      <input
        type="file"
        accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json"
        multiple
        disabled={busy}
        onChange={(event) => {
          if (event.target.files?.length) onFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
    </label>
  );
}
