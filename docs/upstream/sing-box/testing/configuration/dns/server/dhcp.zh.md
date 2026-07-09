---
icon: material/new-box
---

!!! quote "sing-box 1.14.0 中的更改"

    :material-plus: [client_id](#client_id)

!!! question "自 sing-box 1.12.0 起"

# DHCP

### 结构

```json
{
  "dns": {
    "servers": [
      {
        "type": "dhcp",
        "tag": "",

        "interface": "",
        "client_id": "",

        // 拨号字段
      }
    ]
  }
}
```

### 字段

#### interface

要监听的网络接口名称。

默认使用默认接口。

#### client_id

!!! question "自 sing-box 1.14.0 起"

查询时携带的 DHCP 客户端标识符（option 61）。

接受冒号分隔的十六进制字节（`01:aa:bb:cc:dd:ee:ff`）或纯文本字符串。

默认使用由接口 MAC 地址生成的硬件标识符。

### 拨号字段

参阅 [拨号字段](/zh/configuration/shared/dial/) 了解详情。
