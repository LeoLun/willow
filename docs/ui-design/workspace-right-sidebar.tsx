"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  FileText,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

interface RightSettingsPanelProps {
  workspacePath: string;
  soulContent: string;
  onWorkspacePathChange: (path: string) => void;
  onSoulContentChange: (content: string) => void;
  onSave?: () => void;
}

export function RightSettingsPanel({
  workspacePath,
  soulContent,
  onWorkspacePathChange,
  onSoulContentChange,
  onSave,
}: RightSettingsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className={cn(
        "h-screen bg-sidebar border-l border-sidebar-border transition-all duration-300 ease-in-out flex flex-col",
        isCollapsed ? "w-12" : "w-80",
      )}
    >
      {/* 折叠/展开按钮 */}
      <div className="p-2 flex justify-start border-b border-sidebar-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8"
        >
          {isCollapsed ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* 面板内容 */}
      {!isCollapsed && (
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* 工作空间地址 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Folder className="h-4 w-4" />
              <span>工作空间地址</span>
            </div>
            <div className="space-y-2">
              <Input
                value={workspacePath}
                onChange={(e) => onWorkspacePathChange(e.target.value)}
                placeholder="/path/to/workspace"
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                设置工作空间的本地文件夹路径
              </p>
            </div>
          </div>

          <Separator />

          {/* Soul.md 设置 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="h-4 w-4" />
              <span>soul.md 设置</span>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="soul-content"
                className="text-xs text-muted-foreground"
              >
                定义 AI 助手的行为和人格特征
              </Label>
              <Textarea
                id="soul-content"
                value={soulContent}
                onChange={(e) => onSoulContentChange(e.target.value)}
                placeholder="# AI 助手配置&#10;&#10;描述你希望 AI 助手具有的特性..."
                className="min-h-[200px] text-sm font-mono resize-none"
              />
              <p className="text-xs text-muted-foreground">
                支持 Markdown 格式
              </p>
            </div>
          </div>

          {/* 保存按钮 */}
          <div className="pt-4">
            <Button onClick={onSave} className="w-full gap-2">
              <Save className="h-4 w-4" />
              保存设置
            </Button>
          </div>
        </div>
      )}

      {/* 折叠状态下的图标 */}
      {isCollapsed && (
        <div className="flex-1 flex flex-col items-center pt-4 space-y-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="工作空间地址"
          >
            <Folder className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="soul.md 设置"
          >
            <FileText className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
