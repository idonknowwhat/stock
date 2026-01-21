/**
 * Export目录文件服务
 * 与后端API交互，管理NAS上的Excel文件
 */

const API_BASE = '/api/export';

export interface ExportFile {
  name: string;
  size: number;
  modified: string;
  date: string | null;  // 从文件名提取的日期 YYYYMMDD
  isSingleStock: boolean;  // 是否为单只股票文件
}

// 获取export目录的文件列表
export async function getExportFiles(): Promise<ExportFile[]> {
  try {
    const response = await fetch(`${API_BASE}/files`);
    const data = await response.json();
    if (data.success) {
      return data.files;
    }
    throw new Error(data.error || '获取文件列表失败');
  } catch (err) {
    console.error('获取export文件列表失败:', err);
    return [];
  }
}

// 下载并解析export目录的文件
export async function fetchExportFile(filename: string): Promise<File | null> {
  try {
    const response = await fetch(`${API_BASE}/file/${encodeURIComponent(filename)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  } catch (err) {
    console.error(`下载文件 ${filename} 失败:`, err);
    return null;
  }
}

// 上传文件到export目录
export async function uploadToExport(files: FileList | File[]): Promise<{ success: boolean; files?: { name: string; size: number }[]; error?: string }> {
  try {
    const formData = new FormData();
    for (const file of Array.from(files)) {
      formData.append('files', file);
    }
    
    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData
    });
    
    return await response.json();
  } catch (err) {
    console.error('上传文件失败:', err);
    return { success: false, error: String(err) };
  }
}

// 删除export目录的文件
export async function deleteExportFile(filename: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/file/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    return data.success;
  } catch (err) {
    console.error(`删除文件 ${filename} 失败:`, err);
    return false;
  }
}
