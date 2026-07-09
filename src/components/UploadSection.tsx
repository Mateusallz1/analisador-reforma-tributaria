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
        className={`relative flex min-h-[360px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-14 transition-colors ${
          isDragActive
            ? 'border-slate-500 bg-slate-100 text-slate-900'
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600'
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
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-slate-500">
            <Upload className="h-7 w-7" />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-slate-500">
            <FileArchive className="h-7 w-7" />
          </div>
        </div>

        <h3 className="mb-1 text-center text-lg font-semibold text-slate-800">
          Envie XMLs ou ZIPs
        </h3>
        <p className="mb-6 max-w-md text-center text-sm leading-relaxed text-slate-500">
          Arraste os arquivos para cá ou selecione XMLs de NF-e/NFC-e/NFS-e e pacotes ZIP.
        </p>

        <button
          type="button"
          id="btn-upload-trigger"
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          disabled={isLoading}
        >
          {isLoading ? 'Analisando...' : 'Selecionar arquivos'}
        </button>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 pt-5 text-xs text-slate-500">
          <span className="flex items-center gap-1.5 font-medium">
            <FileText className="h-3.5 w-3.5 text-slate-400" /> XML
          </span>
          <span className="h-1 w-1 rounded-full bg-slate-200" />
          <span className="flex items-center gap-1.5 font-medium">
            <FileArchive className="h-3.5 w-3.5 text-slate-400" /> ZIP
          </span>
        </div>
      </div>
    </div>
  );
}
