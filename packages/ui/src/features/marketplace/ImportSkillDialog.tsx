import type { MarketplaceSkillDetail, SkillPackagePreview } from "@openbot/contracts/ipc";
import { Button, Check, Upload, X } from "@openbot/ui";
import { Portal } from "@solidjs/web";
import { createSignal, Show } from "solid-js";
import type { MarketplaceModel } from "./marketplace-model";

interface FileEntryPayload {
  relativePath: string;
  bytes: Uint8Array;
}

async function readDirectoryEntryRecursive(
  entry: FileSystemEntry,
  prefix = "",
): Promise<FileEntryPayload[]> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject));
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    return [{ relativePath: rel, bytes: new Uint8Array(await file.arrayBuffer()) }];
  }
  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const allEntries: FileSystemEntry[] = [];
    while (true) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      );
      if (batch.length === 0) break;
      allEntries.push(...batch);
    }
    const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    const nested = await Promise.all(allEntries.map((child) => readDirectoryEntryRecursive(child, nextPrefix)));
    return nested.flat();
  }
  return [];
}

export function ImportSkillDialog(props: {
  open: boolean;
  model: MarketplaceModel;
  onClose: () => void;
  onImported: (detail: MarketplaceSkillDetail) => void;
}) {
  const [dragging, setDragging] = createSignal(false);
  const [autoInstall, setAutoInstall] = createSignal(true);
  const [busy, setBusy] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);
  const [pendingPreview, setPendingPreview] = createSignal<
    | { kind: "staged"; preview: SkillPackagePreview }
    | { kind: "files"; name: string; files: FileEntryPayload[] }
    | null
  >(null);

  let zipInputRef: HTMLInputElement | undefined;

  function resetAndClose() {
    if (busy()) return;
    setDragging(false);
    setErrorMsg(null);
    setPendingPreview(null);
    props.onClose();
  }

  async function finalizeFiles(files: FileEntryPayload[]) {
    if (!props.model.importSkillFiles) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const detail = await props.model.importSkillFiles(files, autoInstall());
      if (detail) {
        props.onImported(detail);
        setPendingPreview(null);
        props.onClose();
      } else {
        setErrorMsg(props.model.error() ?? "导入失败：请确认包含合法的 SKILL.md 与 YAML 名称/描述。");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "技能包校验失败，请检查 SKILL.md 格式。");
    } finally {
      setBusy(false);
    }
  }

  async function finalizeStaged(draftId: string) {
    if (!props.model.importStagedSkill) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const detail = await props.model.importStagedSkill(draftId, autoInstall());
      if (detail) {
        props.onImported(detail);
        setPendingPreview(null);
        props.onClose();
      } else {
        setErrorMsg(props.model.error() ?? "安装技能失败，请重试。");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "安装技能失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  async function handleChooseFolderOrZip() {
    if (busy()) return;
    setErrorMsg(null);
    if (props.model.chooseSkillPackage) {
      setBusy(true);
      try {
        const preview = await props.model.chooseSkillPackage();
        setBusy(false);
        if (!preview) return;
        if (autoInstall()) {
          await finalizeStaged(preview.draftId);
        } else {
          setPendingPreview({ kind: "staged", preview });
        }
      } catch (err) {
        setBusy(false);
        setErrorMsg(err instanceof Error ? err.message : "未找到有效的 SKILL.md，请检查所选文件夹或压缩包。");
      }
      return;
    }
    zipInputRef?.click();
  }

  async function handleZipFilePicked(file: File | undefined) {
    if (!file || busy()) return;
    setErrorMsg(null);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const payload: FileEntryPayload[] = [{ relativePath: "__raw_zip__", bytes }];
    if (autoInstall()) {
      await finalizeFiles(payload);
    } else {
      setPendingPreview({ kind: "files", name: file.name, files: payload });
    }
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (busy()) return;
    setErrorMsg(null);

    const dt = e.dataTransfer;
    if (!dt) return;

    const entries: FileSystemEntry[] = [];
    for (const item of Array.from(dt.items ?? [])) {
      const entry = item.webkitGetAsEntry?.() ?? null;
      if (entry) entries.push(entry);
    }

    if (entries.length === 1 && entries[0]?.isFile && entries[0].name.toLowerCase().endsWith(".zip")) {
      const file = dt.files?.[0];
      if (file) await handleZipFilePicked(file);
      return;
    }

    if (entries.length > 0 && entries.some((en) => en.isDirectory || en.name === "SKILL.md")) {
      setBusy(true);
      try {
        const collected = (await Promise.all(entries.map((en) => readDirectoryEntryRecursive(en)))).flat();
        setBusy(false);
        if (!collected.some((f) => f.relativePath === "SKILL.md" || f.relativePath.endsWith("/SKILL.md"))) {
          setErrorMsg("未在拖入的文件夹中找到 SKILL.md 文件。");
          return;
        }
        if (autoInstall()) {
          await finalizeFiles(collected);
        } else {
          setPendingPreview({ kind: "files", name: entries[0]?.name ?? "技能文件夹", files: collected });
        }
      } catch (err) {
        setBusy(false);
        setErrorMsg(err instanceof Error ? err.message : "读取拖入文件夹失败。");
      }
      return;
    }

    const firstFile = dt.files?.[0];
    if (firstFile && firstFile.name.toLowerCase().endsWith(".zip")) {
      await handleZipFilePicked(firstFile);
      return;
    }

    setErrorMsg("请拖入包含 SKILL.md 的技能文件夹或 .zip 压缩包。");
  }

  return (
    <Show when={props.open}>
      <Portal>
        <div
          class="starbot-skill-import-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) resetAndClose();
          }}
        >
          <div class="starbot-skill-import-modal" role="dialog" aria-modal="true" aria-labelledby="starbot-import-skill-title">
            <header class="starbot-skill-import-head">
              <h3 id="starbot-import-skill-title">导入技能</h3>
              <button
                type="button"
                class="starbot-skill-import-close"
                aria-label="关闭"
                onClick={resetAndClose}
              >
                <X class="size-4" />
              </button>
            </header>

            <input
              ref={zipInputRef}
              type="file"
              accept=".zip,application/zip"
              class="marketplace-visually-hidden"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                void handleZipFilePicked(file);
              }}
            />

            <button
              type="button"
              class={`starbot-skill-import-dropzone${dragging() ? " is-dragging" : ""}`}
              disabled={busy()}
              onClick={() => void handleChooseFolderOrZip()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => void handleDrop(e)}
            >
              <span class="starbot-skill-import-icon" aria-hidden="true">
                <Upload class="size-7" />
              </span>
              <span class="starbot-skill-import-drop-text">
                {busy() ? "正在校验并安装技能…" : "拖拽文件夹或 .zip 到此处，或点击上传"}
              </span>
            </button>

            <label class="starbot-skill-import-check">
              <span class={`starbot-skill-import-checkbox${autoInstall() ? " is-checked" : ""}`}>
                <input
                  type="checkbox"
                  checked={autoInstall()}
                  onChange={(e) => setAutoInstall(e.currentTarget.checked)}
                />
                <Show when={autoInstall()}>
                  <Check class="size-3" />
                </Show>
              </span>
              <span>非高风险自动安装（导入后直接启用并分配给当前星友）</span>
            </label>

            <Show when={pendingPreview()}>
              {(pending) => {
                const previewTitle = () => {
                  const p = pending();
                  return p.kind === "staged" ? p.preview.name : p.name;
                };
                const previewDesc = () => {
                  const p = pending();
                  return p.kind === "staged" ? p.preview.description : null;
                };
                return (
                  <div class="starbot-skill-import-preview">
                    <div>
                      <strong>{previewTitle()}</strong>
                      <Show when={previewDesc()}>{(desc) => <p>{desc()}</p>}</Show>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      loading={busy()}
                      onClick={() => {
                        const p = pending();
                        if (p.kind === "staged") void finalizeStaged(p.preview.draftId);
                        else void finalizeFiles(p.files);
                      }}
                    >
                      立即安装
                    </Button>
                  </div>
                );
              }}
            </Show>

            <Show when={errorMsg()}>
              {(msg) => <p class="starbot-skill-import-error" role="alert">{msg()}</p>}
            </Show>

            <div class="starbot-skill-import-reqs">
              <h4>文件要求</h4>
              <ul>
                <li>文件夹或者 .zip 需要包含 SKILL.md 文件</li>
                <li>.md 文件需包含 YAML 格式的技能名称（name）和描述（description）</li>
              </ul>
            </div>

            <div class="starbot-skill-import-foot">
              <button
                type="button"
                class="starbot-skill-import-zip-link"
                disabled={busy()}
                onClick={() => zipInputRef?.click()}
              >
                选择 ZIP 文件
              </button>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
