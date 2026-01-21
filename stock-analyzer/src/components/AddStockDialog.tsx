import { useState } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import type { Stock } from '../types';

interface AddStockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (stock: Stock) => void;
}

export function AddStockDialog({ isOpen, onClose, onAdd }: AddStockDialogProps) {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    price: '',
    change: '',
    volume: '',
    turnover: '',
    amplitude: '',
    industry: '',
    region: '',
    pe: '',
    marketCap: '',
    high: '',
    low: '',
    open: '',
  });

  const [error, setError] = useState('');

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = () => {
    // 验证必填字段
    if (!formData.code || !formData.name) {
      setError('股票代码和名称为必填项');
      return;
    }

    // 验证股票代码格式
    if (!/^\d{6}$/.test(formData.code)) {
      setError('股票代码必须是6位数字');
      return;
    }

    // 转换数据类型
    const stock: Stock = {
      code: formData.code,
      name: formData.name,
      price: parseFloat(formData.price) || 0,
      change: parseFloat(formData.change) || 0,
      volume: parseFloat(formData.volume) || 0,
      turnover: parseFloat(formData.turnover) || 0,
      amplitude: parseFloat(formData.amplitude) || 0,
      industry: formData.industry || '未知',
      region: formData.region || '未知',
      pe: parseFloat(formData.pe) || 0,
      marketCap: parseFloat(formData.marketCap) || 0,
      high: parseFloat(formData.high) || parseFloat(formData.price) || 0,
      low: parseFloat(formData.low) || parseFloat(formData.price) || 0,
      open: parseFloat(formData.open) || parseFloat(formData.price) || 0,
    };

    onAdd(stock);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setFormData({
      code: '',
      name: '',
      price: '',
      change: '',
      volume: '',
      turnover: '',
      amplitude: '',
      industry: '',
      region: '',
      pe: '',
      marketCap: '',
      high: '',
      low: '',
      open: '',
    });
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">添加股票</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* 表单内容 */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            {/* 股票代码 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                股票代码 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => handleInputChange('code', e.target.value)}
                placeholder="例如：000001"
                maxLength={6}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* 股票名称 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                股票名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="例如：平安银行"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* 现价 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                现价 (元)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => handleInputChange('price', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* 涨跌幅 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                涨跌幅 (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.change}
                onChange={(e) => handleInputChange('change', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* 成交量 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                成交量 (手)
              </label>
              <input
                type="number"
                value={formData.volume}
                onChange={(e) => handleInputChange('volume', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* 换手率 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                换手率 (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.turnover}
                onChange={(e) => handleInputChange('turnover', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* 振幅 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                振幅 (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amplitude}
                onChange={(e) => handleInputChange('amplitude', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* 市盈率 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                市盈率
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.pe}
                onChange={(e) => handleInputChange('pe', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* 流通市值 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                流通市值 (亿)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.marketCap}
                onChange={(e) => handleInputChange('marketCap', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* 最高价 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                最高价 (元)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.high}
                onChange={(e) => handleInputChange('high', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* 最低价 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                最低价 (元)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.low}
                onChange={(e) => handleInputChange('low', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* 开盘价 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                开盘价 (元)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.open}
                onChange={(e) => handleInputChange('open', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* 行业 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                行业
              </label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => handleInputChange('industry', e.target.value)}
                placeholder="例如：银行"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* 地区 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                地区
              </label>
              <input
                type="text"
                value={formData.region}
                onChange={(e) => handleInputChange('region', e.target.value)}
                placeholder="例如：广东"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* 提示信息 */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <p className="font-medium mb-1">填写说明：</p>
            <ul className="list-disc list-inside space-y-1">
              <li>带 <span className="text-red-500">*</span> 的为必填项</li>
              <li>其他字段可选填，未填写将使用默认值</li>
              <li>如未填写最高/最低/开盘价，将自动使用现价</li>
            </ul>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl shrink-0">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            重置
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加股票
          </button>
        </div>
      </div>
    </div>
  );
}
