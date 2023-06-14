const { BrowserWindow, app, screen, ipcMain } = require("electron");
const path = require("path");
const ModbusRTU = require("modbus-serial");
const { SerialPort } = require("serialport");
const fs = require("fs");
const os = require("os");
const XLSX = require("xlsx");
const util = require("util");

let mainWindow;
function createWindow(width = 1024, height = 600) {
  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 1350,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const url = process.env.VITE_DEV_SERVER_URL;
  if (url) {
    mainWindow.loadURL(url);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

let client;

app.whenReady().then(() => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  createWindow(width, height);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", async () => {
  console.log("closed func");
  if (client && client.isOpen) {
    await client.close();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("before-quit", async (event) => {
  console.log("closing func");
  if (client && client.isOpen) {
    await client.close();
  }
});

// mongoose
const mongoURI =
  "mongodb+srv://oven_controller_user:oven_controller_123@cluster0.iaf7g.mongodb.net/Oven-Controller-DB?retryWrites=true&w=majority";
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const testResultSchema = new Schema(
  {
    uid: String,
    serialNo: String,
    testName: String,
    testResult: String,
    failedReason: String,
    flickerdValues: String,
  },
  { timestamps: true }
);

const TestResultModel = mongoose.model("TestResults", testResultSchema);

// get configs
ipcMain.handle("get-configs", async (e) => {
  console.log("get configs");
  const configPath = path.join(__dirname, "..", "public", "config.json");
  const configContent = await fs.promises.readFile(configPath, "utf-8");
  const config = JSON.parse(configContent);
  console.log(config);
  // await new Promise((res) => setTimeout(() => res(), 1000));
  return config;
});

// fecth ports list
ipcMain.handle("fetch-ports", async (e) => {
  try {
    const ports = await SerialPort.list();
    return ports;
  } catch (error) {
    throw new Error(error.message);
  }
});

// connect board
let serialPath = "";

async function instantiateClient() {
  if (client && client.isOpen) {
    await client.close();
  }
  client = new ModbusRTU();
  await client.connectRTUBuffered(serialPath, {
    baudRate: 9600,
    parity: "even",
    // dataBits: 8,
    // stopBits: 1,
  });
  await client.setID(1, true);
  await client.setTimeout(2000);
}

async function resetClient() {
  if (client && client.isOpen) {
    await client.close();
  } else {
    await instantiateClient();
  }
}
ipcMain.handle("reset-client", async (e) => {
  await instantiateClient();
});

ipcMain.handle("connect-board", async (e, path) => {
  serialPath = path;
  const respose = { success: true, uidArr: [], msg: "" };
  await instantiateClient();

  try {
    const uidArr = await client.readInputRegisters(30, 6);
    respose.uidArr = uidArr;
    return respose;
  } catch (error) {
    console.log(error);
    mainWindow.webContents.send(
      "message-from-main",
      "Timeout error or connection error occured"
    );
    throw new Error(error.message);
  }
});

ipcMain.handle("disconnect", async (e) => {
  if (client.isOpen) {
    await client.close();
  }
  return;
});

// find prev board
ipcMain.handle("find-prev-board", async (e, boardUid) => {
  console.log("board uid", boardUid);
  let prevData;
  await mongoose
    .connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(async (db) => {
      const data = await TestResultModel.findOne({ uid: boardUid }).exec();
      prevData = data;
      await db.disconnect();
    });
  return prevData;
});

// digital ior read

ipcMain.handle("read-dig-ior", async (e) => {
  try {
    const outputs = await client.readCoils(8, 4);
    await new Promise((res) => setTimeout(() => res(), 50));
    const inputs = await client.readDiscreteInputs(0, 4);
    await new Promise((res) => setTimeout(() => res(), 50));
    const relays = await client.readCoils(12, 5);
    console.log(outputs, inputs, relays);
    return {
      inputs: [...inputs.data.slice(0, 4)],
      outputs: [...outputs.data.slice(0, 4)],
      relays: [...relays.data.slice(0, 5)],
    };
  } catch (error) {
    mainWindow.webContents.send("message-from-main", error.message);
    throw new Error(error.message);
  }
});

const digitalOutputs = {
  1: 8,
  2: 9,
  3: 10,
  4: 11,
};

// write digout
ipcMain.handle("write-dig-out", async (e, outputId, writeVal) => {
  try {
    // await new Promise((res) => setTimeout(() => res(), 200));
    await client.writeCoil(digitalOutputs[outputId], writeVal);
  } catch (error) {
    mainWindow.webContents.send("message-from-main", error.message);
    throw new Error(error.message);
  }
});

//write relay
const relays = {
  1: 12,
  2: 13,
  3: 14,
  4: 15,
  5: 16,
};
ipcMain.handle("write-relay", async (e, outputId, writeVal) => {
  try {
    // await new Promise((res) => setTimeout(() => res(), 200));
    await client.writeCoil(relays[outputId], writeVal);
  } catch (error) {
    mainWindow.webContents.send("message-from-main", error.message);
    throw new Error(error.message);
  }
});

// enable current mode
const enableCurrModeAddrIn = {
  1: 54,
  2: 55,
};
const enableCurrModeAddrOut = {
  1: 74,
  2: 77,
};
const enableAnalogAddr = {
  1: 6,
  2: 7,
};
ipcMain.handle("enable-current-mode", async (e, outputId) => {
  try {
    //enable output
    await client.writeCoil(enableAnalogAddr[outputId], 1);
    console.log("output enabled");
    await new Promise((res) => setTimeout(() => res(), 100));

    // enable input current mode
    await client.writeRegister(enableCurrModeAddrIn[outputId], 1);
    console.log("input curr mode enabled");
    // enable output current mode
    await new Promise((res) => setTimeout(() => res(), 100));
    await client.writeRegister(enableCurrModeAddrOut[outputId], 1);
    console.log("output curr mode enabled");
  } catch (error) {
    console.log(error);
    mainWindow.webContents.send("message-from-main", error.message);
    throw new Error(error.message);
  }
});
ipcMain.handle("enable-voltage-mode", async (e, outputId) => {
  try {
    // enable input current mode
    await client.writeRegister(enableCurrModeAddrIn[outputId], 2);

    // enable output current mode
    await new Promise((res) => setTimeout(() => res(), 100));
    await client.writeRegister(enableCurrModeAddrOut[outputId], 2);
  } catch (error) {
    console.log(error);
    mainWindow.webContents.send("message-from-main", error.message);
    throw new Error(error.message);
  }
});

const analogOutput = {
  1: 30,
  2: 32,
};

ipcMain.handle("write-analog-output", async (e, outputId, outputVal) => {
  try {
    // await new Promise((res) => setTimeout(() => res(), 200));
    await client.writeRegister(analogOutput[outputId], outputVal);
  } catch (error) {
    mainWindow.webContents.send("message-from-main", error.message);
    throw new Error(error.message);
  }
});

// read analog inputs

ipcMain.handle("read-analog-input", async (e) => {
  try {
    const inp = await client.readInputRegisters(6, 2);

    console.log("inputs", inp);
    return inp.data;
  } catch (error) {
    mainWindow.webContents.send("message-from-main", error.message);
    throw new Error(error.message);
  }
});

// traics

ipcMain.handle("set-triac-init", async (e) => {
  try {
    await client.writeRegister(51, 50);

    await new Promise((res) => setTimeout(() => res(), 100));

    await client.writeRegister(56, 1300);

    console.log("init values set");
  } catch (error) {
    console.error("setting triac initi values error", error);
    mainWindow.webContents.send("message-from-main", error.message);
    throw new Error(error.message);
  }
});

ipcMain.handle("enable-traics", async (e) => {
  try {
    await client.writeCoil(4, true);
    await new Promise((res) => setTimeout(() => res(), 100));
    await client.writeCoil(5, true);
    console.log("triac enabled");
  } catch (error) {
    console.error("triac enable error", error);
    mainWindow.webContents.send("message-from-main", error.message);
    throw new Error(error.message);
  }
});

// read line freq

ipcMain.handle("read-line-frequency", async (e) => {
  try {
    const inp = await client.readInputRegisters(25, 1);
    console.log(inp);
    return inp.data[0];
  } catch (error) {
    mainWindow.webContents.send("message-from-main", error.message);
    throw new Error("error", error.message);
  }
});

//read triac currents

ipcMain.handle("read-triacs-current", async (e) => {
  try {
    let triac1 = await client.readInputRegisters(17, 1);
    await new Promise((res) => setTimeout(() => res(), 100));
    let triac2 = await client.readInputRegisters(21, 1);
    console.log(triac1, triac2);
    return [triac1.data[0], triac2.data[0]];
  } catch (error) {
    mainWindow.webContents.send("message-from-main", error.message);
    throw new Error(error.message);
  }
});

//write triacs
const triacsAddr = {
  1: 22,
  2: 26,
};
ipcMain.handle("write-triac", async (e, triacVal, triacId) => {
  try {
    await client.writeRegister(triacsAddr[triacId], triacVal);
  } catch (error) {
    console.error("trac wirite fail", error);
    mainWindow.webContents.send("message-from-main", error.message);
    throw new Error(error.message);
  }
});

// read thermocouples
ipcMain.handle("read-pids", async (e) => {
  try {
    let th1 = await client.readInputRegisters(4, 1);
    await new Promise((res) => setTimeout(() => res(), 100));
    let th2 = await client.readInputRegisters(5, 1);

    return [th1.data[0], th2.data[0]];
  } catch (error) {
    console.log("reeading thermo", error);
    mainWindow.webContents.send("message-from-main", error.message);
    throw new Error(error.message);
  }
});

// enable pwm
ipcMain.handle("enable-pwms", async (e) => {
  try {
    await client.writeCoil(0, true);
    await new Promise((res) => setTimeout(() => res(), 100));
    await client.writeCoil(1, true);
  } catch (error) {
    console.error("pwm enable error", error);
    mainWindow.webContents.send("message-from-main", error.message);
    throw new Error(error.message);
  }
});

// set sourcce
ipcMain.handle("set-pwms-source", async (e) => {
  try {
    await client.writeRegister(1, 1);
    await new Promise((res) => setTimeout(() => res(), 100));
    await client.writeRegister(3, 1);
  } catch (error) {
    console.error("pwm source setting error", error);
    mainWindow.webContents.send("message-from-main", error.message);
    throw new Error(error.message);
  }
});

//write pwm
const pwms = {
  1: 2,
  2: 4,
};
ipcMain.handle("pwm-output", async (e, outVal, pwmId) => {
  try {
    await client.writeRegister(pwms[pwmId], outVal);
  } catch (error) {
    console.error("pwm wirite fail", error);
    mainWindow.webContents.send("message-from-main", error.message);
    throw new Error(error.message);
  }
});

const writeFileAsync = util.promisify(fs.writeFile);
ipcMain.handle("save-to-excel", async (e, testData, serialNo, boardUid) => {
  let filePath = process.env.VITE_DEV_SERVER_URL
    ? path.join(__dirname, "../TestResults.xlsx")
    : path.join(os.homedir(), "TestResults.xlsx");

  let data = testData.map((m) => ({ uid: boardUid, sL: serialNo, ...m }));
  let workbook,
    dataforDb = data.map((d) => ({
      ...d,
      failedReason: d.hasOwnProperty("failedReason")
        ? JSON.stringify(d.failedReason)
        : "",
    }));

  data = data.map((d) => {
    let row = [];
    row.push(d.uid);
    row.push(d.sL);
    row.push(d.testName);
    row.push(d.result);
    if (d.hasOwnProperty("failedReason")) {
      row.push(JSON.stringify(d.failedReason));
    }
    if (d.hasOwnProperty("filckeredValues")) {
      row.push(JSON.stringify(d.filckeredValues));
    }
    return row;
  });
  if (fs.existsSync(filePath)) {
    workbook = XLSX.readFile(filePath);
  } else {
    workbook = XLSX.utils.book_new();
    data.unshift([
      "UID",
      "SL No",
      "Test Name",
      "Result",
      "Failed Reason",
      "Flicekerd Values",
    ]);
  }

  const worksheet =
    workbook.SheetNames.length > 0
      ? workbook.Sheets[workbook.SheetNames[0]]
      : XLSX.utils.book_append_sheet(
          workbook,
          XLSX.utils.aoa_to_sheet([]),
          "Results"
        );

  const existingData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  const updatedData = existingData.concat(data);

  const updatedWorksheet = XLSX.utils.aoa_to_sheet(updatedData);

  workbook.Sheets[workbook.SheetNames[0]] = updatedWorksheet;
  const fileBuff = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  await writeFileAsync(filePath, fileBuff);

  let db;
  await mongoose
    .connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(async (database) => {
      db = database;
      console.log("db connected");
      await TestResultModel.insertMany(dataforDb)
        .then(() => console.log("data saved"))
        .catch((err) => console.log("data saving err", err))
        .finally(async () => await database.disconnect());

      console.log("Data saved");
    })
    .catch((err) => console.log("Mongoose error", err));
  await db.disconnect();

  return { success: true };
});

ipcMain.handle("view-results", async (e) => {
  let allData;
  await mongoose
    .connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(async (db) => {
      const data = await TestResultModel.find({});
      allData = data;
      await db.disconnect();
    });
  return allData;
});

ipcMain.handle("factory-reset", async (e) => {
  try {
    await client.writeCoil(19, 1);
  } catch (error) {
    console.error(error);
    throw new Error(error.message);
  }
});
