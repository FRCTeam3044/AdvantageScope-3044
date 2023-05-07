import { ipcRenderer, contextBridge } from "electron";
import { existsSync, writeFile } from "fs";

const windowLoaded = new Promise((resolve) => {
  window.onload = resolve;
});

ipcRenderer.on("port", async (event) => {
  await windowLoaded;
  window.postMessage("port", "*", event.ports);
});

contextBridge.exposeInMainWorld("deployWriter", {
  configExistsSync,
  writeConfig
});

function configExistsSync(deployDir: string): boolean {
  return existsSync(deployDir + "/config.yml");
}

function writeConfig(deployDir: string, config: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    writeFile(deployDir + "/config.yml", config, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
