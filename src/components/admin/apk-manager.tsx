"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Smartphone,
  Upload,
  Download,
  Trash2,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Link as LinkIcon,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

type Release = {
  id: string;
  version: string;
  versionCode: number;
  notes: string | null;
  fileName: string;
  filePath: string;
  fileSize: number;
  downloadCount: number;
  createdAt: string;
};

const CHUNK_SIZE = 15 * 1024 * 1024; // 15 MB (Cloudflare 100MB sınırına asla takılmaz)

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "Harici Bağlantı";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(isoString: string) {
  try {
    return new Date(isoString).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function ApkManager() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [version, setVersion] = useState("");
  const [versionCode, setVersionCode] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState("");

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchReleases = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/apk");
      const text = await res.text();
      let data: { success?: boolean; releases?: Release[]; latest?: Release } | null = null;
      try {
        data = JSON.parse(text);
      } catch {
        // non-json response
      }

      if (data?.success) {
        setReleases(data.releases || []);
        if (data.latest && !version) {
          const nextCode = (data.latest.versionCode || 1) + 1;
          setVersionCode(String(nextCode));
        }
      }
    } catch (err) {
      console.error("Failed to load releases:", err);
    } finally {
      setLoading(false);
    }
  }, [version]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchReleases();
    });
  }, [fetchReleases]);

  const latest = releases[0] || null;

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();

    if (!version.trim()) {
      toast("Lütfen sürüm numarasını girin.", "error");
      return;
    }

    if (uploadMode === "url") {
      if (!externalUrl.trim() || (!externalUrl.startsWith("http://") && !externalUrl.startsWith("https://"))) {
        toast("Lütfen geçerli bir harici indirme bağlantısı girin.", "error");
        return;
      }

      setUploading(true);
      try {
        const res = await fetch("/api/admin/apk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            externalUrl: externalUrl.trim(),
            version: version.trim(),
            versionCode: versionCode.trim(),
            notes: notes.trim(),
          }),
        });

        const text = await res.text();
        let data: { success?: boolean; error?: string } | null = null;
        try {
          data = JSON.parse(text);
        } catch {
          // non-json
        }

        if (!res.ok || !data?.success) {
          throw new Error(data?.error || `Hata (HTTP ${res.status})`);
        }

        toast("Harici APK sürümü başarıyla kaydedildi!", "success");
        setExternalUrl("");
        setVersion("");
        setNotes("");
        await fetchReleases();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Kayıt sırasında hata oluştu.";
        toast(message, "error");
      } finally {
        setUploading(false);
      }
      return;
    }

    // Dosya yükleme modu (Parçalı Yükleme)
    if (!selectedFile) {
      toast("Lütfen bir .apk dosyası seçin.", "error");
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".apk")) {
      toast("Yalnızca .apk uzantılı dosyalar yüklenebilir.", "error");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
    const uploadId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
        const chunkBlob = selectedFile.slice(start, end);

        setUploadStatusText(
          totalChunks > 1
            ? `Parça ${chunkIndex + 1}/${totalChunks} yükleniyor...`
            : "Dosya yükleniyor..."
        );
        setUploadProgress(Math.round((chunkIndex / totalChunks) * 100));

        const formData = new FormData();
        formData.append("chunk", chunkBlob);
        formData.append("uploadId", uploadId);
        formData.append("chunkIndex", String(chunkIndex));
        formData.append("totalChunks", String(totalChunks));
        formData.append("totalSize", String(selectedFile.size));
        formData.append("fileName", selectedFile.name);
        formData.append("version", version.trim());
        if (versionCode.trim()) formData.append("versionCode", versionCode.trim());
        if (notes.trim()) formData.append("notes", notes.trim());

        const res = await fetch("/api/admin/apk", {
          method: "POST",
          body: formData,
        });

        const text = await res.text();
        let data: { success?: boolean; error?: string } | null = null;
        try {
          data = JSON.parse(text);
        } catch {
          // Sunucu veya Cloudflare HTML döndürdüğünde JSON.parse patlamaz
        }

        if (!res.ok) {
          if (res.status === 413) {
            throw new Error(
              "Dosya parçası boyutu sunucu veya Cloudflare limitini aşıyor (HTTP 413)."
            );
          }
          throw new Error(data?.error || `Yükleme hatası (HTTP ${res.status})`);
        }

        if (!data?.success) {
          throw new Error(data?.error || "Yükleme başarısız oldu.");
        }
      }

      setUploadProgress(100);
      setUploadStatusText("Tamamlandı!");
      toast("Yeni mobil APK sürümü başarıyla yüklendi!", "success");

      // Formu sıfırla
      setSelectedFile(null);
      setVersion("");
      setNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";

      await fetchReleases();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Yükleme sırasında hata oluştu.";
      toast(message, "error");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatusText("");
    }
  }

  async function handleDelete(id: string, ver: string) {
    if (!confirm(`${ver} sürümünü silmek istediğinize emin misiniz?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch("/api/admin/apk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const text = await res.text();
      let data: { success?: boolean; error?: string } | null = null;
      try {
        data = JSON.parse(text);
      } catch {
        // non-json
      }

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Silme başarısız.");
      }

      toast("Sürüm başarıyla silindi.", "success");
      setReleases((prev) => prev.filter((r) => r.id !== id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Hata oluştu.";
      toast(message, "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Mobil APK Yönetimi</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Android mobil uygulamasının en güncel APK dosyasını yükleyin ve sürümleri yönetin.
        </p>
      </div>

      {/* Aktif Sürüm Kartı */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Güncel Yayındaki Sürüm</h2>
                {latest && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500 border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" />
                    Aktif
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                {latest
                  ? `Sürüm ${latest.version} (Kod: ${latest.versionCode})`
                  : "Henüz APK sürümü yüklenmedi."}
              </p>
            </div>
          </div>

          {latest && (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/indir"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 px-3.5 py-2 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                İndirme Sayfası
              </a>
              <a
                href="/api/apk/download"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-xs font-medium text-[var(--primary-foreground)] shadow-sm transition hover:opacity-90"
              >
                <Download className="h-3.5 w-3.5" />
                APK İndir {latest.fileSize > 0 ? `(${formatBytes(latest.fileSize)})` : ""}
              </a>
            </div>
          )}
        </div>

        {latest && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-[var(--border)] pt-5 text-sm">
            <div>
              <span className="text-xs text-[var(--muted-foreground)] block">Dosya / Bağlantı</span>
              <span className="font-mono text-xs text-[var(--foreground)] truncate block mt-0.5">
                {latest.fileName}
              </span>
            </div>
            <div>
              <span className="text-xs text-[var(--muted-foreground)] block">Boyut / Tür</span>
              <span className="text-xs font-medium text-[var(--foreground)] block mt-0.5">
                {formatBytes(latest.fileSize)}
              </span>
            </div>
            <div>
              <span className="text-xs text-[var(--muted-foreground)] block">Toplam İndirme</span>
              <span className="text-xs font-semibold text-[var(--primary)] block mt-0.5">
                {latest.downloadCount} kez
              </span>
            </div>
            <div>
              <span className="text-xs text-[var(--muted-foreground)] block">Yüklenme Tarihi</span>
              <span className="text-xs text-[var(--foreground)] block mt-0.5">
                {formatDate(latest.createdAt)}
              </span>
            </div>
            {latest.notes && (
              <div className="col-span-2 sm:col-span-4 rounded-lg bg-[var(--muted)]/40 p-3 mt-1">
                <span className="text-xs font-medium text-[var(--muted-foreground)] block mb-1">
                  Sürüm Notları:
                </span>
                <p className="text-xs text-[var(--foreground)] whitespace-pre-line leading-relaxed">
                  {latest.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Yeni APK Yükleme Formu */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Upload className="h-5 w-5 text-[var(--primary)]" />
            Yeni APK Sürümü Ekle
          </h2>

          <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--background)] p-1">
            <button
              type="button"
              onClick={() => setUploadMode("file")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                uploadMode === "file"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              APK Dosyası Yükle
            </button>
            <button
              type="button"
              onClick={() => setUploadMode("url")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                uploadMode === "url"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              Harici İndirme Linki (URL)
            </button>
          </div>
        </div>

        <form onSubmit={handleUpload} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--foreground)] mb-1.5">
                Sürüm Numarası *
              </label>
              <input
                type="text"
                placeholder="Örn: 1.0.0 veya v1.0.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                required
                className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--foreground)] mb-1.5">
                Sürüm Kodu (Version Code)
              </label>
              <input
                type="number"
                placeholder="Örn: 1, 2, 3..."
                value={versionCode}
                onChange={(e) => setVersionCode(e.target.value)}
                min="1"
                className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
          </div>

          {uploadMode === "file" ? (
            <div>
              <label className="block text-xs font-medium text-[var(--foreground)] mb-1.5">
                APK Dosyası (.apk) *
              </label>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".apk,application/vnd.android.package-archive"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                  }}
                  className="block w-full text-xs text-[var(--muted-foreground)] file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--primary)]/10 file:text-[var(--primary)] hover:file:bg-[var(--primary)]/20 cursor-pointer border border-[var(--border)] rounded-lg p-1.5 bg-[var(--background)]"
                />
              </div>
              {selectedFile && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Seçilen dosya: {selectedFile.name} ({formatBytes(selectedFile.size)})
                  </p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    Dosya otomatik olarak 15MB&apos;lık parçalar halinde yüklenir (Cloudflare 100MB sınırına takılmaz).
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-[var(--foreground)] mb-1.5">
                Harici APK İndirme Bağlantısı (URL) *
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                <input
                  type="url"
                  placeholder="https://github.com/user/repo/releases/download/v1.0.0/calium.apk"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  required
                  className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">
                GitHub Releases, S3 veya harici sunucunuzdaki doğrudan APK indirme linkini ekleyebilirsiniz.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--foreground)] mb-1.5">
              Sürüm Notları / Değişiklikler (Opsiyonel)
            </label>
            <textarea
              rows={3}
              placeholder="Bu sürümdeki yenilikler, hata düzeltmeleri..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </div>

          {/* İlerleme çubuğu */}
          {uploading && (
            <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--foreground)] flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--primary)]" />
                  {uploadStatusText || "Yükleniyor..."}
                </span>
                <span className="font-semibold text-[var(--primary)]">%{uploadProgress}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className="h-full bg-[var(--primary)] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={
                uploading ||
                !version.trim() ||
                (uploadMode === "file" && !selectedFile) ||
                (uploadMode === "url" && !externalUrl.trim())
              }
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-[var(--primary-foreground)] shadow-sm transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  İşleniyor...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {uploadMode === "file" ? "APK'yı Parçalı Yükle ve Yayınla" : "Harici Sürümü Kaydet"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Sürüm Geçmişi Tablosu */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-lg font-semibold mb-4">Tüm APK Sürümleri ({releases.length})</h2>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
          </div>
        ) : releases.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted-foreground)]">
            Henüz yüklenmiş bir APK sürümü bulunmuyor.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs font-medium text-[var(--muted-foreground)]">
                  <th className="pb-3 pr-4">Sürüm</th>
                  <th className="pb-3 px-4">Dosya / Link</th>
                  <th className="pb-3 px-4">Boyut</th>
                  <th className="pb-3 px-4">İndirme</th>
                  <th className="pb-3 px-4">Tarih</th>
                  <th className="pb-3 pl-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {releases.map((rel, index) => (
                  <tr key={rel.id} className="hover:bg-[var(--muted)]/30">
                    <td className="py-3 pr-4 font-medium">
                      <div className="flex items-center gap-2">
                        <span>{rel.version}</span>
                        {index === 0 && (
                          <span className="rounded bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--primary)]">
                            GÜNCEL
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        Kod: {rel.versionCode}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-[var(--muted-foreground)] truncate max-w-[200px]">
                      {rel.fileName}
                    </td>
                    <td className="py-3 px-4 text-xs">{formatBytes(rel.fileSize)}</td>
                    <td className="py-3 px-4 text-xs font-semibold text-[var(--foreground)]">
                      {rel.downloadCount}
                    </td>
                    <td className="py-3 px-4 text-xs text-[var(--muted-foreground)]">
                      {formatDate(rel.createdAt)}
                    </td>
                    <td className="py-3 pl-4 text-right space-x-2">
                      <a
                        href={`/api/apk/download?id=${rel.id}`}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition"
                        title="İndir"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => handleDelete(rel.id, rel.version)}
                        disabled={deletingId === rel.id}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-[var(--border)] text-red-500 hover:bg-red-500/10 transition disabled:opacity-50"
                        title="Sil"
                      >
                        {deletingId === rel.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
