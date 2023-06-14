import { useCallback, useEffect, useState } from "react";
import LoadingComp from "./LoadingComp";
import { ipcRenderer } from "electron";

const DigitalIo = ({
  currentStep,
  show,
  testResults,
  setTestResults,
  setCurrentStep,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const [digIo, setDigIo] = useState([
    { id: 1, inputVal: "", outputVal: "", relayVal: "" },
    { id: 2, inputVal: "", outputVal: "", relayVal: "" },
    { id: 3, inputVal: "", outputVal: "", relayVal: "" },
    { id: 4, inputVal: "", outputVal: "", relayVal: "" },
    { id: 5, inputVal: "", outputVal: "", relayVal: "" },
  ]);
  const [results, setResults] = useState([
    { id: 1, result: null },
    { id: 2, result: null },
    { id: 3, result: null },
    { id: 4, result: null },
    { id: 5, result: null },
  ]);

  const readValues = useCallback(async () => {
    try {
      setIsLoading(true);
      const results = await ipcRenderer.invoke("read-dig-ior");
      results["inputs"].push(0);
      results["outputs"].push(0);
      console.log(results);
      const newStates = [...digIo].map((statVal) => ({
        ...statVal,
        inputVal: results["inputs"][statVal.id - 1],
        outputVal: results["outputs"][statVal.id - 1],
        relayVal: results["relays"][statVal.id - 1],
      }));
      setDigIo(newStates);
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log("initial read values");
    readValues();
  }, [readValues]);

  // update local results
  useEffect(() => {
    console.log("results run");
    let newResults = [...results];
    let relay5 = digIo.find((f) => f.id == 5)["relayVal"];
    console.log("relay 5", relay5);
    if (relay5) {
      digIo.forEach((ioVal) => {
        if (ioVal.id == 5) {
          return;
        }
        if (ioVal.id === 4) {
          if (ioVal.outputVal == 1) {
            newResults[ioVal.id]["result"] = true;
          }
        } else {
          if (
            ioVal.outputVal == 1 &&
            ioVal.inputVal == 1 &&
            ioVal.relayVal == 1
          ) {
            newResults[ioVal.id - 1]["result"] = true;
          } else {
            newResults[ioVal.id - 1]["result"] = false;
          }
        }
      });
    } else {
      digIo.forEach((ioVal) => {
        if (ioVal.id == 5) {
          return;
        }
        if (
          ioVal.outputVal == 1 &&
          ioVal.inputVal == 1 &&
          ioVal.relayVal == 1
        ) {
          newResults[ioVal.id - 1]["result"] = true;
        } else {
          newResults[ioVal.id - 1]["result"] = false;
        }
      });
    }

    setResults(newResults);
  }, [digIo]);

  const onOutputChange = async (outputId, writeVal) => {
    try {
      setIsLoading(true);
      await ipcRenderer.invoke("write-dig-out", outputId, writeVal);
      await new Promise((res) => setTimeout(() => res(), 50));
      console.log("write compltet");
      await readValues();
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };
  const onRelayChange = async (outputId, writeVal) => {
    try {
      setIsLoading(true);
      if (outputId == 4) {
        await ipcRenderer.invoke("write-relay", 5, 0);
        await new Promise((res) => setTimeout(() => res(), 50));
      }
      if (outputId == 5) {
        await ipcRenderer.invoke("write-relay", 4, 0);
        await new Promise((res) => setTimeout(() => res(), 50));
        await ipcRenderer.invoke("write-dig-out", 4, 0);
        await new Promise((res) => setTimeout(() => res(), 50));
      }
      await ipcRenderer.invoke("write-relay", outputId, writeVal);
      await new Promise((res) => setTimeout(() => res(), 50));
      console.log("write complete");

      await readValues();
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  // next step
  useEffect(() => {
    if (!results.some((r) => r.result == null) && currentStep == 2) {
      setTestResults((prevStates) => {
        let newStates = { ...prevStates };
        return { ...newStates, "dig-io": [...results] };
      });
      setCurrentStep(3);
    }
  }, [results]);

  return (
    <>
      {show && (
        <div className="grid grid-cols-4 gap-x-4 relative w-1/2">
          {isLoading && <LoadingComp />}
          {/** digital output */}
          <div className="col-span-1">
            <h3 className="text-sm font-medium text-gray-600">
              Digital Output
            </h3>
            <div className="flex flex-col">
              {digIo
                .map((v) => v.outputVal)
                .map((v, idx) => {
                  if (idx === 4) {
                    return <></>;
                  } else {
                    return (
                      <label
                        key={"dig-out-" + idx}
                        className="cursor-pointer inline-flex items-center space-x-4 mb-[6px] mt-2"
                      >
                        <span className="label-text text-sm">
                          {"Dig Out-" + (idx + 1)}
                        </span>
                        <input
                          type="checkbox"
                          className="toggle toggle-accent toggle-sm"
                          checked={v === "" ? false : v}
                          onChange={({ target: { checked } }) =>
                            onOutputChange(idx + 1, checked)
                          }
                        />
                      </label>
                    );
                  }
                })}
            </div>
          </div>
          {/** end digital output */}

          {/** relays */}
          <div className="col-span-1">
            <h3 className="text-sm font-medium text-gray-600">Relays</h3>
            <div className="flex flex-col">
              {digIo
                .map((v) => v.relayVal)
                .map((v, idx) => {
                  return (
                    <label
                      key={"relay-" + idx}
                      className="cursor-pointer inline-flex items-center space-x-4 mb-[6px] mt-2"
                    >
                      <span className="label-text text-sm">
                        {"Relay-" + (idx + 1)}
                      </span>
                      <input
                        type="checkbox"
                        className="toggle toggle-accent toggle-sm"
                        checked={v === "" ? false : v}
                        onChange={({ target: { checked } }) =>
                          onRelayChange(idx + 1, checked)
                        }
                      />
                    </label>
                  );
                })}
            </div>
          </div>
          {/** end relays */}

          {/** digital inputs */}
          <div className="col-span-1">
            <h3 className="text-sm font-medium text-gray-600">
              Digital Inputs
            </h3>
            {digIo
              .map((v) => v.inputVal)
              .map((v, idx) => (
                <label
                  key={"dig-inp-" + idx}
                  className="cursor-pointer flex items-center space-x-4 mb-[14px] mt-2"
                >
                  <span className="label-text text-sm">
                    {"Dig Input-" + (idx + 1)}
                  </span>
                  <div
                    className={`w-4 h-4 rounded-full ${
                      v == true ? "bg-green-600" : "bg-rose-500"
                    } `}
                  ></div>
                </label>
              ))}
          </div>
          {/** end digital inputs */}

          {/** pass fail */}
          <div className="col-span-1">
            <h3 className="text-sm font-medium text-gray-600 flex items-center space-x-6">
              <span>Pass</span>
              <span>Fail</span>
            </h3>
            {results.map((v) => {
              return (
                <div key={v.id} className="space-x-10 mt-2 mb-[9px]">
                  <input
                    type="checkbox"
                    checked={v.result === null ? false : v.result}
                    className="checkbox checkbox-sm checkbox-success"
                    onChange={() => {}}
                  />
                  <input
                    type="checkbox"
                    checked={v.result == null ? false : !v.result}
                    className="checkbox checkbox-sm checkbox-error"
                    onChange={() => {}}
                  />
                </div>
              );
            })}
          </div>
          {/** end pass fail */}
        </div>
      )}
    </>
  );
};
export default DigitalIo;
