/**
 * 数据迁移：从 localStorage 迁移到 IndexedDB
 */

import { importStockData, getDBStats } from './index';
import { needsRestore, restoreFromBackup, getBackupInfo } from './backup';
import type { DayData } from '../types';

const STORAGE_KEY = 'stock-analyzer-data';
const MIGRATION_FLAG = 'stock-analyzer-migrated-v1';

/**
 * 检查是否需要迁移
 */
export function needsMigration(): boolean {
  // 如果已经迁移过，跳过
  if (localStorage.getItem(MIGRATION_FLAG)) {
    return false;
  }

  // 如果 localStorage 中有旧数据，需要迁移
  const oldData = localStorage.getItem(STORAGE_KEY);
  return !!oldData;
}

/**
 * 执行迁移
 */
export async function migrateFromLocalStorage(): Promise<{
  success: boolean;
  migratedDays: number;
  migratedStocks: number;
  error?: string;
}> {
  try {
    const oldDataStr = localStorage.getItem(STORAGE_KEY);
    if (!oldDataStr) {
      // 没有旧数据，标记为已迁移
      localStorage.setItem(MIGRATION_FLAG, 'true');
      return { success: true, migratedDays: 0, migratedStocks: 0 };
    }

    const oldData = JSON.parse(oldDataStr) as {
      dayDataList: DayData[];
      selectedDay: string | null;
    };

    if (!oldData.dayDataList || oldData.dayDataList.length === 0) {
      localStorage.setItem(MIGRATION_FLAG, 'true');
      return { success: true, migratedDays: 0, migratedStocks: 0 };
    }

    let totalStocks = 0;

    // 迁移每一天的数据
    for (const dayData of oldData.dayDataList) {
      // 准备股票数据
      const stocks = dayData.allStocks.map(stock => {
        // 找到这只股票属于哪些公式
        const formulas: string[] = [];
        for (const group of dayData.groups) {
          if (group.stocks.some(s => s.code === stock.code)) {
            formulas.push(group.name);
          }
        }

        return {
          code: stock.code,
          name: stock.name,
          industry: stock.industry || '',
          region: stock.region || '',
          price: stock.price,
          open: stock.open || stock.price,
          high: stock.high || stock.price,
          low: stock.low || stock.price,
          change: stock.change,
          volume: stock.volume,
          turnover: stock.turnover,
          amplitude: stock.amplitude,
          pe: stock.pe,
          peTTM: stock.peTTM,
          pb: stock.pb,
          ps: stock.ps,
          marketCap: stock.marketCap,
          change3d: stock.change3d,
          change5d: stock.change5d,
          change10d: stock.change10d,
          change20d: stock.change20d,
          change60d: stock.change60d,
          changeYear: stock.changeYear,
          volumeRatio: stock.volumeRatio,
          upDays: stock.upDays,
          technicalSignal: stock.technicalSignal,
          dist5ma: stock.dist5ma,
          grossMargin: stock.grossMargin,
          netMargin: stock.netMargin,
          debtRatio: stock.debtRatio,
          profitYoy: stock.profitYoy,
          revenueYoy: stock.revenueYoy,
          dividendYield: stock.dividendYield,
          formulas
        };
      });

      // 导入到数据库
      await importStockData(
        dayData.date,
        stocks,
        dayData.index ? {
          code: dayData.index.code,
          name: dayData.index.name,
          price: dayData.index.price,
          change: dayData.index.change
        } : undefined
      );

      totalStocks += stocks.length;
    }

    // 保存选中的日期
    if (oldData.selectedDay) {
      localStorage.setItem('stock-analyzer-selected-day', oldData.selectedDay);
    }

    // 标记迁移完成
    localStorage.setItem(MIGRATION_FLAG, 'true');

    // 可选：删除旧数据以节省空间
    // localStorage.removeItem(STORAGE_KEY);

    return {
      success: true,
      migratedDays: oldData.dayDataList.length,
      migratedStocks: totalStocks
    };
  } catch (e) {
    return {
      success: false,
      migratedDays: 0,
      migratedStocks: 0,
      error: e instanceof Error ? e.message : '迁移失败'
    };
  }
}

/**
 * 获取迁移状态
 */
export function getMigrationStatus(): {
  migrated: boolean;
  hasOldData: boolean;
} {
  return {
    migrated: !!localStorage.getItem(MIGRATION_FLAG),
    hasOldData: !!localStorage.getItem(STORAGE_KEY)
  };
}

/**
 * 重置迁移状态（用于调试）
 */
export function resetMigrationStatus(): void {
  localStorage.removeItem(MIGRATION_FLAG);
}

/**
 * 初始化数据库（包含迁移检查和自动恢复）
 */
export async function initializeDB(): Promise<{
  ready: boolean;
  migrated: boolean;
  restored: boolean;
  migratedDays?: number;
  migratedStocks?: number;
  restoredDays?: number;
  restoredRecords?: number;
  error?: string;
}> {
  try {
    // 1. 检查是否需要从旧 localStorage 迁移
    if (needsMigration()) {
      console.log('[DB] 检测到旧数据，开始迁移...');
      const result = await migrateFromLocalStorage();
      if (result.success) {
        console.log(`[DB] 迁移完成: ${result.migratedDays} 天, ${result.migratedStocks} 条记录`);
        return {
          ready: true,
          migrated: true,
          restored: false,
          migratedDays: result.migratedDays,
          migratedStocks: result.migratedStocks
        };
      } else {
        console.error('[DB] 迁移失败:', result.error);
        return {
          ready: false,
          migrated: false,
          restored: false,
          error: result.error
        };
      }
    }

    // 2. 检查是否需要从备份恢复（IndexedDB 为空但有备份）
    if (await needsRestore()) {
      const backupInfo = getBackupInfo();
      console.log(`[DB] 检测到备份数据，开始自动恢复...`, backupInfo);
      const result = await restoreFromBackup();
      if (result.success) {
        console.log(`[DB] 自动恢复完成: ${result.restored.dates} 天, ${result.restored.records} 条记录`);
        return {
          ready: true,
          migrated: false,
          restored: true,
          restoredDays: result.restored.dates,
          restoredRecords: result.restored.records
        };
      } else {
        console.warn('[DB] 自动恢复失败:', result.error);
        // 恢复失败不阻止启动，只是警告
      }
    }

    // 3. 数据库已就绪
    const stats = await getDBStats();
    console.log(`[DB] 数据库就绪: ${stats.stockCount} 只股票, ${stats.recordCount} 条记录, ${stats.dateCount} 个日期`);

    return {
      ready: true,
      migrated: false,
      restored: false
    };
  } catch (e) {
    console.error('[DB] 初始化失败:', e);
    return {
      ready: false,
      migrated: false,
      restored: false,
      error: e instanceof Error ? e.message : '初始化失败'
    };
  }
}
