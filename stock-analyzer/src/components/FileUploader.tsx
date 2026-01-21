import { useCallback } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';

interface FileUploaderProps {
  onFilesSelected: (files: FileList) => void;
  isLoading?: boolean;
}

export function FileUploader({ onFilesSelected, isLoading }: FileUploaderProps) {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  }, [onFilesSelected]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  }, [onFilesSelected]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={`
        border-2 border-dashed rounded-xl p-8 text-center transition-all
        ${isLoading 
          ? 'border-blue-300 bg-blue-50' 
          : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/50'}
      `}
    >
      <input
        type="file"
        accept=".xls,.xlsx,.csv"
        multiple
        onChange={handleChange}
        className="hidden"
        id="file-upload"
        disabled={isLoading}
      />
      <label htmlFor="file-upload" className="cursor-pointer">
        <div className="flex flex-col items-center gap-4">
          {isLoading ? (
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
          ) : (
            <div className="p-4 bg-blue-100 rounded-full">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
          )}
          <div>
            <p className="text-lg font-medium text-slate-700">
              {isLoading ? '正在解析...' : '拖放或点击上传 Excel 文件'}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              支持通达信导出的 .xls, .xlsx 格式，可同时上传多日数据
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <FileSpreadsheet className="w-4 h-4" />
            <span>自选股20251210.xls</span>
          </div>
        </div>
      </label>
    </div>
  );
}
