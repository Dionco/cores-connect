import React, { useRef, useState } from 'react';
import type { Employee } from '@/data/mockData';
import { useEmployeeDocuments } from '@/hooks/useEmployeeDocuments';
import {
  getDocumentDownloadUrl,
  validateFile,
  formatFileSize,
  type DocumentCategory,
  type EmployeeDocument,
} from '@/lib/documents';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Download, FileText, Loader2, PenSquare, Trash2, Upload } from 'lucide-react';
import SignatureGeneratorDialog from './SignatureGeneratorDialog';

const CATEGORIES: DocumentCategory[] = ['onboarding', 'signature', 'contract', 'id', 'other'];

interface Props {
  employee: Employee;
}

export const DocumentsTab: React.FC<Props> = ({ employee }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { documents, isLoading, upload, isUploading, remove } = useEmployeeDocuments(employee.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('onboarding');
  const [isDragging, setIsDragging] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<EmployeeDocument | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const error = validateFile(file);
      if (error) {
        toast({ title: t('documents.uploadFailed'), description: `${file.name}: ${error}`, variant: 'destructive' });
        continue;
      }
      try {
        await upload({
          employeeId: employee.id,
          category: uploadCategory,
          file,
          filename: file.name,
        });
        toast({ title: t('documents.uploadSuccess'), description: file.name });
      } catch (err) {
        toast({
          title: t('documents.uploadFailed'),
          description: err instanceof Error ? err.message : String(err),
          variant: 'destructive',
        });
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = async (doc: EmployeeDocument) => {
    try {
      const url = await getDocumentDownloadUrl(doc);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast({
        title: t('documents.downloadFailed'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await remove(pendingDelete);
      toast({ title: t('documents.deleteSuccess') });
    } catch (err) {
      toast({
        title: t('documents.deleteFailed'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setPendingDelete(null);
    }
  };

  const grouped = CATEGORIES.reduce<Record<DocumentCategory, EmployeeDocument[]>>((acc, cat) => {
    acc[cat] = documents.filter((d) => d.category === cat);
    return acc;
  }, { onboarding: [], signature: [], contract: [], id: [], other: [] });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px]">
          <label className="text-xs text-muted-foreground">{t('documents.category')}</label>
          <Select value={uploadCategory} onValueChange={(v) => setUploadCategory(v as DocumentCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{t(`documents.category.${c}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="gap-2"
        >
          {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {t('documents.upload')}
        </Button>
        <Button onClick={() => setSignatureOpen(true)} className="gap-2">
          <PenSquare size={16} /> {t('documents.generateSignature')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.doc,.docx,.htm,.html,.txt,.png,.jpg,.jpeg,.webp"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border text-muted-foreground'
        }`}
      >
        {t('documents.dropzone')}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> {t('documents.loading')}
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map((cat) => (
            <div key={cat}>
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {t(`documents.category.${cat}`)}
                <span className="ml-2 text-xs font-normal text-muted-foreground">({grouped[cat].length})</span>
              </h3>
              {grouped[cat].length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('documents.emptyCategory')}</p>
              ) : (
                <div className="space-y-2">
                  {grouped[cat].map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <FileText size={18} className="text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.sizeBytes)} · {new Date(doc.uploadedAt).toLocaleString()}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)} className="gap-1">
                        <Download size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDelete(doc)}
                        className="gap-1 text-destructive hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <SignatureGeneratorDialog
        employee={employee}
        open={signatureOpen}
        onOpenChange={setSignatureOpen}
      />

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('documents.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('documents.deleteConfirmDescription')} {pendingDelete?.name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('documents.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t('documents.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DocumentsTab;
