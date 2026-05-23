# 屏蔽侧边栏的技能 Tab 和技能页面

## 动机

根据用户需求，需要屏蔽侧边栏中的“技能”Tab，并且让“技能”页面不可访问（屏蔽技能页面），以简化侧边栏导航和应用功能入口。

## 目标

1. 隐藏/移除左侧边栏中的“技能”导航项。
2. 屏蔽 `/skills` 路由（使其在应用中不可访问，或重定向到默认页面如 `/conversation`）。

## 范围

- `app/work/src/renderer/src/layout/sidebar/NavMain.vue`: 移除“技能”对应的 `SidebarMenuItem`。
- `app/work/src/renderer/src/router.ts`: 移除或重定向 `/skills` 路由，确保用户无法通过手动输入或遗留链接访问技能页面。

## 非范围

- 不彻底删除 `app/work/src/renderer/src/pages/skills/Skills.vue` 物理文件，以便未来可能恢复。
- 不影响 AI 会话发送器中可能使用的技能列表或后台技能执行服务逻辑（仅屏蔽 UI 上的技能主页和侧边栏 Tab）。
