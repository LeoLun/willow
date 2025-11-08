# poetry 框架使用文档

## 1. 框架介绍

poetry 是一个基于 Electron 的应用框架，它的目标是简化 Electron 应用的开发过程，通过装饰器模式和依赖注入机制，提供了一种更简洁、更结构化的方式来开发 Electron 应用。

## 2. 核心概念

### 2.1 模块（Module）

[模块](module.md)是应用的核心组织单元，用于声明窗口、服务提供者和其他依赖。


### 2.2 窗口（Window）

[窗口](window.md)是应用的界面单元，通过装饰器配置窗口属性和加载方式。

### 2.3 服务提供者（Provider）

服务提供者是可注入的类，用于提供各种功能和服务。

### 2.4 IPC通信

框架提供了简化的IPC通信机制，通过装饰器定义IPC处理方法。

## 3. 快速开始

### 3.1 安装依赖

在你的Electron项目中安装poetry框架：

```bash
npm install poetry
# 或
pnpm add poetry
```

注意：poetry依赖于inversify和reflect-metadata，确保这些依赖也已安装。

### 3.2 创建应用模块

```typescript
import { Module } from "poetry";
import { MainWindow } from "./window/main.window";
import { SomeService } from "./service/some.service";

@Module({
  imports: [], // 导入其他模块
  windows: [MainWindow], // 注册窗口
  providers: [SomeService], // 注册服务提供者
  exports: [] // 导出的服务
})
export class AppModule {
  // 应用逻辑
}
```

### 3.3 创建窗口类

```typescript
import { Window, WindowInstance, OnInit, OnDestroy, On } from "poetry";

@Window({
  options: {
    height: 800,
    width: 1200,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  },
  loadURL: MAIN_WINDOW_VITE_DEV_SERVER_URL,
  openDevTools: true,
})
export class MainWindow implements OnInit, OnDestroy {
  @WindowInstance()
  private win: BrowserWindow;

  async onInit() {
    // 窗口初始化逻辑
  }

  onDestroy() {
    // 窗口销毁时的清理逻辑
  }

  @On('show')
  onShow() {
    // 监听窗口显示事件
  }
}
```

### 3.4 初始化应用

```typescript
import { app } from "electron";
import { CoreFactory } from "poetry";
import { AppModule } from "./app.module";

async function main() {
  // 创建应用实例
  const appInstance = await CoreFactory.create(AppModule);
  
  // 启动应用
  appInstance.createWindow();
}

app.whenReady().then(main);
```

## 4. 装饰器详解

### 4.1 @Module

用于定义应用模块，配置导入、窗口、服务提供者等。

**参数：**
- `imports`: 导入的其他模块数组
- `windows`: 注册的窗口类数组
- `providers`: 注册的服务提供者数组
- `exports`: 导出的服务数组

### 4.2 @Window

用于定义窗口类，配置窗口属性和加载方式。

**参数：**
- `options`: BrowserWindow构造选项
- `loadURL`: 加载的URL
- `loadFile`: 加载的文件路径
- `openDevTools`: 是否打开开发者工具

### 4.3 @Injectable

标记类为可注入的服务提供者。

### 4.4 @IPC

定义IPC事件处理方法。

**参数：**
- `event`: IPC事件名称

**使用示例：**
```typescript
@IPC('OPEN_SETTING_WINDOW')
async openSettingWindow(
  event: Electron.IpcMainEvent,
  request: any
): Promise<any> {
  // 处理IPC事件
}
```

### 4.5 @On

监听窗口或应用事件。

**参数：**
- `event`: 事件名称

### 4.6 @WindowInstance

注入窗口实例到属性中。

## 5. 生命周期钩子

### 5.1 OnInit

窗口初始化完成后调用。

### 5.2 OnDestroy

窗口销毁前调用。

## 6. 依赖注入

poetry使用inversify实现依赖注入，你可以在构造函数中声明依赖：

```typescript
constructor(private windowFactoryResolver: WindowFactoryResolver) {
  this.windowFactoryResolver = windowFactoryResolver;
}
```

## 7. 窗口管理

### 7.1 创建窗口

使用WindowFactoryResolver创建窗口：

```typescript
this.windowFactoryResolver.resolveWindowFactory(MainWindow);
```

### 7.2 窗口事件

使用@On装饰器监听窗口事件：

```typescript
@On('show')
onShow() {
  console.log('窗口显示');
}

@On('hide')
onHide() {
  console.log('窗口隐藏');
}
```

## 8. 应用事件

在模块类中使用@On装饰器监听应用事件：

```typescript
@On("ready")
onReady() {
  // 应用就绪时的处理
}

@On("window-all-closed")
onWindowAllClosed() {
  if (process.platform !== "darwin") {
    app.quit();
  }
}

@On("activate")
onActivate() {
  if (BrowserWindow.getAllWindows().length === 0) {
    this.createWindow();
  }
}
```

## 9. 完整示例

以下是一个完整的Electron应用示例，使用poetry框架：

### 9.1 应用模块

```typescript
import { On, WindowFactoryResolver, Module, IPC } from "poetry";
import { SomeService } from "./service/some.service";
import { MainWindow } from "./window/main.window";
import { app, BrowserWindow } from "electron";

@Module({
  imports: [],
  windows: [MainWindow],
  providers: [SomeService],
})
export class AppModule {
  private windowFactoryResolver: WindowFactoryResolver;

  constructor(windowFactoryResolver: WindowFactoryResolver) {
    this.windowFactoryResolver = windowFactoryResolver;
  }

  createWindow() {
    this.windowFactoryResolver.resolveWindowFactory(MainWindow);
  }

  @On("ready")
  onReady() {
    this.createWindow();
  }

  @On("window-all-closed")
  onWindowAllClosed() {
    if (process.platform !== "darwin") {
      app.quit();
    }
  }

  @On("activate")
  onActivate() {
    if (BrowserWindow.getAllWindows().length === 0) {
      this.createWindow();
    }
  }
}
```

### 9.2 窗口类

```typescript
import { Window, WindowInstance, OnInit, On, OnDestroy } from "poetry";
import path from 'path';

@Window({
  options: {
    height: 800,
    width: 1200,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  },
  loadURL: MAIN_WINDOW_VITE_DEV_SERVER_URL,
  openDevTools: true,
})
export class MainWindow implements OnInit, OnDestroy {
  @WindowInstance()
  private win: BrowserWindow;

  async onInit() {
    // 初始化逻辑
  }

  onDestroy() {
    console.log('窗口销毁');
  }

  @On('show')
  onShow() {
    console.log('窗口显示');
  }
}
```

### 9.3 服务类

```typescript
import { Injectable } from "poetry";

@Injectable()
export class SomeService {
  doSomething() {
    // 服务逻辑
    return 'Hello from service';
  }
}
```

## 10. 注意事项

1. 确保在应用入口处导入`reflect-metadata`
2. 使用装饰器时，确保启用了TypeScript的装饰器支持
3. 窗口类需要实现`OnInit`或`OnDestroy`接口以使用相应的生命周期钩子
4. IPC处理方法需要处理`Electron.IpcMainEvent`或`Electron.IpcMainInvokeEvent`类型的事件参数

通过使用poetry框架，你可以更优雅地开发Electron应用，享受依赖注入和装饰器带来的便利性。
        