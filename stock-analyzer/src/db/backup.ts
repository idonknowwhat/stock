/**
 * 自动备份/恢复机制
 * 使用 localStorage 作为 IndexedDB 的备份存储
 */

import { db, type DailyRecord, type DateMeta, type StockInfo, type AIAnalysisSummary } from './index';

const BACKUP_KEY = 'stock-analyzer-db-backup';
const BACKUP_VERSION = 2;

interface BackupData {
  version: number;
  timestamp: string;
  stocks: StockInfo[];
  dailyRecords: DailyRecord[];
  dateMetas: DateMeta[];
  aiAnalysisSummaries?: AIAnalysisSummary[];
}

/**
 * 创建数据库备份到 localStorage
 */
export async function createBackup(): Promise<{ success: boolean; size: number; error?: string }> {
  try {
    const [stocks, dailyRecords, dateMetas, aiAnalysisSummaries] = await Promise.all([
      db.stocks.toArray(),
      db.dailyRecords.toArray(),
      db.dateMetas.toArray(),
      db.aiAnalysisSummaries.toArray()
    ]);

    // 如果没有数据，不创建备份
    if (dateMetas.length === 0) {
      console.log('[Backup] 数据库为空，跳过备份');
      return { success: true, size: 0 };
    }

    const backup: BackupData = {
      version: BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      stocks,
      dailyRecords,
      dateMetas,
      aiAnalysisSummaries
    };

    const json = JSON.stringify(backup);
    const size = json.length;

    // 检查是否超过 localStorage 限制 (约 5MB)
    if (size > 4 * 1024 * 1024) {
      console.warn('[Backup] 数据过大，可能超出 localStorage 限制');
    }

    localStorage.setItem(BACKUP_KEY, json);
    console.log(`[Backup] 备份成功: ${dateMetas.length} 个日期, ${dailyRecords.length} 条记录, ${(size / 1024).toFixed(1)}KB`);

    return { success: true, size };
  } catch (e) {
    const error = e instanceof Error ? e.message : '备份失败';
    console.error('[Backup] 备份失败:', error);
    return { success: false, size: 0, error };
  }
}

/**
 * 检查是否有备份
 */
export function hasBackup(): boolean {
  return !!localStorage.getItem(BACKUP_KEY);
}

/**
 * 获取备份信息
 */
export function getBackupInfo(): { timestamp: string; dateCount: number; recordCount: number } | null {
  try {
    const json = localStorage.getItem(BACKUP_KEY);
    if (!json) return null;

    const backup: BackupData = JSON.parse(json);
    return {
      timestamp: backup.timestamp,
      dateCount: backup.dateMetas.length,
      recordCount: backup.dailyRecords.length
    };
  } catch {
    return null;
  }
}

/**
 * 从 localStorage 恢复数据到 IndexedDB
 */
export async function restoreFromBackup(): Promise<{
  success: boolean;
  restored: { dates: number; records: number };
  error?: string;
}> {
  try {
    const json = localStorage.getItem(BACKUP_KEY);
    if (!json) {
      return { success: false, restored: { dates: 0, records: 0 }, error: '没有找到备份数据' };
    }

    const backup: BackupData = JSON.parse(json);
    console.log(`[Backup] 开始恢复: ${backup.dateMetas.length} 个日期, ${backup.dailyRecords.length} 条记录`);

    // 恢复股票基础信息
    await db.stocks.bulkPut(backup.stocks);

    // 恢复每日记录
    await db.dailyRecords.bulkPut(backup.dailyRecords);

    // 恢复日期元数据
    await db.dateMetas.bulkPut(backup.dateMetas);

    // 恢复 AI 分析摘要（如果存在）
    if (backup.aiAnalysisSummaries && backup.aiAnalysisSummaries.length > 0) {
      await db.aiAnalysisSummaries.bulkPut(backup.aiAnalysisSummaries);
      console.log(`[Backup] 恢复 AI 分析摘要: ${backup.aiAnalysisSummaries.length} 条`);
    }

    console.log('[Backup] 恢复成功');
    return {
      success: true,
      restored: {
        dates: backup.dateMetas.length,
        records: backup.dailyRecords.length
      }
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : '恢复失败';
    console.error('[Backup] 恢复失败:', error);
    return { success: false, restored: { dates: 0, records: 0 }, error };
  }
}

/**
 * 检查是否需要从备份恢复
 * 当 IndexedDB 为空但 localStorage 有备份时返回 true
 */
export async function needsRestore(): Promise<boolean> {
  const dateCount = await db.dateMetas.count();
  if (dateCount > 0) {
    return false; // 数据库有数据，不需要恢复
  }

  return hasBackup();
}

/**
 * 删除备份
 */
export function clearBackup(): void {
  localStorage.removeItem(BACKUP_KEY);
  console.log('[Backup] 备份已清除');
}

/**
 * 导出备份为 JSON 文件（手动下载）
 */
export async function exportBackupFile(): Promise<void> {
  const [stocks, dailyRecords, dateMetas, aiAnalysisSummaries] = await Promise.all([
    db.stocks.toArray(),
    db.dailyRecords.toArray(),
    db.dateMetas.toArray(),
    db.aiAnalysisSummaries.toArray()
  ]);

  const backup: BackupData = {
    version: BACKUP_VERSION,
    timestamp: new Date().toISOString(),
    stocks,
    dailyRecords,
    dateMetas,
    aiAnalysisSummaries
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `stock-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * 从 JSON 文件导入备份
 */
export async function importBackupFile(file: File): Promise<{
  success: boolean;
  imported: { dates: number; records: number };
  error?: string;
}> {
  try {
    const text = await file.text();
    const backup: BackupData = JSON.parse(text);

    if (!backup.version || !backup.dateMetas || !backup.dailyRecords) {
      return { success: false, imported: { dates: 0, records: 0 }, error: '无效的备份文件格式' };
    }

    // 清空现有数据
    await db.transaction('rw', [db.stocks, db.dailyRecords, db.dateMetas, db.aiAnalysisSummaries], async () => {
      await db.stocks.clear();
      await db.dailyRecords.clear();
      await db.dateMetas.clear();
      await db.aiAnalysisSummaries.clear();

      // 导入备份数据
      await db.stocks.bulkPut(backup.stocks);
      await db.dailyRecords.bulkPut(backup.dailyRecords);
      await db.dateMetas.bulkPut(backup.dateMetas);

      // 导入 AI 分析摘要（如果存在）
      if (backup.aiAnalysisSummaries && backup.aiAnalysisSummaries.length > 0) {
        await db.aiAnalysisSummaries.bulkPut(backup.aiAnalysisSummaries);
      }
    });

    // 同时更新 localStorage 备份
    localStorage.setItem(BACKUP_KEY, text);

    return {
      success: true,
      imported: {
        dates: backup.dateMetas.length,
        records: backup.dailyRecords.length
      }
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : '导入失败';
    return { success: false, imported: { dates: 0, records: 0 }, error };
  }
}
