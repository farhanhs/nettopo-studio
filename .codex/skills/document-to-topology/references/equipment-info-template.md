# Equipment Information Template

Use this template when asking customers or technicians for network topology data.

```markdown
# 客戶網路設備資訊範本

## 1. 基本資訊

- 客戶名稱：
- 場域/分店名稱：
- 文件日期：
- 填寫人：
- 拓樸版本：現況 / 更新後 / 預計施工後

## 2. 網路來源與 ISP

| 項目 | 內容 |
|---|---|
| ISP/電信商 |  |
| 固定 IP / WAN IP |  |
| PPPoE/上網帳號 |  |
| 密碼 | 請交付原始文件或密碼庫，不要貼在公開文件 |
| 對外設備名稱 | 例如：中華電信數據機 |
| 連到哪台設備 | 例如：ASUS RT-BE88U |
| 連接方式/Port | 例如：LAN1 -> WAN |

## 3. 網路設備清單

| 設備ID | 設備名稱 | 類型 | 品牌/型號 | 管理IP | 位置 | 角色 | 備註 |
|---|---|---|---|---|---|---|---|
| R1 | ASUS RT-BE88U | router / access-point | ASUS RT-BE88U | 192.168.50.1 | 機櫃/櫃台 | 主路由/主AP |  |
| M1 | 中華電信數據機 | modem |  |  |  | ISP入口 |  |

類型建議：`modem`, `router`, `firewall`, `switch`, `access-point`, `mesh-node`, `printer`, `camera`, `pos`, `server`, `nas`, `erp`, `pc`, `tablet`, `phone`, `iot`

## 4. 有線連線

| 來源設備ID | 來源Port | 目的設備ID | 目的Port | 速率 | 用途/備註 |
|---|---|---|---|---|---|
| M1 | LAN1 | R1 | WAN | 1G | Internet uplink |
| R1 | LAN2 | AP1 | LAN | 1G | AiMesh wired backhaul |

## 5. 無線/SSID 設定

| SSID | 用途 | 頻段 | 密碼 | 由哪台設備發送 | 誰會連 |
|---|---|---|---|---|---|
| v sense spa officials | 店內設備 Wi-Fi | 2.4GHz / 5GHz | 請遮蔽或放密碼庫 | R1, AP1 | printer, iPad, Google Home |
| v sense spa | 客戶/員工 Wi-Fi | 2.4GHz | 請遮蔽或放密碼庫 | R1, AP1 | phones, guest devices |

## 6. 無線/Mesh 回程

| Mesh設備ID | 上游設備ID | 回程方式 | 頻段/速率 | 狀態 | 備註 |
|---|---|---|---|---|---|
| AP1 | R1 | wired | 1G | 正常 | B1洗衣房 |
| AP2 | R1 | wireless | 5GHz/unknown | 有問題 | B1走廊，可能更換 |

## 7. 端點設備

| 設備ID | 名稱 | 類型 | 數量 | 連接SSID/上游設備 | 位置 | 帳號 | 密碼 | 備註 |
|---|---|---|---:|---|---|---|---|---|
| P1 | HP LaserJet M141w | printer | 1 | v sense spa officials |  |  |  |  |
| CAM-B1 | 小米 Wi-Fi 攝影機 | camera | 1 | v sense spa | B1走道 |  |  |  |
| IPAD | iPad 平板 | tablet | 5 | v sense spa officials | 櫃台/店內 | Apple ID | 放密碼庫 |  |

## 8. 群組/區域

| 群組名稱 | 類型 | 包含設備/SSID | 備註 |
|---|---|---|---|
| 店內設備 Wi-Fi | vlan/domain | v sense spa officials |  |
| 客戶/員工 Wi-Fi | vlan/domain | v sense spa |  |
| B1 | site | AP1, AP2, CAM-B1 |  |

## 9. 圖面要求

- 偏好的架構風格：一般分層 / 三層式 / Spine-Leaf / Mesh / 手動畫法
- 圖面方向：橫向 / 直向
- 是否顯示帳號：否 / 僅遮蔽顯示
- 是否顯示密碼：否 / 僅遮蔽顯示
- 是否用群組折疊大量端點：是 / 否

## 10. 不確定事項

| 問題 | 目前猜測 | 需要確認的人 |
|---|---|---|
| 例：監視器接哪個 SSID？ | v sense spa officials | 客戶/施工人員 |
```
