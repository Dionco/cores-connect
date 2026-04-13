import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type DocumentCategory = 'onboarding' | 'signature' | 'contract' | 'id' | 'other';

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  category: DocumentCategory;
  name: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  meta: Record<string, unknown>;
  uploadedAt: string;
  uploadedBy?: string | null;
}

export const BUCKET = 'employee-documents';
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/html',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const EXTENSION_FALLBACK: Record<string, string> = {
  htm: 'text/html',
  html: 'text/html',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export const resolveMimeType = (file: File): string => {
  if (file.type && ALLOWED_MIME.has(file.type)) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_FALLBACK[ext] || file.type || 'application/octet-stream';
};

export const validateFile = (file: File): string | null => {
  if (file.size === 0) return 'File is empty';
  if (file.size > MAX_DOCUMENT_BYTES) return 'File exceeds 25 MB limit';
  const mime = resolveMimeType(file);
  if (!ALLOWED_MIME.has(mime)) return `Unsupported file type (${mime || 'unknown'})`;
  return null;
};

const sanitizeFilename = (name: string) =>
  name.replace(/[^\w.-]+/g, '_').replace(/_{2,}/g, '_').slice(0, 120) || 'file';

const buildStoragePath = (employeeId: string, category: DocumentCategory, filename: string) => {
  const safe = sanitizeFilename(filename);
  const uuid = crypto.randomUUID();
  return `${employeeId}/${category}/${uuid}-${safe}`;
};

// ---------- Mock fallback (localStorage) ----------

const MOCK_KEY = 'cores:employee-documents';

interface MockRecord extends EmployeeDocument {
  dataUrl: string;
}

const readMockStore = (): MockRecord[] => {
  try {
    const raw = localStorage.getItem(MOCK_KEY);
    return raw ? (JSON.parse(raw) as MockRecord[]) : [];
  } catch {
    return [];
  }
};

const writeMockStore = (records: MockRecord[]) => {
  localStorage.setItem(MOCK_KEY, JSON.stringify(records));
};

const fileToDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

// ---------- Public API ----------

export const listEmployeeDocuments = async (employeeId: string): Promise<EmployeeDocument[]> => {
  if (!isSupabaseConfigured || !supabase) {
    return readMockStore()
      .filter((d) => d.employeeId === employeeId)
      .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
  }

  const { data, error } = await supabase
    .from('employee_documents')
    .select('id, employee_id, category, name, storage_path, mime_type, size_bytes, meta, uploaded_at, uploaded_by')
    .eq('employee_id', employeeId)
    .order('uploaded_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    category: row.category as DocumentCategory,
    name: row.name,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    meta: (row.meta as Record<string, unknown>) || {},
    uploadedAt: row.uploaded_at,
    uploadedBy: row.uploaded_by,
  }));
};

export interface UploadInput {
  employeeId: string;
  category: DocumentCategory;
  file: Blob;
  filename: string;
  mimeType?: string;
  meta?: Record<string, unknown>;
}

export const uploadEmployeeDocument = async (input: UploadInput): Promise<EmployeeDocument> => {
  const { employeeId, category, file, filename, meta } = input;
  const mime = input.mimeType || (file instanceof File ? resolveMimeType(file) : 'application/octet-stream');
  const path = buildStoragePath(employeeId, category, filename);

  if (!isSupabaseConfigured || !supabase) {
    const dataUrl = await fileToDataUrl(file);
    const record: MockRecord = {
      id: crypto.randomUUID(),
      employeeId,
      category,
      name: filename,
      storagePath: path,
      mimeType: mime,
      sizeBytes: file.size,
      meta: meta || {},
      uploadedAt: new Date().toISOString(),
      dataUrl,
    };
    const store = readMockStore();
    store.push(record);
    writeMockStore(store);
    const { dataUrl: _, ...rest } = record;
    return rest;
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: mime, upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from('employee_documents')
    .insert({
      employee_id: employeeId,
      category,
      name: filename,
      storage_path: path,
      mime_type: mime,
      size_bytes: file.size,
      meta: meta || {},
    })
    .select('id, employee_id, category, name, storage_path, mime_type, size_bytes, meta, uploaded_at, uploaded_by')
    .single();

  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
    throw new Error(error?.message || 'Failed to save document metadata');
  }

  return {
    id: data.id,
    employeeId: data.employee_id,
    category: data.category as DocumentCategory,
    name: data.name,
    storagePath: data.storage_path,
    mimeType: data.mime_type,
    sizeBytes: data.size_bytes,
    meta: (data.meta as Record<string, unknown>) || {},
    uploadedAt: data.uploaded_at,
    uploadedBy: data.uploaded_by,
  };
};

export const deleteEmployeeDocument = async (doc: EmployeeDocument): Promise<void> => {
  if (!isSupabaseConfigured || !supabase) {
    const store = readMockStore().filter((d) => d.id !== doc.id);
    writeMockStore(store);
    return;
  }

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([doc.storagePath]);
  if (storageError) throw new Error(storageError.message);

  const { error } = await supabase.from('employee_documents').delete().eq('id', doc.id);
  if (error) throw new Error(error.message);
};

export const getDocumentDownloadUrl = async (doc: EmployeeDocument): Promise<string> => {
  if (!isSupabaseConfigured || !supabase) {
    const record = readMockStore().find((d) => d.id === doc.id);
    if (!record) throw new Error('Document not found');
    return record.dataUrl;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.storagePath, 60);
  if (error || !data?.signedUrl) throw new Error(error?.message || 'Failed to create signed URL');
  return data.signedUrl;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
