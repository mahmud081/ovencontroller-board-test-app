import { ipcRenderer } from "electron";
import { useCallback, useEffect, useState } from "react";

const PIDPage = ({
  configs,
  currentStep,
  show,
  setTestResults,
  setCurrentStep,
}) => {
  const [thermos, setThermos] = useState([
    { id: 1, label: "Thermocouple - 1", value: null },
    { id: 2, label: "Thermocouple - 2", value: null },
  ]);
  const [results, setResults] = useState([
    { id: 1, label: "Thrmocouple-1", result: null },
    { id: 2, label: "Thrmocouple-2", result: null },
  ]);

  const readValues = useCallback(async () => {
    try {
      const resp = await ipcRenderer.invoke("read-pids");
      console.log(resp);

      const readValues = resp;
      let newStates = [...thermos];
      newStates = newStates.map((v) => ({ ...v, value: readValues[v.id - 1] }));
      setThermos(newStates);
    } catch (error) {
      console.log(error);
    }
  }, []);

  useEffect(() => {
    async function initialize() {
      await readValues();
    }
    initialize();
    let interval = setInterval(async () => {
      await readValues();
    }, 1000);
    setTimeout(
      () => clearInterval(interval),
      configs["thermocouple_reading_time"] || 10000
    );
    return () => clearInterval(interval);
  }, [readValues]);

  // enable next stage
  useEffect(() => {
    let allResults = [...results].map((r) => r.result).flat(1);

    if (!allResults.some((v) => v === null)) {
      setTestResults((prevStates) => {
        let newStates = { ...prevStates };
        return { ...newStates, "thermo-couple": [...results] };
      });
      setCurrentStep(7);
    }
  }, [results]);

  //   async function onPwmChange(rowId, changedVal) {
  //     const resp = await window.helpers.pwmOutput(changedVal, rowId);
  //     console.log(resp);
  //     if (resp.err) {
  //       return;
  //     }
  //     updateState("pwmCh", rowId, changedVal);
  //   }

  return (
    <>
      {show && (
        <>
          {/* <HeaderComp title={"Thermo couple"} /> */}
          <div className="grid grid-cols-2 gap-x-8 mt-2 w-1/2">
            {thermos.map((v) => {
              let testRow = results.find((k) => k.id === v.id);
              return (
                <div key={v.id} className="col-span-1 ">
                  <div className=" flex items-center space-x-4">
                    <label className="text-xs">{v.label}</label>
                    <input
                      className="border border-gray-300 rounded-md px-4 py-1"
                      type="text"
                      readOnly
                      value={v.value}
                    />
                  </div>
                  <div className="mt-2 flex justify-between items-center pr-4">
                    <div className="flex space-x-4">
                      <span className="text-sm font-medium text-gray-600">
                        Pass
                      </span>
                      <input
                        type="checkbox"
                        checked={
                          testRow.result === null ? false : testRow.result
                        }
                        className="checkbox checkbox-success checkbox-sm"
                        onChange={() =>
                          setResults((prevStates) => {
                            let newStates = [...prevStates];
                            let found = newStates.find((f) => f.id === v.id);
                            found.result = true;
                            return newStates;
                          })
                        }
                      />
                    </div>
                    <div className="flex space-x-4">
                      <span className="text-sm font-medium text-gray-600">
                        Fail
                      </span>
                      <input
                        type="checkbox"
                        checked={
                          testRow.result === null ? false : !testRow.result
                        }
                        className="checkbox checkbox-error checkbox-sm"
                        onChange={() =>
                          setResults((prevStates) => {
                            let newStates = [...prevStates];
                            let found = newStates.find((f) => f.id === v.id);
                            found.result = false;
                            return newStates;
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
};
export default PIDPage;
