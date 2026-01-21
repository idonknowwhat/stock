# -*- coding: utf-8 -*-
"""
通达信股票池分析工具
用于读取通达信导出的股票列表并进行分析
"""

import os
import pandas as pd
import numpy as np
from pathlib import Path


def read_tdx_export(file_path):
    """
    读取通达信导出的股票数据
    支持 CSV、TXT、XLS 格式
    """
    file_path = Path(file_path)
    
    if not file_path.exists():
        print(f"文件不存在: {file_path}")
        return None, None
    
    suffix = file_path.suffix.lower()
    stock_info = None
    
    try:
        if suffix == '.csv':
            for encoding in ['gbk', 'utf-8', 'gb2312']:
                try:
                    df = pd.read_csv(file_path, encoding=encoding)
                    print(f"成功读取 CSV 文件，编码: {encoding}")
                    return df, stock_info
                except UnicodeDecodeError:
                    continue
        
        elif suffix == '.txt':
            for encoding in ['gbk', 'utf-8', 'gb2312']:
                try:
                    df = pd.read_csv(file_path, sep='\t', encoding=encoding)
                    print(f"成功读取 TXT 文件，编码: {encoding}")
                    return df, stock_info
                except UnicodeDecodeError:
                    continue
        
        elif suffix in ['.xls', '.xlsx']:
            import re
            # 通达信导出的 xls 实际上是制表符分隔的文本文件
            try:
                with open(file_path, 'r', encoding='gbk') as f:
                    lines = f.readlines()
                
                # 第一行是股票名称
                first_line = lines[0].strip()
                match = re.search(r'([\u4e00-\u9fa5]+)\s*[\(（]([0-9]+)[\)）]', first_line)
                if match:
                    stock_info = {'name': match.group(1), 'code': match.group(2)}
                
                # 找到表头行（包含"时间"的行）
                header_idx = 0
                for i, line in enumerate(lines):
                    if '时间' in line:
                        header_idx = i
                        break
                
                # 使用制表符分隔读取
                df = pd.read_csv(file_path, sep='\t', encoding='gbk', 
                                skiprows=header_idx, skipinitialspace=True)
                
                # 清理列名中的空白
                df.columns = [str(c).strip() for c in df.columns]
                
                print(f"成功读取 XLS 文件 (制表符分隔)")
                return df, stock_info
            except Exception as e:
                print(f"制表符格式读取失败: {e}")
            
            # 尝试标准Excel格式
            try:
                df = pd.read_excel(file_path)
                print("成功读取 Excel 文件")
                return df, stock_info
            except:
                pass
            
    except Exception as e:
        print(f"读取文件出错: {e}")
        return None, None
    
    print("无法解析文件")
    return None, None


def clean_column_names(df):
    """
    清理和标准化列名
    """
    col_mapping = {
        '时间': 'date',
        '开盘': 'open',
        '最高': 'high',
        '最低': 'low',
        '收盘': 'close',
        '成交量': 'volume',
    }
    
    new_cols = []
    for col in df.columns:
        col_str = str(col).strip()
        if col_str in col_mapping:
            new_cols.append(col_mapping[col_str])
        else:
            new_cols.append(col_str)
    df.columns = new_cols
    return df


def analyze_kline(df, stock_info=None):
    """
    分析K线数据
    """
    if df is None or df.empty:
        print("没有数据可分析")
        return None
    
    # 清理列名
    df = clean_column_names(df)
    
    # 删除全空行
    df = df.dropna(how='all')
    
    print("\n" + "=" * 60)
    if stock_info:
        print(f"📊 {stock_info['name']} ({stock_info['code']}) K线分析")
    else:
        print("📊 K线数据分析")
    print("=" * 60)
    
    print(f"\n📌 数据条数: {len(df)} 条")
    
    # 识别基本列
    if 'date' in df.columns:
        print(f"📅 时间范围: {df['date'].iloc[0]} ~ {df['date'].iloc[-1]}")
    
    # 价格分析
    if 'close' in df.columns:
        close = pd.to_numeric(df['close'], errors='coerce')
        print(f"\n💰 价格统计:")
        print(f"   最新收盘: {close.iloc[-1]:.2f}")
        print(f"   最高价格: {close.max():.2f}")
        print(f"   最低价格: {close.min():.2f}")
        print(f"   平均价格: {close.mean():.2f}")
        
        # 计算涨跌幅
        if len(close) > 1:
            total_change = (close.iloc[-1] - close.iloc[0]) / close.iloc[0] * 100
            print(f"   区间涨跌: {total_change:+.2f}%")
    
    # 成交量分析
    if 'volume' in df.columns:
        vol = pd.to_numeric(df['volume'], errors='coerce')
        print(f"\n📊 成交量统计:")
        print(f"   平均成交: {vol.mean()/10000:.2f} 万")
        print(f"   最大成交: {vol.max()/10000:.2f} 万")
    
    # MACD分析
    macd_cols = [c for c in df.columns if 'MACD' in str(c).upper()]
    if macd_cols:
        print(f"\n📈 MACD指标 (最新):")
        for col in macd_cols:
            val = pd.to_numeric(df[col], errors='coerce').iloc[-1]
            if not pd.isna(val):
                print(f"   {col}: {val:.4f}")
    
    print(f"\n📋 所有列: {list(df.columns)}")
    
    return df


def export_filtered(df, output_path, condition=None):
    """
    根据条件筛选并导出
    """
    if condition:
        filtered_df = df.query(condition)
    else:
        filtered_df = df
    
    filtered_df.to_csv(output_path, index=False, encoding='utf-8-sig')
    print(f"已导出 {len(filtered_df)} 条数据到: {output_path}")
    return filtered_df


def read_stock_list(file_path):
    """
    读取通达信导出的自选股列表
    """
    file_path = Path(file_path)
    
    try:
        with open(file_path, 'r', encoding='gbk') as f:
            lines = f.readlines()
        
        # 使用制表符分隔读取
        df = pd.read_csv(file_path, sep='\t', encoding='gbk', skipinitialspace=True)
        
        # 清理列名
        df.columns = [str(c).strip() for c in df.columns]
        
        # 清理代码列（去掉="）
        if '代码' in df.columns:
            df['代码'] = df['代码'].astype(str).str.replace('="', '').str.replace('"', '')
        
        # 过滤掉注释行
        df = df[~df.iloc[:, 0].astype(str).str.startswith('#')]
        
        print(f"成功读取自选股列表")
        return df
    except Exception as e:
        print(f"读取失败: {e}")
        return None


def analyze_stock_list(df):
    """
    分析自选股列表（支持分组标记）
    """
    if df is None or df.empty:
        print("没有数据")
        return
    
    # 识别分组标记行和股票行
    groups = {}
    current_group = "未分类"
    
    for idx, row in df.iterrows():
        code = str(row.get('代码', '')).strip()
        name = str(row.get('名称', '')).strip()
        
        # 判断是否为分组标记行（代码列是中文或特殊标记）
        if not code or not code[0].isdigit():
            # 这是分组标记行
            group_name = code if code else name
            if group_name and '重复' not in group_name and '数据来源' not in group_name:
                current_group = group_name
                if current_group not in groups:
                    groups[current_group] = []
        else:
            # 这是股票行
            if current_group not in groups:
                groups[current_group] = []
            groups[current_group].append(row)
    
    # 转换为DataFrame
    group_dfs = {}
    for g, rows in groups.items():
        if rows:
            group_dfs[g] = pd.DataFrame(rows)
    
    # 分离大盘指数
    all_stocks = pd.concat(group_dfs.values()) if group_dfs else df
    index_df = all_stocks[all_stocks['代码'].astype(str).str.startswith('99')]
    
    # 统计重复股票
    all_codes = []
    for g, gdf in group_dfs.items():
        codes = gdf[~gdf['代码'].astype(str).str.startswith('99')]['代码'].tolist()
        all_codes.extend([(c, g) for c in codes])
    
    from collections import Counter
    code_counts = Counter([c for c, g in all_codes])
    duplicates = {c: [] for c, cnt in code_counts.items() if cnt > 1}
    for c, g in all_codes:
        if c in duplicates:
            duplicates[c].append(g)
    
    # 合并所有个股并去重
    stock_df = all_stocks[~all_stocks['代码'].astype(str).str.startswith('99')]
    stock_df = stock_df.drop_duplicates(subset=['代码'])
    
    print("\n" + "=" * 60)
    print("📊 自选股池分析")
    print("=" * 60)
    
    # ===== 大盘指数单独分析 =====
    if not index_df.empty:
        print("\n" + "─" * 40)
        print("📈 【大盘指数】")
        print("─" * 40)
        for _, row in index_df.iterrows():
            name = row.get('名称', '')
            price = row.get('现价', 0)
            change = row.get('涨幅%', 0)
            try:
                print(f"   {name}: {price}  ({float(change):+.2f}%)")
            except:
                print(f"   {name}: {price}")
    
    # ===== 重复股票（多重信号）=====
    if duplicates:
        print("\n" + "─" * 40)
        print("⭐ 【多重信号股票】被多个公式同时选中")
        print("─" * 40)
        for code, grps in duplicates.items():
            stock_row = stock_df[stock_df['代码'] == code]
            if not stock_row.empty:
                name = stock_row.iloc[0].get('名称', '')
                print(f"   🔥 {name} ({code})")
                print(f"      出现在: {' + '.join(grps)}")
    
    # ===== 按公式分组显示 =====
    print("\n" + "─" * 40)
    print("📋 【按公式分组】")
    print("─" * 40)
    
    for group_name, gdf in group_dfs.items():
        # 过滤掉指数
        gdf_stocks = gdf[~gdf['代码'].astype(str).str.startswith('99')]
        if gdf_stocks.empty:
            continue
            
        print(f"\n▶ {group_name} ({len(gdf_stocks)}只)")
        
        # 按涨幅排序
        if '涨幅%' in gdf_stocks.columns:
            gdf_stocks = gdf_stocks.copy()
            gdf_stocks['涨幅%'] = pd.to_numeric(gdf_stocks['涨幅%'], errors='coerce')
            gdf_stocks = gdf_stocks.sort_values('涨幅%', ascending=False)
        
        for _, row in gdf_stocks.iterrows():
            code = str(row.get('代码', ''))
            name = str(row.get('名称', ''))
            change = row.get('涨幅%', 0)
            dup_mark = " ⭐" if code in duplicates else ""
            try:
                print(f"   {name}: {float(change):+.2f}%{dup_mark}")
            except:
                print(f"   {name}{dup_mark}")
    
    # ===== 汇总统计 =====
    print("\n" + "─" * 40)
    print(f"📊 【汇总统计】共 {len(stock_df)} 只（已去重）")
    print("─" * 40)
    
    # 统计信息
    print("\n" + "─" * 40)
    print("📊 【统计信息】")
    print("─" * 40)
    
    if '涨幅%' in stock_df.columns:
        changes = pd.to_numeric(stock_df['涨幅%'], errors='coerce')
        up_count = (changes > 0).sum()
        down_count = (changes < 0).sum()
        flat_count = (changes == 0).sum()
        print(f"   上涨: {up_count} 只  |  下跌: {down_count} 只  |  平盘: {flat_count} 只")
        print(f"   最大涨幅: {changes.max():+.2f}%  |  最大跌幅: {changes.min():+.2f}%")
        print(f"   平均涨幅: {changes.mean():+.2f}%")
    
    # 涨幅榜
    print("\n🔥 涨幅前5:")
    for _, row in stock_df.head(5).iterrows():
        print(f"   {row.get('名称', '')}: {row.get('涨幅%', 0):+.2f}%")
    
    print("\n❄️ 跌幅前5:")
    for _, row in stock_df.tail(5).iloc[::-1].iterrows():
        print(f"   {row.get('名称', '')}: {row.get('涨幅%', 0):+.2f}%")
    
    return stock_df, index_df


def is_stock_list(file_path):
    """判断是否为自选股列表格式"""
    try:
        with open(file_path, 'r', encoding='gbk') as f:
            first_line = f.readline()
            return '代码' in first_line and '名称' in first_line
    except:
        return False


# ============ 使用示例 ============

if __name__ == "__main__":
    print("=" * 60)
    print("通达信股票数据分析工具")
    print("=" * 60)
    
    export_dir = Path(__file__).parent
    
    # 查找目录下的数据文件（排除配置文件）
    data_files = [f for f in export_dir.glob("*.csv") if 'requirements' not in f.name.lower()] + \
                 list(export_dir.glob("*.xls*"))
    
    if not data_files:
        print("\n⚠️ 未找到数据文件！")
        print("\n请从通达信导出数据后放到此目录。")
    else:
        print(f"\n找到 {len(data_files)} 个数据文件:")
        for i, f in enumerate(data_files, 1):
            print(f"  {i}. {f.name}")
        
        # 分析所有文件
        for file_path in data_files:
            print(f"\n{'━' * 60}")
            print(f"📁 文件: {file_path.name}")
            print(f"{'━' * 60}")
            
            # 判断文件类型
            if is_stock_list(file_path):
                # 自选股列表格式
                df = read_stock_list(file_path)
                if df is not None:
                    analyze_stock_list(df)
            else:
                # K线数据格式
                df, stock_info = read_tdx_export(file_path)
                if df is not None:
                    analyze_kline(df, stock_info)
