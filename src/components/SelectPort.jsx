import { useCallback, useEffect, useState } from "react";
const { ipcRenderer } = window.require("electron");
import { v4 as uuidv4 } from "uuid";
import LoadingComp from "./LoadingComp";

const SelectPort = ({
  selectedPort,
  setSelectedPort,
  boardUid,
  setBoardUid,
  serialNo,
  setSerialNo,
  setCurrentStep,
  setIsShowModal,
  setIsConnected,
  isConnected,
}) => {
  const [availablePorts, setAvailablePorts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPorts = useCallback(async () => {
    try {
      const ports = await ipcRenderer.invoke("fetch-ports");
      setAvailablePorts(ports.map((p) => ({ path: p.path })));
    } catch (error) {
      console.error("error getting ports", error);
    }
  }, []);
  useEffect(() => {
    fetchPorts();
  }, [fetchPorts]);

  // refresh ports
  const onRefreshHandler = () => fetchPorts();

  const onConnect = async () => {
    if (!selectedPort) {
      return;
    }
    try {
      setLoading(true);
      let uid = "";
      const response = await ipcRenderer.invoke("connect-board", selectedPort);

      const resultArr = response.uidArr.data;
      if (!resultArr) {
        uid = uuidv4();
        setBoardUid(uid);
        return;
      }
      console.log(resultArr);
      let first = resultArr.slice(0, 2),
        second = resultArr.slice(2, 4),
        third = resultArr.slice(4, 6);
      (first = (first[1] << 16) | first[0]),
        (second = (second[1] << 16) | second[0]),
        (third = (third[1] << 16) | third[0]);
      uid = first + "-" + second + "-" + third;
      const prevResult = await ipcRenderer.invoke("find-prev-board");
      if (prevResult) {
        setSerialNo(prevResult._doc.serialNo);
      }
      setBoardUid(uid);
      setIsConnected(true);
      setCurrentStep((step) => step + 1);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  const onDisConnect = async () => {
    setIsConnected(false);
    await ipcRenderer.invoke("disconnect");
    setBoardUid("");
    setSerialNo("");
  };

  return (
    <>
      <div className="flex items-center justify-between space-x-4 mt-4 relative flex-wrap">
        {loading && <LoadingComp />}
        <div className="flex space-x-4">
          <select
            value={selectedPort}
            onChange={({ target: { value } }) => setSelectedPort(value)}
            className="select select-bordered w-full max-w-xs text-sm py-1 h-8 min-h-8"
          >
            <option value={""} disabled className="text-sm">
              Select the COM port and press connect
            </option>
            {availablePorts.map((s) => (
              <option key={s.path} value={s.path} className="text-sm">
                {s.path}
              </option>
            ))}
          </select>
          <div className="flex items-center space-x-4">
            <button
              onClick={onRefreshHandler}
              className="btn btn-sm btn-outline"
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
            <button
              type="button"
              className={`btn ${loading ? "loading" : ""} btn-sm btn-neutral`}
              onClick={!isConnected ? onConnect : onDisConnect}
            >
              {isConnected ? "Disconnect" : "Connect"}
            </button>
          </div>
        </div>
        <div className="mt-2 text-sm font-medium text-gray-700">
          Connected board UID# {boardUid.length > 0 && <span>{boardUid}</span>}
        </div>
        <div className=" flex items-center space-x-4 mt-2">
          <label className="label-text">Serial No</label>
          <input
            className="border border-gray-300 rounded-md px-4 py-1"
            type="text"
            value={serialNo}
            onChange={({ target: { value } }) => setSerialNo(value)}
          />
        </div>
        <button
          className="btn btn-sm btn-outline btn-info"
          onClick={() => setIsShowModal(true)}
        >
          View Past Results
        </button>
      </div>
    </>
  );
};
export default SelectPort;
