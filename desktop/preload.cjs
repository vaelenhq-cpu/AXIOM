const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("axiomDesktop", {
  platform: process.platform,
  desktop: true
});
