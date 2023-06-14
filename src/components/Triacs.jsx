import { ipcRenderer } from "electron";
import { useCallback, useEffect, useState } from "react";
import LoadingComp from "./LoadingComp";

const Triacs = ({
  configs,
  currentStep,
  show,
  setTestResults,
  setCurrentStep,
}) => {
  const [lineFrequency, setLineFrequency] = useState([
    { id: 1, label: "Line frequency", value: null },
  ]);

  const [triacs, setTriacs] = useState([
    {
      id: 1,
      inputValue: 0,
      labels: [5, 6, 18, 50, 75, 100],
      outputValues: [5, 6, 18, 50, 75, 100],
      references: configs["triac_1_ref"],
      tolerance: configs["triac_1_tolerance"],
      enabled: false,
      isPressed: [false, false, false, false, false],
    },
    {
      id: 2,
      inputValue: 0,
      labels: [5, 6, 18, 50, 75, 100],
      outputValues: [5, 6, 18, 50, 75, 100],
      references: configs["triac_2_ref"],
      tolerance: configs["triac_2_tolerance"],
      enabled: false,
      isPressed: [false, false, false, false, false],
    },
  ]);

  const [results, setResults] = useState([
    {
      id: 1,
      label: "Triac-1",
      result: [null, null, null, null, null, null],
      isFlickering: false,
      filckeredValues: [],
      failedReason: [],
    },
    {
      id: 2,
      label: "Triac-2",
      result: [null, null, null, null, null, null],
      isFlickering: false,
      filckeredValues: [],
      failedReason: [],
    },
  ]);

  const [resultLineFreq, setResultLineFreq] = useState([
    { id: 1, label: "Line Frequency", result: null },
  ]);

  const [isLoading, setIsLoading] = useState(false);

  const readTriacsCurrent = useCallback(async () => {
    try {
      const resp = await ipcRenderer.invoke("read-triacs-current");
      console.log("tr curr", resp);
      let newTriacValues = [...triacs].map((v) => {
        return { ...v, inputValue: resp[v.id - 1] };
      });
      setTriacs(newTriacValues);
    } catch (error) {
      console.log(error);
    }
  }, []);

  const readLineFrequency = useCallback(async () => {
    try {
      setIsLoading(true);
      const resp = await ipcRenderer.invoke("read-line-frequency");
      console.log("len frequency", parseInt(resp / 100));

      let newFreqs = [...lineFrequency].map((l) => ({
        ...l,
        value: (resp / 100).toFixed(1),
      }));
      setLineFrequency(newFreqs);
      let lowerValue50 = 50 * (1 - configs["line_freq_tolerance"]),
        higherValue50 = 50 * (1 + configs["line_freq_tolerance"]);
      let lowerValue60 = 60 * (1 - configs["line_freq_tolerance"]),
        higherValue60 = 60 * (1 + configs["line_freq_tolerance"]);

      if (
        (resp / 100 >= lowerValue50 || resp / 100 >= lowerValue60) &&
        (resp / 100 <= higherValue50 || resp / 100 <= higherValue60)
      ) {
        updateLinResult(true);
      } else {
        updateLinResult(false);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateLinResult = (changedVal) => {
    let newStates = [...resultLineFreq];
    newStates[0].result = changedVal;
    setResultLineFreq(newStates);
  };

  const enableTriacs = useCallback(async () => {
    setIsLoading(true);
    const resp = await ipcRenderer.invoke("enable-traics");
    console.log(resp);
    setIsLoading(false);
  }, []);

  const initValues = async () => {
    setIsLoading(true);
    await ipcRenderer.invoke("set-triac-init");
    setIsLoading(false);
  };

  useEffect(() => {
    async function inittialize() {
      try {
        setIsLoading(true);
        await initValues();
        await new Promise((res) => setTimeout(() => res(), 100));
        await enableTriacs();
        await new Promise((res) => setTimeout(() => res(), 100));

        await readLineFrequency();
        await new Promise((res) => setTimeout(() => res(), 100));

        // await readTriacsCurrent();
        // await new Promise((res) => setTimeout(() => res(), 100));
      } catch (error) {
        console.log(error);
      } finally {
        setIsLoading(false);
      }
    }
    inittialize();
  }, [enableTriacs, readTriacsCurrent, readLineFrequency]);

  async function onOutputChange(rowId, changedVal, trIdx) {
    try {
      setTriacs((prevStates) => {
        let newStates = [...prevStates];
        let found = newStates.find((f) => f.id === rowId);
        found.isPressed[trIdx] = true;
        return newStates;
      });
      setIsLoading(true);
      const resp = await ipcRenderer.invoke("write-triac", changedVal, rowId);

      console.log(resp);
      await new Promise((res) =>
        setTimeout(() => res(), configs[`triac_${rowId}_read_delay`] || 3000)
      );

      const inputCurrs = await ipcRenderer.invoke("read-triacs-current");
      let newTriacValues = [...triacs].map((v) => {
        return { ...v, inputValue: inputCurrs[v.id - 1] };
      });
      setTriacs(newTriacValues);

      const changedInput = triacs.find((f) => f.id === rowId);
      const triacInput = inputCurrs[rowId - 1];
      console.log("input", triacInput);
      console.log("changed val", changedVal);
      console.log(
        "check",
        changedInput.references[changedVal]["val"] -
          changedInput.tolerance[changedVal]["val"],
        changedInput.references[changedVal]["val"] +
          changedInput.tolerance[changedVal]["val"]
      );
      if (
        triacInput >=
          changedInput.references[changedVal]["val"] -
            changedInput.tolerance[changedVal]["val"] &&
        triacInput <=
          changedInput.references[changedVal]["val"] +
            changedInput.tolerance[changedVal]["val"]
      ) {
        updateResult(rowId, true, trIdx);
      } else {
        updateResult(rowId, false, trIdx, {
          dutyCycle: changedInput.labels[trIdx],
          loadCurrent: changedInput.inputValue,
          referenceCurrent: changedInput.references[changedVal]["val"],
        });
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  }

  //"triacs", rowId, true, trIdx
  const updateResult = (triacId, changeVal, trIndex, failedObj) => {
    let newResults = [...results];
    let refTriac = triacs.find((f) => f.id == triacId);
    let rFound = newResults.find((f) => f.id === triacId);
    rFound.result[trIndex] = changeVal;
    if (!changeVal) {
      if (
        rFound.failedReason.findIndex(
          (f) => f.dutyCycle == refTriac.labels[trIndex]
        ) === -1
      ) {
        rFound.failedReason.push(failedObj);
      }
    }

    setResults(newResults);
  };
  function onFlickeringChange(rowId, cheeckedValue, flickerValue) {
    setResults((prevState) => {
      let testArr = [...prevState],
        found = testArr.find((f) => f.id === rowId);
      console.log(
        found,
        !cheeckedValue && found.filckeredValues.includes(flickerValue)
      );
      if (cheeckedValue && !found.filckeredValues.includes(flickerValue)) {
        found.filckeredValues.push(flickerValue);
      } else if (
        !cheeckedValue &&
        found.filckeredValues.includes(flickerValue)
      ) {
        found.filckeredValues.splice(
          found.filckeredValues.indexOf(flickerValue),
          1
        );
      }
      return testArr;
    });
  }

  // enable next stage
  useEffect(() => {
    let allResults = [...results].map((r) => [...r.result]).flat(1);
    console.log("all", allResults, currentStep);
    if (!allResults.some((v) => v === null)) {
      setTestResults((prevStates) => {
        let newStates = { ...prevStates };
        return {
          ...newStates,
          trriacs: [...results],
          "line-freq": [...resultLineFreq],
        };
      });
      setCurrentStep(5);
    }
  }, [results]);

  const onRefreshHandler = async () => {
    await readLineFrequency();
  };
  return (
    <>
      {/* {JSON.stringify(testResults)} */}
      {show && (
        <>
          {/* <HeaderComp title={"Triacs"} /> */}

          <div className="flex items-center justify-end px-4 mt-2">
            <div>
              <div className=" flex items-center space-x-4">
                <label className="label-text">Line Frequency</label>
                <input
                  className="border border-gray-300 rounded-md px-4 py-1"
                  type="text"
                  readOnly
                  value={lineFrequency[0].value}
                />
                <button
                  onClick={onRefreshHandler}
                  className="btn btn-square btn-xs btn-outline"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                    />
                  </svg>
                </button>
              </div>
              <div className="flex items-center justify-between mt-2 mb-2">
                <div className="flex space-x-4">
                  <span className="text-sm font-medium text-gray-600">
                    Pass
                  </span>
                  <input
                    type="checkbox"
                    checked={
                      resultLineFreq[0].result === null
                        ? false
                        : resultLineFreq[0].result
                    }
                    className="checkbox checkbox-success checkbox-sm"
                    onChange={() => {}}
                  />
                </div>
                <div className="flex space-x-4">
                  <span className="text-sm font-medium text-gray-600">
                    Fail
                  </span>
                  <input
                    type="checkbox"
                    checked={
                      resultLineFreq[0].result === null
                        ? false
                        : !resultLineFreq[0].result
                    }
                    className="checkbox checkbox-error checkbox-sm"
                    onChange={() => updateResult("lineFreq", 1, false)}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-y-4 relative">
            {isLoading && <LoadingComp />}
            {triacs.map((v) => {
              let testRow = results.find((k) => k.id === v.id);
              return (
                <div
                  key={v.id}
                  className="col-span-1 border-r border-gray-200 pl-2"
                >
                  <div className=" flex items-center space-x-4 pl-24">
                    <label className="label-text">{"Triac-" + v.id}</label>
                    <input
                      className="border border-gray-300 rounded-md px-4 py-1"
                      type="text"
                      readOnly
                      value={v.inputValue}
                    />
                    <span>mA</span>
                  </div>
                  <div className="flex space-x-4 mt-2 items-center justify-between mr-4 pl-24">
                    {v.outputValues.map((outVal, idx) => (
                      <button
                        className={`btn btn-sm normal-case ${
                          !v.isPressed[idx] && "btn-outline"
                        }`}
                        onClick={() => onOutputChange(v.id, outVal, idx)}
                      >
                        {v.labels[idx] + " %"}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center space-x-8 mt-2">
                    <span className="text-sm font-semibold text-gray-600">
                      Pass/Fail
                    </span>
                    <div className="flex items-center justify-between pr-4 flex-1">
                      {testRow["result"].map((res, idx) => (
                        <div className="flex space-x-3">
                          <input
                            type="checkbox"
                            checked={res === null ? false : res}
                            className="checkbox checkbox-success checkbox-sm"
                            onChange={() => {}}
                          />
                          <input
                            type="checkbox"
                            checked={res === null ? false : !res}
                            className="checkbox checkbox-error checkbox-sm"
                            onChange={() => {}}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center space-x-8 mt-2">
                    <span className="text-sm font-semibold text-gray-600">
                      Is Flickeering?
                    </span>
                    <div className="flex-1 flex items-center justify-between pr-4">
                      {v.outputValues.map((outVal, idx) => (
                        <input
                          type="checkbox"
                          checked={testRow.filckeredValues.includes(outVal)}
                          className="checkbox checkbox-success checkbox-sm"
                          onChange={(e) =>
                            onFlickeringChange(v.id, e.target.checked, outVal)
                          }
                        />
                      ))}
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
export default Triacs;
