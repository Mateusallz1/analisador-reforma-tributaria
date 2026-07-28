import React, { useRef, useState } from 'react';
import { FileArchive, FileText, Upload } from 'lucide-react';

interface UploadSectionProps {
  onFilesSelected: (files: File[]) => void;
  isLoading: boolean;
}

export default function UploadSection({ onFilesSelected, isLoading }: UploadSectionProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles: File[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'xml' || ext === 'zip') {
          validFiles.push(file);
        }
      }
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        id="drop-zone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`card relative flex min-h-[360px] w-full cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-14 transition-colors ${
          isDragActive
            ? 'border-neutral bg-neutral/5 text-base-content'
            : 'border-base-300 bg-base-100 text-base-content/70 hover:border-neutral/50'
        } ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          id="nfe-file-input"
          multiple
          accept=".xml,.zip"
          className="hidden"
          onChange={handleFileInputChange}
        />

        <div className="mb-5 flex gap-3">
          <div className="rounded-box border border-base-300 bg-base-200 p-3 text-base-content/60">
            <Upload className="h-7 w-7" />
          </div>
          <div className="rounded-box border border-base-300 bg-base-200 p-3 text-base-content/60">
            <FileArchive className="h-7 w-7" />
          </div>
        </div>

        <h3 className="mb-1 text-center text-lg font-semibold text-base-content">
          Envie XMLs ou ZIPs
        </h3>
        <p className="mb-6 max-w-md text-center text-sm leading-relaxed text-base-content/60">
          Arraste os arquivos para cá ou selecione XMLs de NF-e/NFC-e/NFS-e e pacotes ZIP.
        </p>

        <button
          type="button"
          id="btn-upload-trigger"
          className="btn btn-neutral"
          disabled={isLoading}
        >
          {isLoading ? 'Analisando...' : 'Selecionar arquivos'}
        </button>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-base-300 pt-5 text-xs text-base-content/60">
          <span className="badge badge-ghost badge-sm gap-1.5">
            <FileText className="h-3.5 w-3.5" /> XML
          </span>
          <span className="badge badge-ghost badge-sm gap-1.5">
            <FileArchive className="h-3.5 w-3.5" /> ZIP
          </span>
        </div>
      </div>
    </div>
  );
}
