# 房貸與資產成長試算 (Home Loan Calculator)

一個純前端（HTML/CSS/JS）的房貸與資產成長試算工具，可部署於 GitHub Pages。

## 功能

1. **房貸基本計算**：輸入貸款金額、年利率、貸款年限與還款方式（本息平均攤還 / 本金平均攤還），計算月付金、總繳金額與總利息。
2. **現有資產**：填入現有現金與現有股票市值。
3. **每月投入與成長率假設**：
   - 每月現金存款、現金年化成長率
   - 每月定期定額投入股票、股票年化成長率
   - 試算年限
4. **試算結果**：以圖表與逐年明細表呈現房貸剩餘、累積現金、累積股票與淨資產隨時間的變化。

## 本機預覽

直接用瀏覽器開啟 [index.html](index.html) 即可，無需安裝任何套件。

## 部署到 GitHub Pages

### 方式一：GitHub Actions（已內建）

本專案已包含 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)，推送到 `main` 分支後會自動建置並部署。

1. 到 GitHub repository 的 **Settings > Pages**
2. Source 選擇 **GitHub Actions**
3. Push 到 `main` 分支即可自動部署

### 方式二：直接使用分支部署

1. 到 **Settings > Pages**
2. Source 選擇 `Deploy from a branch`，選擇 `main` 分支、`/ (root)` 目錄
3. 儲存後等待數分鐘即可透過 GitHub Pages 網址存取

## 檔案結構

```
index.html   # 主頁面
style.css    # 樣式
script.js    # 計算邏輯（房貸攤還、資產成長模擬、圖表渲染）
```

> 本工具僅供試算參考，實際貸款與投資結果請以銀行與市場實際狀況為準。
