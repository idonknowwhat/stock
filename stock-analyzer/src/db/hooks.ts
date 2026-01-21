/**
 * React Hook: 封装数据库操作
 */

import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  type DailyRecord,
  type StockInfo,
  getAllDates,
  getStocksByDate,
  getStocksHistory,
  importStockData,
  deleteDate,
  clearAllData,
  getDBStats
} from './index';
import { createBackup } from './backup';
import type { Stock, DayData, StockGroup } from '../types';
import { parseExcelFile } from '../utils/excelParser';

// ==================== 数据转换函数 ====================

/**
 * 将 DailyRecord 转换为 Stock 类型（兼容现有组件）
 */
export function dailyRecordToStock(record: DailyRecord, stockInfo?: StockInfo): Stock {
  return {
    code: record.code,
    name: stockInfo?.name || record.code,
    price: record.price,
    open: record.open,
    high: record.high,
    low: record.low,
    change: record.change,
    volume: record.volume,
    turnover: record.turnover,
    amplitude: record.amplitude,
    pe: record.pe,
    peTTM: record.peTTM,
    pb: record.pb,
    ps: record.ps,
    marketCap: record.marketCap,
    industry: stockInfo?.industry || '',
    region: stockInfo?.region || '',
    change3d: record.change3d,
    change5d: record.change5d,
    change10d: record.change10d,
    change20d: record.change20d,
    change60d: record.change60d,
    changeYear: record.changeYear,
    volumeRatio: record.volumeRatio,
    upDays: record.upDays,
    technicalSignal: record.technicalSignal,
    dist5ma: record.dist5ma,
    grossMargin: record.grossMargin,
    netMargin: record.netMargin,
    debtRatio: record.debtRatio,
    profitYoy: record.profitYoy,
    revenueYoy: record.revenueYoy,
    dividendYield: record.dividendYield
  };
}

/**
 * 将某日期的数据转换为 DayData 格式（兼容现有组件）
 */
export async function buildDayData(date: string): Promise<DayData | null> {
  console.log(`[DB] buildDayData: 开始加载日期 ${date}`);

  const [dateMeta, records] = await Promise.all([
    db.dateMetas.get(date),
    getStocksByDate(date)
  ]);

  console.log(`[DB] buildDayData: dateMeta =`, dateMeta);
  console.log(`[DB] buildDayData: records.length = ${records.length}`);

  if (!dateMeta) {
    console.warn(`[DB] buildDayData: 日期元数据不存在: ${date}`);
    return null;
  }

  if (records.length === 0) {
    console.warn(`[DB] buildDayData: 没有找到日期 ${date} 的股票记录`);
    return null;
  }

  // 获取所有股票的基础信息
  const codes = records.map(r => r.code);
  const stockInfos = await db.stocks.where('code').anyOf(codes).toArray();
  const stockInfoMap = new Map(stockInfos.map(s => [s.code, s]));

  // 按公式分组
  const groupMap = new Map<string, Stock[]>();
  const allStocks: Stock[] = [];

  for (const record of records) {
    const stockInfo = stockInfoMap.get(record.code);
    const stock = dailyRecordToStock(record, stockInfo);
    allStocks.push(stock);

    // 添加到对应的公式分组
    for (const formula of record.formulas) {
      const existing = groupMap.get(formula) || [];
      existing.push(stock);
      groupMap.set(formula, existing);
    }
  }

  // 构建分组列表
  const groups: StockGroup[] = Array.from(groupMap.entries()).map(([name, stocks]) => ({
    name,
    stocks
  }));

  // 构建大盘指数
  let index: Stock | undefined;
  if (dateMeta.indexCode) {
    index = {
      code: dateMeta.indexCode,
      name: dateMeta.indexName || '',
      price: dateMeta.indexPrice || 0,
      change: dateMeta.indexChange || 0,
      volume: 0,
      turnover: 0,
      amplitude: 0,
      pe: 0,
      marketCap: 0,
      industry: '',
      region: '',
      high: 0,
      low: 0,
      open: 0
    };
  }

  return {
    date,
    groups,
    allStocks,
    index
  };
}

// ==================== React Hooks ====================

/**
 * 主数据库 Hook
 */
export function useStockDB() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 实时监听日期列表变化
  const dates = useLiveQuery(() => getAllDates(), []);

  // 实时监听数据库统计
  const stats = useLiveQuery(() => getDBStats(), []);

  /**
   * 导入 Excel 文件
   */
  const importFiles = useCallback(async (files: FileList): Promise<{
    success: number;
    failed: number;
    details: Array<{ filename: string; result: string }>
  }> => {
    setIsLoading(true);
    setError(null);

    const details: Array<{ filename: string; result: string }> = [];
    let success = 0;
    let failed = 0;

    try {
      for (const file of Array.from(files)) {
        try {
          console.log(`[DB] 开始解析文件: ${file.name}`);
          // 使用现有的解析器解析文件
          const dayData = await parseExcelFile(file);
          console.log(`[DB] 解析完成: 日期=${dayData.date}, 股票数=${dayData.allStocks.length}, 分组数=${dayData.groups.length}`);

          // 准备导入数据
          const stocks = dayData.allStocks.map(stock => {
            // 找到这只股票属于哪些公式
            const formulas: string[] = [];
            for (const group of dayData.groups) {
              if (group.stocks.some(s => s.code === stock.code)) {
                formulas.push(group.name);
              }
            }

            return {
              ...stock,
              formulas
            };
          });

          console.log(`[DB] 准备导入 ${stocks.length} 只股票到日期 ${dayData.date}`);

          // 导入到数据库
          const result = await importStockData(
            dayData.date,
            stocks,
            dayData.index ? {
              code: dayData.index.code,
              name: dayData.index.name,
              price: dayData.index.price,
              change: dayData.index.change
            } : undefined
          );

          console.log(`[DB] 导入完成: ${result.imported} 新增, ${result.updated} 更新`);

          details.push({
            filename: file.name,
            result: `成功: ${result.imported} 新增, ${result.updated} 更新`
          });
          success++;
        } catch (e) {
          console.error(`[DB] 导入失败: ${file.name}`, e);
          details.push({
            filename: file.name,
            result: `失败: ${e instanceof Error ? e.message : '未知错误'}`
          });
          failed++;
        }
      }

      // 导入成功后自动备份
      if (success > 0) {
        console.log('[DB] 导入完成，创建自动备份...');
        await createBackup();
      }
    } catch (e) {
      console.error('[DB] 批量导入错误:', e);
      setError(e instanceof Error ? e.message : '导入失败');
    } finally {
      setIsLoading(false);
    }

    return { success, failed, details };
  }, []);

  /**
   * 删除某个日期的数据
   */
  const removeDateData = useCallback(async (date: string) => {
    setIsLoading(true);
    try {
      await deleteDate(date);
      // 删除后更新备份
      await createBackup();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 清空所有数据
   */
  const clearAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await clearAllData();
      // 清空后也清空备份
      await createBackup();
    } catch (e) {
      setError(e instanceof Error ? e.message : '清空失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 补充导入：将文件数据合并到指定日期（忽略文件中的日期）
   */
  const mergeFilesToDate = useCallback(async (files: FileList, targetDate: string): Promise<{
    success: number;
    failed: number;
    details: Array<{ filename: string; result: string }>
  }> => {
    setIsLoading(true);
    setError(null);

    const details: Array<{ filename: string; result: string }> = [];
    let success = 0;
    let failed = 0;

    try {
      for (const file of Array.from(files)) {
        try {
          console.log(`[DB] 补充导入: ${file.name} -> 目标日期 ${targetDate}`);
          // 使用现有的解析器解析文件
          const dayData = await parseExcelFile(file);
          console.log(`[DB] 解析完成: 原日期=${dayData.date}, 股票数=${dayData.allStocks.length}`);

          // 准备导入数据（使用目标日期，而不是文件中的日期）
          const stocks = dayData.allStocks.map(stock => {
            const formulas: string[] = [];
            for (const group of dayData.groups) {
              if (group.stocks.some(s => s.code === stock.code)) {
                formulas.push(group.name);
              }
            }
            return { ...stock, formulas };
          });

          // 导入到目标日期（强制使用 targetDate）
          const result = await importStockData(
            targetDate,  // 使用目标日期
            stocks,
            undefined    // 补充导入不更新大盘指数
          );

          console.log(`[DB] 补充完成: ${result.imported} 新增, ${result.updated} 更新`);

          details.push({
            filename: file.name,
            result: `成功: ${result.imported} 新增, ${result.updated} 更新 (合并到 ${targetDate})`
          });
          success++;
        } catch (e) {
          console.error(`[DB] 补充导入失败: ${file.name}`, e);
          details.push({
            filename: file.name,
            result: `失败: ${e instanceof Error ? e.message : '未知错误'}`
          });
          failed++;
        }
      }

      // 补充成功后自动备份
      if (success > 0) {
        console.log('[DB] 补充完成，创建自动备份...');
        await createBackup();
      }
    } catch (e) {
      console.error('[DB] 补充导入错误:', e);
      setError(e instanceof Error ? e.message : '补充导入失败');
    } finally {
      setIsLoading(false);
    }

    return { success, failed, details };
  }, []);

  return {
    dates: dates || [],
    stats,
    isLoading,
    error,
    importFiles,
    mergeFilesToDate,
    removeDateData,
    clearAll
  };
}

/**
 * 获取某日期数据的 Hook
 */
export function useDayData(date: string | null) {
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!date) {
      setDayData(null);
      return;
    }

    setIsLoading(true);
    buildDayData(date)
      .then(setDayData)
      .finally(() => setIsLoading(false));
  }, [date]);

  return { dayData, isLoading };
}

/**
 * 获取多只股票历史数据的 Hook（为 AI 分析优化）
 */
export function useStocksHistoryForAI(codes: string[], currentDate: string) {
  const [history, setHistory] = useState<Map<string, DailyRecord[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (codes.length === 0) {
      setHistory(new Map());
      return;
    }

    setIsLoading(true);
    getStocksHistory(codes)
      .then(result => {
        // 过滤掉当前日期的数据（只保留历史）
        const filtered = new Map<string, DailyRecord[]>();
        for (const [code, records] of result) {
          filtered.set(code, records.filter(r => r.date !== currentDate));
        }
        setHistory(filtered);
      })
      .finally(() => setIsLoading(false));
  }, [codes.join(','), currentDate]);

  return { history, isLoading };
}

/**
 * 格式化历史数据为 AI 提示词
 */
export function formatHistoryForAI(
  _code: string,
  history: DailyRecord[],
  currentRecord: DailyRecord
): string {
  if (history.length === 0) {
    return '首次出现，无历史记录';
  }

  const lines: string[] = [];

  // 计算与首次选中的价格变化
  const firstRecord = history[0];
  const priceChangeFromFirst = ((currentRecord.price - firstRecord.price) / firstRecord.price * 100).toFixed(2);

  lines.push(`距首次选中(${firstRecord.date})价格变化: ${Number(priceChangeFromFirst) >= 0 ? '+' : ''}${priceChangeFromFirst}%`);
  lines.push('历史记录:');

  for (const record of history) {
    lines.push(`  - ${record.date}: ¥${record.price.toFixed(2)}, ${record.change >= 0 ? '+' : ''}${record.change.toFixed(2)}%, 公式[${record.formulas.join(', ')}]`);
  }

  return lines.join('\n');
}
