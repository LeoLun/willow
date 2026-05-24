# GitHub Pages 版本托管与客户端 Fallback 规范

## 行为定义

### 1. 自动更新与发布机制
- **触发时机**：GitHub Actions 工作流中 `upload_release` 设为 `true` 且发布成功之后。
- **构建静态文件**：
  - 通过 curl 从刚创建的 GitHub API 获取最新 Release 的 JSON 信息：
    ```bash
    curl -s -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" \
         -H "Accept: application/vnd.github.v3+json" \
         https://api.github.com/repos/LeoLun/willow/releases/latest \
         -o latest.json
    ```
  - 将生成的 `latest.json` 自动发布至 `gh-pages` 分支的根目录下。
  - 使用 `peaceiris/actions-gh-pages@v4` 进行部署，保持部署轻量化，提交信息可为 `"docs: update latest.json for version <version>"`。

### 2. 客户端 Fallback 更新检测机制
- 客户端发起更新检查时的接口顺序：
  1. **第一优先级**：发起 GET 请求至 `https://leolun.github.io/willow/latest.json`，同样需要携带 `User-Agent: willow-desktop/<version>` 标头（虽然 Pages 不强求，但作为规范统一添加）。
  2. **如果第一优先级成功**：
     - 解析 JSON，比对版本信息，处理更新流程，缓存检测结果。
  3. **如果第一优先级失败**（网络不通、返回 404 或 502 等）：
     - 控制台输出警告：`[UpdateService] GitHub Pages update check failed, falling back to GitHub API`。
     - 发起 GET 请求至 `https://api.github.com/repos/LeoLun/willow/releases/latest`（带 User-Agent 头）。
     - 如果备用请求成功：解析 JSON，比对版本信息，处理更新流程，缓存检测结果。
     - 如果备用请求也失败：
       - 若生产包下状态码为 403，抛出中文限流错误：`"检查更新请求过快，已被 GitHub 限制，请稍后再试（限流错误）"`。
       - 其它失败，抛出错误 `"无法获取更新信息"`。
