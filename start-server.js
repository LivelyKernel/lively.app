/*global require,process,__dirname,module*/

const path = require('path');
const util = require('util');
const { BrowserWindow, Menu, MenuItem, Tray, app } = require("electron");
const fixPath = require('fix-path');

var tray,
    fs = require("fs"),
    logWindow,
    logStream = fs.createWriteStream(__dirname + '/log.txt'),
    recentLogMessages = [],
    originalConsoleMethods = originalConsoleMethods || {};


module.exports.start = start;

async function start() {
  try {
    wrapConsole();
    prepareApp();
    app.on("ready", () => openLogWindow());
    await new Promise(resolve => setTimeout(resolve, 200))
    return await startServer();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

function startServer() {
  // require("systemjs");
  // require("lively.modules");
  // let rootDirectory = path.resolve(path.join(__dirname, ".."));
  // var System = lively.modules.getSystem("lively", {
  //   baseURL: `file://${rootDirectory}`
  // });
  // lively.modules.changeSystem(System, true);
  // return lively.modules.registerPackage("lively.server");
  return require("lively.server")("localhost", 9012, path.resolve(path.join(__dirname, "..")));
}

function prepareApp() {
  // fix the $PATH on macOS
  fixPath();

  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  app.on("ready", () => {
    const name = "menubar/lively-icon";
    tray = new Tray(path.join(__dirname, `${name}.png`));
    createTrayMenu();
  });
  
  app.on('window-all-closed', () => {
    console.log("all windows closed");
  });
  
  process.on('uncaughtException', console.error);
}

function createTrayMenu() {
  const menu = new Menu();

  menu.append(
    new MenuItem({
      label: "Open server log",
      click: openLogWindow
    })
  );
  menu.append(
    new MenuItem({
      label: process.platform === "darwin" ? `Quit ${app.getName()}` : "Quit",
      click: app.quit
    })
  );

  tray.setContextMenu(menu);

  return menu;
}

function recordLogMessage(type, logArgs) {
  let content = util.format(...logArgs),
      logMsg = {type, content};

  logStream.write(content + "\n");

  recentLogMessages.push(logMsg);
  if (recentLogMessages.length > 100)
    recentLogMessages.splice(0, 25);

  if (logWindow && !logWindow.isDestroyed())
    logWindow.webContents.send("log", logMsg);
}

function wrapConsole() {
  let stdoutHandler = data => recordLogMessage("stdout", [String(data)]),
      stderrHandler = data => recordLogMessage("stderr", [String(data)]),
      consoleWraps = ["log", "warn", "error"];

  process.stdout.on("data", stdoutHandler);
  process.stderr.on("data", stderrHandler);
    
  originalConsoleMethods = originalConsoleMethods || {};
  consoleWraps.forEach(selector => {
    if (!originalConsoleMethods[selector])
      originalConsoleMethods[selector] = console[selector];
    console[selector] = function(/*args*/) {
      originalConsoleMethods[selector](...arguments);
      recordLogMessage(selector, Array.from(arguments));
    }
  });
}

function openLogWindow() {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.show();
    return logWindow;
  }
  logWindow = new BrowserWindow({width: 800, height: 600, show: false});
  logWindow.loadURL("file://" + __dirname + "/logger.html");
  logWindow.once('ready-to-show', () => {
    logWindow.show();
    logWindow.webContents.send("load-log", recentLogMessages);
  })
  return logWindow;
}
