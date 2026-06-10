import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } from "electron";
import path from "node:path";
import { getIps, getStatus, applyHosts, removeHosts, buildBlock } from "./hosts";

const isDev = !app.isPackaged && process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Ассеты (иконки) копируются в dist/electron при сборке — см. скрипт copy:assets.
const assetPath = (file: string) => path.join(__dirname, file);

function createWindow() {
  const win = new BrowserWindow({
    width: 560,
    height: 880,
    resizable: true,
    show: false,
    icon: assetPath("icon.png"),
    title: "Spotify Discord Hosts Fixer",
    autoHideMenuBar: true,
    // Полупрозрачный системный фон: acrylic на Windows 11, vibrancy на macOS.
    backgroundColor: "#00000000",
    backgroundMaterial: "acrylic",
    vibrancy: "under-window",
    webPreferences: {
      preload: assetPath("preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow = win;

  // Внешние ссылки открываем в системном браузере, а не в окне приложения.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.once("ready-to-show", () => win.show());

  // Закрытие окна сворачивает в трей, а не завершает программу.
  win.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL as string);
  } else {
    win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  }
}

function toggleWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function createTray() {
  let image = nativeImage.createFromPath(assetPath("tray.png"));
  if (!image.isEmpty()) {
    image = image.resize({ width: 16, height: 16 });
  }
  tray = new Tray(image);
  tray.setToolTip("Spotify Discord Hosts Fixer");

  const contextMenu = Menu.buildFromTemplate([
    { label: "Открыть", click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: "Скрыть в трей", click: () => mainWindow?.hide() },
    { type: "separator" },
    { label: "Выход", click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);

  // ЛКМ по значку в трее — показать/скрыть окно.
  tray.on("click", () => toggleWindow());
}

// IPC: данные и операции
ipcMain.handle("get-ips", async () => getIps());
ipcMain.handle("get-status", async () => getStatus());
ipcMain.handle("get-block-text", async (_e, ips: string[]) => buildBlock(ips || []));
ipcMain.handle("apply", async (_e, ips: string[]) => applyHosts(ips || []));
ipcMain.handle("remove", async () => removeHosts());

// Один экземпляр приложения: повторный запуск разворачивает уже открытое окно.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  app.whenReady().then(() => {
    // Убираем стандартное системное меню (File/Edit/View/Window/Help).
    Menu.setApplicationMenu(null);
    createWindow();
    createTray();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else mainWindow?.show();
    });
  });
}

app.on("before-quit", () => {
  isQuitting = true;
});

// Окно прячется в трей, поэтому само по себе не закрывается;
// выход выполняется только через пункт «Выход» в трее.
app.on("window-all-closed", () => {
  // Намеренно пусто: приложение продолжает жить в трее.
});
