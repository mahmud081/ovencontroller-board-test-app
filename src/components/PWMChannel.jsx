import { ipcRenderer } from "electron";
import { useCallback, useEffect, useState } from "react";
import LoadingComp from "./LoadingComp";

const PWMChannel = ({
  configs,
  currentStep,
  show,
  setTestResults,
  setCurrentStep,
}) => {
  const [pwms, setPwms] = useState([
    { id: 1, label: "PWM CH - 1", value: null },
    { id: 2, label: "PWM CH - 2", value: null },
  ]);

  const [results, setResults] = useState([
    { id: 1, label: "PWM CH-1", result: null, failed: null },
    { id: 2, label: "PWM CH-2", result: null, failed: null },
  ]);

  const [isLoading, setIsLoading] = useState(false);

  const enablePwms = useCallback(async () => {
    try {
      setIsLoading(true);
      const resp = await ipcRenderer.invoke("enable-pwms");
      console.log("pwm enabled");
      await new Promise((res) => setTimeout(() => res(), 50));
      await ipcRenderer.invoke("set-pwms-source");
      console.log("pwm source changed");
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    enablePwms();
  }, [enablePwms]);

  // enable next stage
  useEffect(() => {
    let allResults = [...results.map((r) => r.result).flat(1)];

    if (!allResults.some((v) => v === null)) {
      setTestResults((prevStates) => {
        let newStates = { ...prevStates };
        return { ...newStates, pwm: [...results] };
      });
      setCurrentStep(6);
    }
  }, [results]);

  const onStartHandler = async (rowId) => {
    try {
      let resp = await ipcRenderer.invoke("pwm-output", 2075, rowId);
      console.log(resp);

      let newStates, found;
      newStates = [...pwms];
      found = newStates.find((f) => f.id === rowId);
      found.value = 2075;
      setPwms(newStates);

      await new Promise((res) => setTimeout(() => res(), 5000));

      resp = await ipcRenderer.invoke("pwm-output", 4095, rowId);
      console.log(resp);

      newStates = [...pwms];
      found = newStates.find((f) => f.id === rowId);
      found.value = 4095;
      setPwms(newStates);
    } catch (error) {
      console.log(error);
    }
  };

  // "pwmCh", v.id, true
  const updateResult = (rowId, changeVal) => {
    let newResults = [...results].map((r) => {
      if (r.id === rowId) {
        return { ...r, result: changeVal };
      } else {
        return { ...r };
      }
    });
    setResults(newResults);
  };

  const updateFail = (value, rowId) => {
    setResults((prevState) => {
      let testArr = [...prevState],
        found = testArr.find((f) => f.id === rowId);
      found.failed = value;
      return [...testArr];
    });
  };

  return (
    <>
      {show && (
        <>
          {/* <HeaderComp title={"PWM Channels"} /> */}
          <div className="grid grid-cols-2 gap-x-6 mt-2 relative w-1/2">
            {isLoading && <LoadingComp />}
            {pwms.map((v) => {
              let testRow = results.find((k) => k.id === v.id);
              return (
                <div key={v.id} className="col-span-1">
                  <div className=" flex items-center space-x-4">
                    <label className="label-text">{v.label}</label>
                    <input
                      className="border border-gray-300 rounded-md px-4 py-1"
                      type="text"
                      readOnly
                      value={v.value}
                    />
                  </div>
                  <div className="flex space-x-4 mt-2 items-center justify-between pr-4">
                    <button
                      className="btn btn-sm normal-case"
                      onClick={() => onStartHandler(v.id)}
                    >
                      Start
                    </button>
                  </div>
                  <div className="mt-2 flex justify-between items-center pr-4">
                    <p className="text-sm">
                      It will blink for 5s and after that will be always on
                    </p>
                    <div className="flex items-center space-x-4">
                      <div className="flex space-x-2">
                        <span className="text-sm font-medium text-gray-600">
                          Pass
                        </span>
                        <input
                          type="checkbox"
                          checked={
                            testRow.result === null ? false : testRow.result
                          }
                          className="checkbox checkbox-success checkbox-sm"
                          onChange={() => updateResult(v.id, true)}
                        />
                      </div>
                      <div className="flex space-x-2">
                        <span className="text-sm font-medium text-gray-600">
                          Fail
                        </span>
                        <input
                          type="checkbox"
                          checked={
                            testRow.result === null ? false : !testRow.result
                          }
                          className="checkbox checkbox-error checkbox-sm"
                          onChange={() => updateResult(v.id, false)}
                        />
                      </div>
                    </div>
                  </div>
                  {testRow.result != null && testRow.result == false && (
                    <div className="flex items-center space-x-5">
                      <label className="label cursor-pointer">
                        <span className="label-text mr-2">Always on</span>
                        <input
                          type="radio"
                          name="radio-10"
                          className="radio checked:bg-red-500 radio-sm"
                          onChange={(e) => updateFail("always on", v.id)}
                        />
                      </label>
                      <label className="label cursor-pointer">
                        <span className="label-text mr-2">Always Blinking</span>
                        <input
                          type="radio"
                          name="radio-10"
                          className="radio checked:bg-blue-500 radio-sm"
                          onChange={(e) => updateFail("always blinking", v.id)}
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
};
export default PWMChannel;
