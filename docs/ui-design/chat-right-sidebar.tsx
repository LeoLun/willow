"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileTextIcon,
  FileCodeIcon,
  FileJsonIcon,
  ImageIcon,
  FolderIcon,
  FolderOpenIcon,
  InfoIcon,
} from "lucide-react";

interface RightSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

interface FileItem {
  id: string;
  name: string;
  type: "file" | "folder";
  extension?: string;
  children?: FileItem[];
}

const todoItems: TodoItem[] = [
  { id: "1", text: "搜索并整理AI新闻", completed: true },
  { id: "2", text: "生成新闻摘要", completed: true },
  { id: "3", text: "提取趋势洞察", completed: true },
  { id: "4", text: "保存至Markdown文件", completed: true },
  { id: "5", text: "设置自动化推送", completed: false },
];

const files: FileItem[] = [
  {
    id: "1",
    name: "outputs",
    type: "folder",
    children: [
      { id: "1-1", name: "AI_news_20260412.md", type: "file", extension: "md" },
      { id: "1-2", name: "AI_news_20260411.md", type: "file", extension: "md" },
      { id: "1-3", name: "AI_news_20260410.md", type: "file", extension: "md" },
    ],
  },
  {
    id: "2",
    name: "config",
    type: "folder",
    children: [
      { id: "2-1", name: "sources.json", type: "file", extension: "json" },
      { id: "2-2", name: "settings.json", type: "file", extension: "json" },
    ],
  },
  { id: "3", name: "README.md", type: "file", extension: "md" },
  { id: "4", name: "automation.py", type: "file", extension: "py" },
];

export function RightSidebar({ open, onOpenChange }: RightSidebarProps) {
  const [todos, setTodos] = React.useState(todoItems);

  const completedCount = todos.filter((t) => t.completed).length;
  const totalCount = todos.length;
  const progress = (completedCount / totalCount) * 100;

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    );
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col border-l border-border bg-sidebar transition-all duration-300",
        open ? "w-72" : "w-0 overflow-hidden",
      )}
    >
      {/* Header */}
      {/* <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium"></span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={() => onOpenChange(false)}
        >
          <XIcon className="size-4" />
        </Button>
      </div> */}

      <Tabs defaultValue="summary" className="flex flex-1 flex-col">
        <TabsList variant="line" className="mx-3 mt-2 w-auto">
          <TabsTrigger value="summary" className="gap-1.5 text-xs">
            <InfoIcon className="size-3.5" />
            概要
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-1.5 text-xs">
            <FolderOpenIcon className="size-3.5" />
            文件
            <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {countFiles(files)}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-0 flex-1">
          <ScrollArea className="h-full">
            <div className="space-y-4 p-3">
              {/* Session Info */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">
                  会话信息
                </h4>
                <div className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">创建时间</span>
                    <span>2026/04/12 09:30</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">消息数量</span>
                    <span>12 条</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Token 用量</span>
                    <span>49k</span>
                  </div>
                </div>
              </div>

              {/* TODO Progress */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">
                  任务进度 ({completedCount}/{totalCount})
                </h4>
                <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">完成进度</span>
                    <span className="font-medium">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                {/* Todo List */}
                <div className="space-y-1">
                  {todos.map((todo) => (
                    <div
                      key={todo.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                    >
                      <Checkbox
                        checked={todo.completed}
                        onCheckedChange={() => toggleTodo(todo.id)}
                        className="size-4"
                      />
                      <span
                        className={cn(
                          "text-sm",
                          todo.completed &&
                            "text-muted-foreground line-through",
                        )}
                      >
                        {todo.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="files" className="mt-0 flex-1">
          <ScrollArea className="h-full">
            <div className="p-3">
              <FileTree items={files} />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FileTree({ items, level = 0 }: { items: FileItem[]; level?: number }) {
  return (
    <div className="space-y-0.5">
      {items.map((item) => (
        <FileTreeItem key={item.id} item={item} level={level} />
      ))}
    </div>
  );
}

function FileTreeItem({ item, level }: { item: FileItem; level: number }) {
  const [isOpen, setIsOpen] = React.useState(true);

  const getFileIcon = (extension?: string) => {
    switch (extension) {
      case "md":
        return <FileTextIcon className="size-4 text-blue-500" />;
      case "json":
        return <FileJsonIcon className="size-4 text-yellow-500" />;
      case "py":
      case "js":
      case "ts":
        return <FileCodeIcon className="size-4 text-green-500" />;
      case "png":
      case "jpg":
      case "svg":
        return <ImageIcon className="size-4 text-purple-500" />;
      default:
        return <FileTextIcon className="size-4 text-muted-foreground" />;
    }
  };

  if (item.type === "folder") {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start gap-1 px-2 py-1 text-sm font-normal"
            style={{ paddingLeft: `${level * 12 + 8}px` }}
          >
            {isOpen ? (
              <ChevronDownIcon className="size-3" />
            ) : (
              <ChevronRightIcon className="size-3" />
            )}
            <FolderIcon className="size-4 text-amber-500" />
            <span className="truncate">{item.name}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {item.children && (
            <FileTree items={item.children} level={level + 1} />
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2 px-2 py-1 text-sm font-normal"
      style={{ paddingLeft: `${level * 12 + 24}px` }}
    >
      {getFileIcon(item.extension)}
      <span className="truncate">{item.name}</span>
    </Button>
  );
}

function countFiles(items: FileItem[]): number {
  return items.reduce((count, item) => {
    if (item.type === "folder" && item.children) {
      return count + countFiles(item.children);
    }
    return count + 1;
  }, 0);
}
