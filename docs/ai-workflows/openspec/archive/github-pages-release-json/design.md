# 详细设计说明

## 1. GitHub Actions 侧设计 (`release.yml`)

在 `softprops/action-gh-release@v2` 步骤之后，添加以下步骤：

```yaml
      - name: Generate latest.json
        if: ${{ inputs.upload_release == true }}
        run: |
          # 稍等几秒确保 GitHub API 已经反映出最新的 release 数据
          sleep 5
          curl -s -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" \
               -H "Accept: application/vnd.github.v3+json" \
               https://api.github.com/repos/LeoLun/willow/releases/latest \
               -o latest.json
          # 简单校验 JSON 文件是否有效，防止下载失败写入空内容
          node -e "const data = require('./latest.json'); if(!data.tag_name) throw new Error('Invalid JSON generated');"

      - name: Deploy to GitHub Pages
        if: ${{ inputs.upload_release == true }}
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: .
          publish_branch: gh-pages
          destination_dir: .
          keep_files: false
          user_name: 'github-actions[bot]'
          user_email: 'github-actions[bot]@users.noreply.github.com'
          commit_message: "docs: update latest.json to ${{ env.VERSION }}"
```

> [!NOTE]
> `peaceiris/actions-gh-pages@v4` 是目前 GitHub Actions 中最广泛使用的高质量 Pages 部署插件，支持在部署时指定 `publish_branch` 为 `gh-pages`，并在构建目录下只上传生成的静态配置文件，从而只更新 `latest.json` 且提交干净。

## 2. 客户端侧设计 (`update.service.ts`)

重构 `UpdateService` 的 `checkUpdate` 方法以增加 fallback 逻辑：

```typescript
  async checkUpdate(force = false): Promise<CheckUpdateResponse> {
    const now = Date.now();
    // 缓存逻辑保持不变
    if (!force && this.cachedCheckResult && now - this.lastCheckTime < 10 * 60 * 1000) {
      console.log("[UpdateService] Using cached update check result");
      if (this.cachedCheckResult.hasUpdate) {
        this.status = "available";
        if (this.cachedCheckResult.updateType) {
          this.updateType = this.cachedCheckResult.updateType;
        }
      } else {
        this.status = "idle";
      }
      return this.cachedCheckResult;
    }

    this.broadcastStatus("checking");

    try {
      const currentVersion = app.getVersion();
      console.log("currentVersion", currentVersion);

      let response: Response;
      let usingFallback = false;

      // 步骤 1: 尝试优先向 GitHub Pages 静态请求数据
      try {
        response = await fetch(
          "https://leolun.github.io/willow/latest.json",
          {
            headers: {
              "User-Agent": `willow-desktop/${currentVersion}`,
            },
          }
        );
        if (!response.ok) {
          throw new Error(`GitHub Pages returned status ${response.status}`);
        }
      } catch (pagesError) {
        console.warn(
          "[UpdateService] GitHub Pages update check failed, falling back to GitHub API:",
          pagesError,
        );
        usingFallback = true;
        // 步骤 2: Fallback 降级请求 GitHub API
        response = await fetch(
          "https://api.github.com/repos/LeoLun/willow/releases/latest",
          {
            headers: {
              "User-Agent": `willow-desktop/${currentVersion}`,
            },
          }
        );
      }

      let release: any;
      console.log("response", response);
      if (!response.ok) {
        if (!app.isPackaged) {
          console.warn(
            "[UpdateService] Both updates check failed, enabling mock update for development",
          );
          // ... Mock 更新降级逻辑保持不变
        } else {
          // 如果使用的是 Fallback 请求 API 遇到 403，抛出限流错误
          if (usingFallback && response.status === 403) {
            throw new Error("检查更新请求过快，已被 GitHub 限制，请稍后再试（限流错误）");
          }
          throw new Error(`Failed to fetch release: ${response.statusText}`);
        }
      } else {
        this.isMock = false;
        release = (await response.json()) as any;
      }

      // ... (比对逻辑与缓存逻辑与之前一致)
    } catch (error: any) {
      // 错误处理与之前一致
    }
  }
```
