/*global require, process*/
'use strict';

let { app, BrowserWindow } = require("electron"),
    { join: j, basename } = require("path"),
    fs = require("fs"),
    env = process.env,
    livelyDir = j(env.HOME, ".lively/"),
    packageDepDir = j(livelyDir, "lively.next-node_modules"),
    flatnDir = j(livelyDir, "flatn"),
    flatnBin = j(flatnDir, "bin"),
    flatnModuleResolver = j(flatnDir, "module-resolver.js");

if (needsInitialize()) {
  initialize().catch(err => {
    console.error("Error starting lively.app:", err);
    process.exist(1);
  })
} else {
  startServer();
}


function needsInitialize() {
  return !fs.existsSync(livelyDir);
}

async function initialize() {

  await new Promise(resolve => app.on("ready", () => resolve()));

  var appPath = app.getAppPath(),
      logWindow = await openLogWindow();

  log(`${livelyDir} does not exist yet, initializing...`);

  try {
    let extract = require(j(appPath, "./deploy/extract.js"));
    await extract(livelyDir, j(appPath, "lively.next.tar.gz"));
    log(`lively.app initialized`);
    await new Promise(resolve => setTimeout(() => resolve(), 1000));

  } catch (err) {
    log(`Error initializing: ` + err.stack);
    await new Promise((resolve, reject) => setTimeout(() => reject(err), 2000));
  }

  app.relaunch();

  setTimeout(() => process.exit(), 100);

  // FIXME redundancy with start-server.js!
  function openLogWindow() {
    return new Promise((resolve, reject) => {
      if (logWindow && !logWindow.isDestroyed()) {
        logWindow.show();
        return resolve(logWindow);
      }
      logWindow = new BrowserWindow({width: 800, height: 600, show: false});
      logWindow.loadURL("file://" + appPath + "/logger.html");
      logWindow.once('ready-to-show', () => {
        logWindow.show();
        resolve(logWindow);
      })
    })
  }
  
  function log(content) {
    console.log(content);
    logWindow.webContents.send("log", {type: "log", content});  
  }
}

function startServer() {
  let livelyPackages = fs.readdirSync(livelyDir)
        .map(ea => j(livelyDir, ea))
        .filter(ea => ea != packageDepDir && fs.statSync(ea).isDirectory()),
      collectionDirs = (env.FLATN_PACKAGE_COLLECTION_DIRS || "").split(":").filter(Boolean),
      devDirs = (env.FLATN_PACKAGE_COLLECTION_DIRS || "").split(":").filter(Boolean);
      
  if (!collectionDirs.includes(packageDepDir)) collectionDirs.push(packageDepDir);
  env.FLATN_PACKAGE_COLLECTION_DIRS = collectionDirs.join(":")
  
  for (let p of livelyPackages) if (!devDirs.includes(p)) devDirs.push(p);
  env.FLATN_DEV_PACKAGE_DIRS = devDirs.join(":");
  
  if (!env.PATH.includes(flatnBin)) env.PATH = flatnBin + ":" + env.PATH;
  
  if (!require.cache[flatnModuleResolver]) require(flatnModuleResolver);
  
  require("./start-server.js").start(livelyDir);  
}
