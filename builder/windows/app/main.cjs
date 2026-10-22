'use strict';

const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');
const config = require('./generated-config.json');
const {
  validateWebsiteUrl,
  validateAppName,
  isAllowedNavigation
} = require('./security.cjs');

// IMPORTANT: This app loads a REMOTE, potentially untrusted website.
// Never expose Node, Electron IPC, or a preload bridge to its renderer.
app.enableSandbox();

const siteUrl = validateWebsiteUrl(config.websiteUrl);
const appName = validateAppName(config.appName);
const size = config.windowSize && Number.isInteger(config.windowSize.width) &&
  Number.isInteger(config.windowSize.height)
  ? config.windowSize
  : { width: 1200, height: 800 };

if (typeof config.appId === 'string' && /^[a-zA-Z0-9.]+$/.test(config.appId)) {
  app.setAppUserModelId(config.appId);
}

let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    title: appName,
    width: Math.max(640, Math.min(1920, size.width)),
    height: Math.max(480, Math.min(1200, size.height)),
    minWidth: 480,
    minHeight: 360,
    backgroundColor: '#f7faff',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      devTools: false
      // No preload. No IPC channels. No privileged APIs to remote JS.
    }
  });

  // Keep the renderer within the originally approved HTTPS origin.
  // External auth providers, popup logins and cross-site navigation are
  // intentionally not supported in this initial QA shell.
  const allow = (event, legacyUrl) => {
    // Electron 44+ provides navigation details on the event itself.
    // Older releases supplied the URL as the second argument.
    if (event.isMainFrame === false) return;
    const destination = typeof legacyUrl === 'string' ? legacyUrl : event.url;
    if (!isAllowedNavigation(destination, siteUrl)) event.preventDefault();
  };
  win.webContents.on('will-navigate', allow);
  win.webContents.on('will-redirect', allow);

  // A remote website must never create privileged child windows or webviews.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-attach-webview', event => event.preventDefault());

  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) win.show();
  });

  win.loadURL(siteUrl).catch(() => {
    if (!win.isDestroyed()) {
      // A LOCAL informational page, never a bundled copy of the website.
      win.loadFile(path.join(__dirname, 'offline.html')).catch(() => {});
      win.show();
    }
  });

  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
  mainWindow = win;
  return win;
}

app.whenReady().then(() => {
  // Deny camera, microphone, geolocation, notifications, MIDI and any other
  // sensitive permissions until permission UX can be implemented properly.
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.on('will-download', event => event.preventDefault());

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch(() => { app.quit(); });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
