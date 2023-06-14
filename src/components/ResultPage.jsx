import { ipcRenderer } from "electron";
import { useEffect, useState } from "react";

// {
//     "dig-io": [
//       { id: 1, result: true },
//       { id: 2, result: true },
//       { id: 3, result: true },
//       { id: 4, result: true },
//       { id: 5, result: true },
//     ],
//     "analog-io": [
//       {
//         id: 1,
//         label: "Triac-1",
//         result: [false, false, false, false, false, false],
//         isFlickering: false,
//         filckeredValues: [],
//         failedReason: [
//           { label: 5, value: false },
//           { label: 6, value: false },
//           { label: 18, value: false },
//           { label: 50, value: false },
//           { label: 75, value: false },
//           { label: 100, value: false },
//         ],
//       },
//       {
//         id: 2,
//         label: "Triac-2",
//         result: [false, false, false, false, false, false],
//         isFlickering: false,
//         filckeredValues: [],
//         failedReason: [
//           { label: 5, value: false },
//           { label: 6, value: false },
//           { label: 18, value: false },
//           { label: 50, value: false },
//           { label: 75, value: false },
//           { label: 100, value: false },
//         ],
//       },
//     ],
//     "line-freq": [{ id: 1, label: "Line Frequency", result: false }],
//     pwm: [
//       { id: 1, label: "PWM CH-1", result: true, failed: null },
//       { id: 2, label: "PWM CH-2", result: true, failed: null },
//     ],
//     "thermo-couple": [
//       { id: 1, label: "Thrmocouple-1", result: true },
//       { id: 2, label: "Thrmocouple-2", result: true },
//     ],
//   }
const ResultsPage = ({
  show,
  testResults,
  boardUid,
  serialNo,
  setTestResults,
  setCurrentStep,
  setIsConnected,
  setBoardUid,
  setSerialNo,
}) => {
  const [resultArr, setResultArr] = useState([]);

  const [loading, setLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    let data = [];

    Object.entries(testResults).map(([key, testVal]) => {
      let resultStr = "";
      testVal.forEach((test) => {
        let row = {
          testName: "",
          result: "",
          failedReason: { current: [], voltage: [] },
          filckeredValues: [],
        };
        if (test.hasOwnProperty("currentResults")) {
          if (test.currentResults.some((f) => f === false)) {
            resultStr = "Failed";
          } else {
            resultStr = "Passed";
          }
        }
        if (test.hasOwnProperty("voltageResults")) {
          if (test.currentResults.some((f) => f === false)) {
            resultStr = "Failed";
          } else {
            resultStr = "Passed";
          }
        }
        if (test.hasOwnProperty("result") && typeof test.result == "object") {
          if (test.result.some((f) => f === false)) {
            resultStr = "Failed";
          } else {
            resultStr = "Passed";
          }
        }
        if (test.hasOwnProperty("result") && typeof test.result == "boolean") {
          if (test.result == true) {
            resultStr = "Passed";
          } else {
            resultStr = "Failed";
          }
        }
        if (test.hasOwnProperty("failedReasonCurr")) {
          row.failedReason.current = test.failedReasonCurr;
        }
        if (test.hasOwnProperty("failedReasonVolt")) {
          row.failedReason.voltage = test.failedReasonVolt;
        }
        if (test.hasOwnProperty("failedReason")) {
          row.failedReason.current = test.failedReason;
        }
        if (test.hasOwnProperty("filckeredValues")) {
          row.filckeredValues = test.filckeredValues;
        }
        row.testName = key + "-" + test.id;
        row.result = resultStr;
        data.push(row);
      });
    });
    data = data.map((d) => {
      if (
        d.failedReason.current.length > 0 ||
        d.failedReason.voltage.length > 0 ||
        d.filckeredValues.length > 0
      ) {
        return { ...d };
      } else {
        return { testName: d.testName, result: d.result };
      }
    });

    setResultArr(data);
  }, []);

  const onSave = async () => {
    try {
      setLoading(true);

      await ipcRenderer.invoke("save-to-excel", resultArr, boardUid, serialNo);
      // await new Promise((res) => setTimeout(() => res(), 2500));
      if (!resultArr.map((r) => r.result).some((r) => r == "Failed")) {
        console.log("all passed");
        await new Promise((res) => setTimeout(() => res(), 100));
        await ipcRenderer.invoke("factory-reset");
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
      setIsSaved(true);
    }
  };
  const onFinish = async () => {
    setLoading(true);
    await ipcRenderer.invoke("disconnect");
    setTestResults({});
    setBoardUid("");
    setSerialNo("");
    setCurrentStep(1);
    setIsConnected(false);
    setLoading(false);
  };
  return (
    <>
      {show && (
        <div>
          {/* {JSON.stringify(resultArr)} */}
          <h1 className=" text-base font-semibold mb-2">Test Results</h1>
          <table className="table w-full text-sm table-compact table-zebra">
            <thead>
              <tr>
                <th></th>
                <th>Test Name</th>
                <th>Result</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {resultArr &&
                resultArr.map((row) => (
                  <tr>
                    <td></td>
                    <td>{row.testName}</td>
                    <td>{row.result}</td>
                    <td>
                      <div>{JSON.stringify(row.failedReason)}</div>
                      <div>
                        {row.hasOwnProperty("filckeredValues") &&
                          row.filckeredValues.length > 0 && (
                            <span>
                              Flicekered Values:{" "}
                              {JSON.stringify(row.filckeredValues)}
                            </span>
                          )}
                      </div>
                      {/* {JSON.stringify(row.failedReason) +
                        JSON.stringify(row.filckeredValues)} */}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          <div className="flex justify-end space-x-6 mt-2">
            <button
              className={`btn ${loading ? "loading" : ""} btn-sm`}
              onClick={onSave}
            >
              Save
            </button>
            <button
              disabled={!isSaved}
              className={`btn ${loading ? "loading" : ""} btn-sm`}
              onClick={onFinish}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
};
export default ResultsPage;
