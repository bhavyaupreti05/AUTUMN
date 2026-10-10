import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useDocuments } from '../../hooks/useDocuments';
import { Paperclip, X, FileText, Loader2, AlertCircle } from 'lucide-react';

interface DocumentUploaderProps {
  conversationId: string | null;
}

export function DocumentUploader({ conversationId }: DocumentUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { documents, uploadDocument, isUploading, uploadError, detachDocument } = useDocuments(conversationId);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadDocument(file);
    }
    // Reset input so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!conversationId) return null;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pt-2">
      <div className="flex flex-wrap gap-2 mb-2 items-center">
        {/* Render attached documents */}
        {documents.map((doc) => (
          <div 
            key={doc.id} 
            className={`relative overflow-hidden flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] border text-sm w-[220px]
              ${doc.status === 'FAILED' ? 'bg-[rgba(250,82,82,0.1)] border-[rgba(250,82,82,0.3)] text-[var(--error)]' : 'bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'}
            `}
          >
            {/* Progress Fill Background */}
            {doc.status === 'PROCESSING' && doc.progress !== undefined && (
              <div 
                className="absolute left-0 top-0 bottom-0 bg-[var(--legacy-accent)] opacity-10 transition-all duration-300 ease-out"
                style={{ width: `${Math.max(5, doc.progress)}%` }}
              />
            )}
            
            <div className="relative z-10 flex items-center gap-2 w-full">
              {doc.status === 'PROCESSING' ? (
                <Loader2 size={14} className="animate-spin shrink-0 text-[var(--legacy-accent)]" />
              ) : doc.status === 'FAILED' ? (
                <AlertCircle size={14} className="shrink-0" />
              ) : (
                <FileText size={14} className="shrink-0 text-[var(--legacy-accent)]" />
              )}
              
              <div className="flex flex-col flex-1 min-w-0">
                <span className="truncate" title={doc.filename}>{doc.filename}</span>
                {doc.status === 'PROCESSING' && doc.progress !== undefined && (
                  <span className="text-[10px] text-[var(--legacy-accent)] font-medium leading-none mt-0.5">
                    {doc.progress < 20 ? 'Extracting Text...' : doc.progress < 40 ? 'Chunking...' : 'Generating Vectors...'} {Math.round(doc.progress)}%
                  </span>
                )}
              </div>

              <button 
                onClick={() => detachDocument(doc.id)}
                className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors shrink-0 ml-auto"
                title="Remove document"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
        
        {/* Upload error banner (dismissable by uploading another) */}
        {uploadError && (
          <div className="text-[var(--error)] text-xs flex items-center gap-1 bg-[rgba(250,82,82,0.1)] px-2 py-1 rounded-[var(--radius-sm)]">
            <AlertCircle size={12} /> {uploadError}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.docx,.xlsx,.csv"
      />
      
      {/* Upload button wrapper (absolute positioned relative to ChatInput later, or just here) */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="text-[var(--text-muted)] hover:text-[var(--legacy-accent)] disabled:opacity-50 transition-colors flex items-center gap-1 text-sm font-medium p-1 rounded-[var(--radius-sm)]"
        title="Attach Document (.pdf, .docx, .xlsx, .csv)"
      >
        {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
        {isUploading ? 'Uploading...' : 'Attach File'}
      </button>
    </div>
  );
}
