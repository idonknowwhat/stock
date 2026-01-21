import { useState, useEffect } from 'react';
import { X, Settings, RefreshCw, Check, Loader2, Key, Globe, Bot } from 'lucide-react';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  selectedModel: string;
  models: string[];
}

const SETTINGS_KEY = 'stock-analyzer-settings';

export function loadSettings(): ApiConfig {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('加载设置失败:', e);
  }
  return {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    selectedModel: '',
    models: [],
  };
}

export function saveSettings(config: ApiConfig) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(config));
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [config, setConfig] = useState<ApiConfig>(loadSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setConfig(loadSettings());
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  const fetchModels = async () => {
    if (!config.baseUrl || !config.apiKey) {
      setError('请先填写 API 地址和 Key');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${config.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const modelList = data.data?.map((m: { id: string }) => m.id) || [];
      
      // 过滤出常用的聊天模型
      const chatModels = modelList.filter((m: string) => 
        m.includes('gpt') || m.includes('claude') || m.includes('chat') || 
        m.includes('qwen') || m.includes('deepseek') || m.includes('glm')
      ).sort();

      setConfig(prev => ({
        ...prev,
        models: chatModels.length > 0 ? chatModels : modelList.slice(0, 20),
        selectedModel: chatModels[0] || modelList[0] || '',
      }));
      setSuccess(`成功获取 ${chatModels.length || modelList.length} 个模型`);
    } catch (e) {
      setError(`获取模型失败: ${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    saveSettings(config);
    setSuccess('设置已保存');
    setTimeout(() => onClose(), 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">AI 分析设置</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-6 space-y-5">
          {/* API 地址 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Globe className="w-4 h-4" />
              API 地址
            </label>
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
              placeholder="https://api.openai.com/v1"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              支持 OpenAI、DeepSeek、智谱等兼容接口
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Key className="w-4 h-4" />
              API Key
            </label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="sk-..."
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* 模型选择 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Bot className="w-4 h-4" />
              选择模型
            </label>
            <div className="flex gap-2">
              <select
                value={config.selectedModel}
                onChange={(e) => setConfig(prev => ({ ...prev, selectedModel: e.target.value }))}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                {config.models.length === 0 ? (
                  <option value="">点击刷新获取模型列表</option>
                ) : (
                  config.models.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))
                )}
              </select>
              <button
                onClick={fetchModels}
                disabled={isLoading}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
                ) : (
                  <RefreshCw className="w-5 h-5 text-slate-600" />
                )}
              </button>
            </div>
          </div>

          {/* 错误/成功提示 */}
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
              <Check className="w-4 h-4" />
              {success}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}
