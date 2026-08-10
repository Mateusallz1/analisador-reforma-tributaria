import React, { useRef, useState } from 'react';
import { FileArchive, FileText, FolderUp } from 'lucide-react';

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
        className={`relative flex min-h-[280px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-10 transition-colors sm:px-8 ${
          isDragActive
            ? 'border-neutral bg-neutral/5 text-base-content'
            : 'border-base-300 bg-base-200/25 text-base-content/70 hover:border-neutral/50 hover:bg-base-200/50'
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

        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-base-100 text-base-content/65 shadow-sm">
          <FolderUp className="h-6 w-6" aria-hidden="true" />
        </div>

        <h3 className="mb-1 text-center text-lg font-semibold text-base-content">
          Solte arquivos .xml ou .zip aqui
        </h3>
        <p className="mb-5 max-w-md text-center text-sm leading-relaxed text-base-content/55">
          Ou selecione os documentos fiscais no seu computador.
        </p>

        <button
          type="button"
          id="btn-upload-trigger"
          className="btn btn-neutral rounded-full px-7 shadow-md"
          disabled={isLoading}
        >
          {isLoading ? 'Analisando...' : 'Selecionar arquivos'}
        </button>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs text-base-content/50">
          <span className="inline-flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> XML
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FileArchive className="h-3.5 w-3.5" /> ZIP
          </span>
        </div>
      </div>
    </div>
  );
}
