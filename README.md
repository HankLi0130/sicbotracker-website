# 骰寶客官方網站

骰寶客 (SicBoTracker) 官方網站的原始碼。

## 網站結構

```
sicbotracker-website/
├── index.html          # 首頁（歡迎頁面 + 下載連結）
├── tutorial.html       # 新手教學
├── announcement.html   # 未來規劃公告（功能分級 + FAQ）
├── share.html          # 12 小時即時分享 viewer
├── privacy.html        # 隱私權政策
├── css/
│   ├── style.css       # 共用深色主題樣式表
│   └── share.css       # Viewer responsive 樣式
├── js/
│   ├── live-share-core.mjs    # Schema parser 與骰寶分析
│   └── live-share-viewer.mjs  # Firebase RTDB listener 與畫面更新
├── tests/              # Parser／analyzer deterministic tests
├── images/
│   ├── logo.png        # App Logo
│   └── screenshots/    # 應用程式截圖
└── README.md
```

## 本地開發

首頁等靜態頁可直接用瀏覽器開啟。即時分享頁使用 JavaScript module，請啟動本地伺服器：

```bash
# macOS
open index.html

# 或使用 Python 啟動本地伺服器
python3 -m http.server 8000
# 然後開啟 http://localhost:8000
```

執行 parser 與 analyzer tests（需要 Node.js 20+）：

```bash
npm test
```

## 即時分享 Viewer

Android App 可建立格式為 `share.html?s={shareId}` 的公開連結。Viewer 只監聽該
share ID 對應的 Firebase Realtime Database child，不會列舉其他分享，也不會顯示
建立者的帳號識別碼。

- 遠端內容是 App 目前本機骰寶清單的暫時 projection，包含骰子點數、紀錄 ID 與時間
- 連結最長有效 12 小時；持有連結的任何人都能在有效期間匿名查看
- 停止分享、登出或刪除帳號時，App 會先嘗試移除遠端內容
- 若裝置長期離線、App 被強制移除或 cleanup 持續失敗，過期 node 可能暫時殘留；
  RTDB Rules 仍會拒絕過期 viewer 存取
- 首個有效 snapshot 只記錄一次 `live_share_view_opened` Analytics event；Analytics
  使用不含 query 或 fragment 的 `share.html` page location，不附帶 bearer share ID、
  UID、紀錄時間或骰子內容

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
