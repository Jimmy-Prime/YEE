#YEE

一個用 nodejs 寫的 messenger bot。
credit: [facebook-chat-api](https://github.com/Schmavery/facebook-chat-api)

#安裝
可以直接跟[我的分身](https://www.facebook.com/profile.php?id=100014700733601&fref=ts)傳訊息

還是你想要裝自己的

1. clone
2. ```npm install```
3. index.js L:56 補上```email: 'FB帳號', password: 'FB密碼'```
4. ```npm start```

#功能和特性

- 通知你訂閱的漫畫更新了沒。
- 每天會自動檢查更新，如果有更新會傳私人訊息並附上最新話的連結。
- 可以在群組對話使用，每個人的資料是獨立的。

#用法
所有的命令都不分大小寫，但漫畫名稱除外。

##YEE

不加參數的情況會回傳說明訊息。

範例用法

```
YEE
```

回傳訊息

```
用法
YEE FIND name
YEE ADD [name name ...]
YEE DEL [name name ...]
YEE LIST
YEE CHECK
```

##FIND

FIND 後面接想要查詢的關鍵字，只允許一個關鍵字。

範例用法

```
YEE FIND 巨人
```

回傳訊息

```
大雄與綠之巨人傳
進擊的巨人
進擊的巨人before the fall
進擊的巨人短喜劇
槍神斯托拉塔斯 巨人戰爭
Stories~巨人街的少年~
新約巨人之星
```

##ADD

ADD 後面接上想要加入訂閱清單的完整漫畫名稱，以空白分隔多個，會回傳操作成功、失敗、重複的清單。另外在成功的清單裡，會附上目前最新的話數。

範例用法

```
YEE ADD 監獄學園 進擊的巨人
```

回傳訊息

```
重複： [監獄學園]
成功： [進擊的巨人-88]
失敗： [X]
```

##DEL

DEL 後面接上想要從訂閱清單刪除的完整漫畫名稱，以空白分隔多個。

範例用法

```
YEE DEL 進擊的巨人
```

回傳訊息

```
DONE
```

##LIST

列出你目前訂閱的清單。

範例用法

```
YEE LIST
```

回傳訊息

```
清單： [監獄學園-239, 進擊的巨人-88]
```

##CHECK

主動檢查訂閱清單裡的漫畫更新了沒

範例用法

```
YEE CHECK
```

回傳訊息

```
沒有更新
```
