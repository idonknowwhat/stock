import { useState, useCallback, useEffect } from 'react';
import { BarChart3, Upload, Calendar, TrendingUp, Star, Trash2, Settings, Plus, PlusCircle, Database, Loader2 } from 'lucide-react';
import type { DayData, Stock } from './types';
import { analyzeStocks, findMultiFormulaStocks, calculateStockRankings } from './utils/excelParser';
import { FileUploader } from './components/FileUploader';
import { StatsCard } from './components/StatsCard';
import { StockTable } from './components/StockTable';
import { FormulaGroup } from './components/FormulaGroup';
import { FormulaPerformanceChart, IndustryDistributionChart, ChangeDistributionChart } from './components/Charts';
import { MultiDayComparison } from './components/MultiDayComparison';
import { StockRankingList } from './components/StockRanking';
import { SettingsDialog } from './components/SettingsDialog';
import { AddStockDialog } from './components/AddStockDialog';
import { DateSelector } from './components/DateSelector';
import { Trophy } from 'lucide-react';

// 数据库相关
import { useStockDB, useDayData, buildDayData } from './db/hooks';
import { initializeDB } from './db/migration';
import { importStockData } from './db/index';

type TabType = 'overview' | 'ranking' | 'formulas' | 'comparison' | 'table';

function App() {
  // 数据库 Hook
  const { dates, stats, isLoading: dbLoading, importFiles, mergeFilesToDate, removeDateData, clearAll } = useStockDB();

  // 应用状态
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedDay, setSelectedDay] = useState<string | null>(() => {
    return localStorage.getItem('stock-analyzer-selected-day');
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);

  // 当前日期数据
  const { dayData: currentDayData, isLoading: dayDataLoading } = useDayData(selectedDay);

  // 所有日期的数据（用于多日对比和AI分析）
  const [allDayData, setAllDayData] = useState<DayData[]>([]);

  // 初始化数据库
  useEffect(() => {
    initializeDB().then(result => {
      if (result.ready) {
        setIsInitialized(true);
        if (result.migrated) {
          console.log(`数据迁移完成: ${result.migratedDays} 天, ${result.migratedStocks} 条记录`);
        }
        if (result.restored) {
          console.log(`数据自动恢复: ${result.restoredDays} 天, ${result.restoredRecords} 条记录`);
        }
      } else {
        setInitError(result.error || '数据库初始化失败');
      }
    });
  }, []);

  // 自动选择最新日期，或当选中日期不存在时切换到有效日期
  useEffect(() => {
    if (dates.length > 0) {
      // 检查当前选中的日期是否存在于数据库中
      const selectedExists = selectedDay && dates.some(d => d.date === selectedDay);

      if (!selectedExists) {
        // 如果选中的日期不存在，自动选择最新的日期
        console.log(`[App] 选中的日期 ${selectedDay} 不存在，自动切换到 ${dates[0].date}`);
        setSelectedDay(dates[0].date);
      }
    }
  }, [dates, selectedDay]);

  // 保存选中的日期
  useEffect(() => {
    if (selectedDay) {
      localStorage.setItem('stock-analyzer-selected-day', selectedDay);
    }
  }, [selectedDay]);

  // 加载所有日期数据（用于多日对比）
  useEffect(() => {
    if (dates.length === 0) {
      setAllDayData([]);
      return;
    }

    Promise.all(dates.map(d => buildDayData(d.date)))
      .then(results => {
        setAllDayData(results.filter((d): d is DayData => d !== null));
      });
  }, [dates]);

  // 处理文件选择
  const handleFilesSelected = useCallback(async (files: FileList) => {
    setIsLoading(true);
    try {
      const result = await importFiles(files);
      if (result.success > 0 && dates.length === 0) {
        // 如果是首次导入，等待dates更新后自动选择
      }
      console.log('导入结果:', result);
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败，请确保是通达信导出的Excel格式');
    } finally {
      setIsLoading(false);
    }
  }, [importFiles, dates.length]);

  // 删除某天数据
  const handleRemoveDay = useCallback(async (date: string) => {
    await removeDateData(date);
    if (selectedDay === date) {
      const remaining = dates.filter(d => d.date !== date);
      setSelectedDay(remaining.length > 0 ? remaining[0].date : null);
    }
  }, [removeDateData, selectedDay, dates]);

  // 清空所有数据
  const handleClearAll = useCallback(async () => {
    if (confirm('确定要清空所有数据吗？此操作不可恢复。')) {
      await clearAll();
      setSelectedDay(null);
    }
  }, [clearAll]);

  // 补充导入：将新数据合并到当前选中日期（忽略文件中的日期）
  const handleMergeFiles = useCallback(async (files: FileList) => {
    if (!selectedDay) {
      alert('请先选择要补充的日期');
      return;
    }

    setIsLoading(true);
    try {
      // 使用 mergeFilesToDate，强制合并到选中的日期
      const result = await mergeFilesToDate(files, selectedDay);
      console.log('补充导入结果:', result);
      if (result.success > 0) {
        alert(`补充成功：${result.details.map(d => d.result).join('\n')}`);
      }
    } catch (error) {
      console.error('补充导入失败:', error);
      alert('补充导入失败');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDay, mergeFilesToDate]);

  // 添加单个股票
  const handleAddStock = useCallback(async (stock: Stock) => {
    const targetDate = selectedDay || new Date().toISOString().split('T')[0].replace(/-/g, '');

    try {
      await importStockData(targetDate, [{
        ...stock,
        formulas: ['手动添加']
      }]);

      if (!selectedDay) {
        setSelectedDay(targetDate);
      }
    } catch (error) {
      console.error('添加股票失败:', error);
      alert('添加股票失败');
    }
  }, [selectedDay]);

  // 计算统计数据
  const statsData = currentDayData ? analyzeStocks(currentDayData.allStocks) : null;
  const multiFormulaStocks = currentDayData ? findMultiFormulaStocks(currentDayData) : new Map();
  const rankings = currentDayData ? calculateStockRankings(currentDayData) : [];

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: '数据概览', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'ranking', label: '潜力排行', icon: <Trophy className="w-4 h-4" /> },
    { id: 'formulas', label: '公式分组', icon: <Star className="w-4 h-4" /> },
    { id: 'comparison', label: '多日对比', icon: <Calendar className="w-4 h-4" /> },
    { id: 'table', label: '股票列表', icon: <TrendingUp className="w-4 h-4" /> },
  ];

  // 显示初始化错误
  if (initError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <Database className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">数据库初始化失败</h2>
          <p className="text-slate-600 mb-4">{initError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // 显示加载状态
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">正在初始化数据库...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">通达信股票分析器</h1>
                <p className="text-xs text-slate-500">
                  导入自选股，智能分析潜力标的
                  {stats && (
                    <span className="ml-2 text-blue-600">
                      | DB: {stats.stockCount}只股票, {stats.recordCount}条记录
                    </span>
                  )}
                </p>
              </div>
            </div>

            {dates.length > 0 && (
              <div className="flex items-center gap-2">
                {/* 添加单个股票 */}
                <button
                  onClick={() => setShowAddStock(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <PlusCircle className="w-4 h-4" />
                  添加股票
                </button>

                {/* 添加新日期数据 */}
                <label className="relative cursor-pointer">
                  <input
                    type="file"
                    accept=".xls,.xlsx,.csv"
                    multiple
                    onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
                    className="hidden"
                  />
                  <span className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                    <Upload className="w-4 h-4" />
                    添加数据
                  </span>
                </label>

                {/* 补充导入到当前日期 */}
                <label className="relative cursor-pointer">
                  <input
                    type="file"
                    accept=".xls,.xlsx,.csv"
                    multiple
                    onChange={(e) => e.target.files && handleMergeFiles(e.target.files)}
                    className="hidden"
                  />
                  <span className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors">
                    <Plus className="w-4 h-4" />
                    补充
                  </span>
                </label>

                {/* 设置 */}
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* 清空 */}
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  清空
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {dates.length === 0 ? (
          /* 空状态 - 上传区域 */
          <div className="max-w-2xl mx-auto mt-20">
            <FileUploader onFilesSelected={handleFilesSelected} isLoading={isLoading || dbLoading} />
            <div className="mt-8 text-center">
              <h2 className="text-lg font-semibold text-slate-700 mb-3">使用说明</h2>
              <ol className="text-sm text-slate-500 space-y-2 text-left max-w-md mx-auto">
                <li>1. 在通达信中执行选股公式或打开自选股</li>
                <li>2. 右键 → 数据导出 → 导出所有数据 → 保存为 Excel</li>
                <li>3. 在导出的文件中添加公式分组标记（可选）</li>
                <li>4. 将文件拖放到上方区域或点击上传</li>
                <li>5. 可上传多日数据进行连续性分析</li>
              </ol>
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <Database className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-blue-700">
                  数据将存储在本地 IndexedDB 数据库中，支持大容量存储和快速查询
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* 数据展示区域 */
          <div className="space-y-6">
            {/* 日期选择器 */}
            <DateSelector
              dates={dates}
              selectedDate={selectedDay}
              onSelectDate={setSelectedDay}
              onRemoveDate={handleRemoveDay}
            />

            {/* 加载状态 */}
            {dayDataLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <span className="ml-3 text-slate-600">加载数据中...</span>
              </div>
            )}

            {/* 数据加载失败/为空的状态 */}
            {!dayDataLoading && !currentDayData && selectedDay && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                <Database className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-amber-800 mb-2">
                  未找到日期 {selectedDay} 的数据
                </h3>
                <p className="text-amber-700 text-sm mb-4">
                  数据库中没有该日期的股票记录。请检查浏览器控制台(F12)查看详细错误信息。
                </p>
                <div className="text-xs text-amber-600 bg-amber-100 rounded-lg p-3 text-left">
                  <p className="font-medium mb-1">可能的原因：</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>数据导入过程中出错</li>
                    <li>IndexedDB 数据库损坏</li>
                    <li>浏览器隐私模式可能不支持 IndexedDB</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Tab 导航 */}
            {currentDayData && !dayDataLoading && (
              <>
                <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab 内容 */}
                {activeTab === 'overview' && statsData && (
                  <div className="space-y-6">
                    {/* 大盘指数 */}
                    {currentDayData.index && (
                      <div className={`rounded-xl p-4 border ${
                        currentDayData.index.change >= 0
                          ? 'bg-red-50 border-red-200'
                          : 'bg-green-50 border-green-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm opacity-70">大盘指数</p>
                            <p className="text-2xl font-bold">{currentDayData.index.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-bold">{currentDayData.index.price.toFixed(2)}</p>
                            <p className={`text-lg font-medium ${
                              currentDayData.index.change >= 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {currentDayData.index.change >= 0 ? '+' : ''}{currentDayData.index.change.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 统计卡片 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatsCard
                        title="股票总数"
                        value={currentDayData.allStocks.length}
                        subtitle={`${currentDayData.groups.length}个公式`}
                        type="info"
                        icon="users"
                      />
                      <StatsCard
                        title="上涨股票"
                        value={statsData.upCount}
                        subtitle={`占比 ${((statsData.upCount / currentDayData.allStocks.length) * 100).toFixed(0)}%`}
                        type="up"
                        icon="trending-up"
                      />
                      <StatsCard
                        title="下跌股票"
                        value={statsData.downCount}
                        subtitle={`占比 ${((statsData.downCount / currentDayData.allStocks.length) * 100).toFixed(0)}%`}
                        type="down"
                        icon="trending-down"
                      />
                      <StatsCard
                        title="平均涨幅"
                        value={`${statsData.avgChange >= 0 ? '+' : ''}${statsData.avgChange.toFixed(2)}%`}
                        subtitle={`最高 ${statsData.maxChange.toFixed(2)}%`}
                        type={statsData.avgChange >= 0 ? 'up' : 'down'}
                        icon="chart"
                      />
                    </div>

                    {/* 多重信号股票 */}
                    {multiFormulaStocks.size > 0 && (
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4">
                        <h3 className="text-lg font-semibold text-amber-800 flex items-center gap-2 mb-3">
                          <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                          多重信号股票 ({multiFormulaStocks.size}只)
                        </h3>
                        <p className="text-sm text-amber-700 mb-3">这些股票被多个选股公式同时选中，信号更强</p>
                        <div className="flex flex-wrap gap-2">
                          {Array.from(multiFormulaStocks.entries()).map(([code, formulas]) => {
                            const stock = currentDayData.allStocks.find(s => s.code === code);
                            return (
                              <div key={code} className="bg-white rounded-lg px-3 py-2 border border-amber-200">
                                <div className="font-medium text-slate-800">{stock?.name}</div>
                                <div className="text-xs text-slate-500">{formulas.join(' + ')}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 图表 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <FormulaPerformanceChart groups={currentDayData.groups} />
                      <ChangeDistributionChart stocks={currentDayData.allStocks} />
                    </div>
                    <IndustryDistributionChart stocks={currentDayData.allStocks} />
                  </div>
                )}

                {activeTab === 'ranking' && (
                  <StockRankingList
                    rankings={rankings}
                    currentDate={selectedDay || ''}
                  />
                )}

                {activeTab === 'formulas' && (
                  <div className="space-y-4">
                    {currentDayData.groups.map(group => (
                      <FormulaGroup
                        key={group.name}
                        name={group.name}
                        stocks={group.stocks}
                        multiFormulaStocks={multiFormulaStocks}
                      />
                    ))}
                  </div>
                )}

                {activeTab === 'comparison' && (
                  <MultiDayComparison dayDataList={allDayData} />
                )}

                {activeTab === 'table' && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <StockTable
                      stocks={currentDayData.allStocks}
                      multiFormulaStocks={multiFormulaStocks}
                      title="全部股票"
                      showRank
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* 页脚 */}
      <footer className="border-t border-slate-200 mt-12 py-6 text-center text-sm text-slate-500">
        <p>通达信股票分析器 - 导入自选股数据进行智能分析</p>
        <p className="mt-1">支持多日数据对比，追踪连续上榜的潜力股票</p>
        {stats && (
          <p className="mt-2 text-xs text-slate-400">
            数据库: {stats.dateCount}个日期 | {stats.stockCount}只股票 | {stats.recordCount}条记录
            {stats.oldestDate && stats.newestDate && (
              <span> | {stats.oldestDate} ~ {stats.newestDate}</span>
            )}
          </p>
        )}
      </footer>

      {/* 设置对话框 */}
      <SettingsDialog isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* 添加股票对话框 */}
      <AddStockDialog
        isOpen={showAddStock}
        onClose={() => setShowAddStock(false)}
        onAdd={handleAddStock}
      />
    </div>
  );
}

export default App;
