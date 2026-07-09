---
icon: material/new-box
---

!!! quote "Changes in sing-box 1.14.0"

    :material-plus: [client_id](#client_id)

!!! question "Since sing-box 1.12.0"

# DHCP

### Structure

```json
{
  "dns": {
    "servers": [
      {
        "type": "dhcp",
        "tag": "",

        "interface": "",
        "client_id": "",
        
        // Dial Fields
      }
    ]
  }
}
```

### Fields

#### interface

Interface name to listen on. 

The default interface will be used by default.

#### client_id

!!! question "Since sing-box 1.14.0"

DHCP client identifier (option 61) to send with queries.

Accepts colon-separated hexadecimal bytes (`01:aa:bb:cc:dd:ee:ff`) or a plain string.

A hardware identifier generated from the interface MAC address is used by default.

### Dial Fields

See [Dial Fields](/configuration/shared/dial/) for details. 
