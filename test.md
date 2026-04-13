# 测试文档

这是一个测试文档，用于验证 Feishu Markdown Sync 功能。

## 流程图示例

```mermaid
graph TD
    A[开始] --> B{判断条件}
    B -->|是| C[执行操作]
    B -->|否| D[结束]
    C --> D
```

## 序列图示例

```mermaid
sequenceDiagram
    participant 用户
    participant 系统
    participant 飞书
    用户->>系统: 提交 Markdown
    系统->>系统: 解析内容
    系统->>飞书: 上传图片
    系统->>飞书: 创建文档
    飞书-->>系统: 返回文档ID
    系统-->>用户: 显示结果
```

## 普通内容

这是一个普通的段落，包含一些 **粗体** 和 *斜体* 文本。

### 代码块

```typescript
function hello(name: string): string {
  return `Hello, ${name}!`;
}
```

## 表格示例

| 功能 | 状态 |
|------|------|
| Markdown 解析 | ✅ |
| Mermaid 图表 | ✅ |
| 图片上传 | ✅ |

## 结束

测试完成！
