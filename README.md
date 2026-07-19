# 骰寶客官方網站

骰寶客 (SicBoTracker) 官方網站的原始碼。

## 網站結構

```
sicbotracker-website/
├── index.html          # 首頁（歡迎頁面 + 下載連結）
├── tutorial.html       # 新手教學
├── announcement.html   # 未來規劃公告（功能分級 + FAQ）
├── privacy.html        # 隱私權政策
├── css/
│   └── style.css       # 深色主題樣式表
├── images/
│   ├── logo.png        # App Logo
│   └── screenshots/    # 應用程式截圖
└── README.md
```

## 本地開發

直接用瀏覽器開啟 HTML 檔案即可預覽：

```bash
# macOS
open index.html

# 或使用 Python 啟動本地伺服器
python3 -m http.server 8000
# 然後開啟 http://localhost:8000
```

## 部署

此網站設計為透過 GitHub Pages 部署：

1. 前往 Repository Settings > Pages
2. Source 選擇 "Deploy from a branch"
3. Branch 選擇 "main" 和 "/ (root)"
4. 儲存後等待部署完成

部署後網址：`https://hankli0130.github.io/sicbotracker-website/`

## 相關連結

- [骰寶客 Android App](https://github.com/HankLi0130/SicBoTracker)
- [Google Play 商店](https://play.google.com/store/apps/details?id=app.hankdev.sicbotracker)

## 授權

Copyright © 2026 骰寶客 SicBoTracker
