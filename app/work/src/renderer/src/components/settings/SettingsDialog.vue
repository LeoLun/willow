<script setup lang="ts">
import { ref } from "vue";
import {
  Settings,
  Palette,
  Info,
  Monitor,
  Moon,
  Sun,
  X,
} from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useDarkMode, type ThemeMode } from "@/composables/useDarkMode";

const open = defineModel<boolean>("open", { default: false });

const { themeMode, isDark } = useDarkMode();

interface NavItem {
  id: string;
  label: string;
  icon: typeof Settings;
}

const navItems: NavItem[] = [
  { id: "general", label: "通用", icon: Settings },
  { id: "appearance", label: "外观", icon: Palette },
  { id: "about", label: "关于", icon: Info },
];

const activeSection = ref("general");

interface ThemeOption {
  value: ThemeMode;
  label: string;
  description: string;
  icon: typeof Sun;
}

const themeOptions: ThemeOption[] = [
  {
    value: "system",
    label: "跟随系统",
    description: "自动匹配操作系统主题",
    icon: Monitor,
  },
  {
    value: "light",
    label: "浅色",
    description: "始终使用亮色主题",
    icon: Sun,
  },
  {
    value: "dark",
    label: "深色",
    description: "始终使用暗色主题",
    icon: Moon,
  },
];
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="max-w-2xl overflow-hidden p-0 sm:max-w-2xl"
      :show-close-button="false"
    >
      <div class="flex h-[480px]">
        <!-- 左侧导航 -->
        <nav
          class="flex w-48 shrink-0 flex-col border-r border-border bg-muted/30"
        >
          <DialogHeader class="px-4 pt-5 pb-3">
            <DialogTitle class="text-base font-semibold">设置</DialogTitle>
            <DialogDescription class="sr-only">应用设置</DialogDescription>
          </DialogHeader>
          <div class="flex-1 space-y-0.5 px-2">
            <button
              v-for="item in navItems"
              :key="item.id"
              class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors"
              :class="
                activeSection === item.id
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
              "
              @click="activeSection = item.id"
            >
              <component :is="item.icon" class="size-4" />
              {{ item.label }}
            </button>
          </div>
        </nav>

        <!-- 右侧内容 -->
        <div class="flex flex-1 flex-col">
          <!-- 关闭按钮 -->
          <div class="flex shrink-0 items-center justify-end px-4 pt-3">
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-muted-foreground hover:text-foreground"
              @click="open = false"
            >
              <X class="size-4" />
              <span class="sr-only">关闭</span>
            </Button>
          </div>

          <ScrollArea class="flex-1">
            <div class="px-6 pb-6">
              <!-- 通用设置 -->
              <div v-if="activeSection === 'general'" class="space-y-6">
                <div>
                  <h3 class="text-sm font-medium">通用设置</h3>
                  <p class="text-sm text-muted-foreground mt-1">
                    管理应用的基本配置。
                  </p>
                </div>
                <Separator />
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm font-medium">开机自启动</p>
                      <p class="text-xs text-muted-foreground">
                        系统启动时自动打开应用
                      </p>
                    </div>
                    <Switch />
                  </div>
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm font-medium">消息通知</p>
                      <p class="text-xs text-muted-foreground">
                        接收应用内通知
                      </p>
                    </div>
                    <Switch :default-checked="true" />
                  </div>
                </div>
              </div>

              <!-- 外观设置 -->
              <div v-if="activeSection === 'appearance'" class="space-y-6">
                <div>
                  <h3 class="text-sm font-medium">外观设置</h3>
                  <p class="text-sm text-muted-foreground mt-1">
                    自定义应用的视觉风格。
                  </p>
                </div>
                <Separator />
                <div>
                  <p class="text-sm font-medium mb-3">主题模式</p>
                  <div class="grid grid-cols-3 gap-3">
                    <button
                      v-for="option in themeOptions"
                      :key="option.value"
                      class="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors"
                      :class="
                        themeMode === option.value
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border text-muted-foreground hover:border-primary/50 hover:bg-accent/50'
                      "
                      @click="themeMode = option.value"
                    >
                      <component :is="option.icon" class="size-5" />
                      <span class="text-xs font-medium">{{
                        option.label
                      }}</span>
                    </button>
                  </div>
                  <p class="text-xs text-muted-foreground mt-3">
                    {{
                      themeMode === "system"
                        ? "当前跟随系统，" +
                          (isDark ? "系统为暗色" : "系统为亮色")
                        : themeMode === "dark"
                          ? "当前为暗色主题"
                          : "当前为亮色主题"
                    }}
                  </p>
                </div>
              </div>

              <!-- 关于 -->
              <div v-if="activeSection === 'about'" class="space-y-6">
                <div>
                  <h3 class="text-sm font-medium">关于</h3>
                  <p class="text-sm text-muted-foreground mt-1">
                    应用信息与版本。
                  </p>
                </div>
                <Separator />
                <div class="space-y-3">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-muted-foreground">应用名称</span>
                    <span class="font-medium">Willow</span>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-muted-foreground">版本</span>
                    <span class="font-medium">0.1.0</span>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-muted-foreground">框架</span>
                    <span class="font-medium">Electron + Vue</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
