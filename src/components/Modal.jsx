import { useEffect, useState } from "react";
import { ipcRenderer } from "electron";

const Modal = ({ show, setIsShowModal }) => {
  const [data, setData] = useState([]);
  useEffect(() => {
    async function fetchData() {
      const resp = await ipcRenderer.invoke("view-results");
      setData(resp);
    }
    fetchData();
  }, []);

  return (
    show && (
      <div className="absolute top-0 w-5/6 h-[640px] overflow-y-auto bg-white shadow-lg rounded-md z-30">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Test Results</h3>
            <button
              onClick={() => setIsShowModal(false)}
              className="btn btn-square"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          {data.length > 0 && (
            <div className="overflow-x-auto mt-4">
              <table className="table w-full table-compact table-zebra">
                {/* head */}
                <thead>
                  <tr>
                    <th>UID</th>
                    <th>Name</th>
                    <th>Test Name</th>
                    <th>Test Result</th>
                    <th>Failed Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {/* row 1 */}
                  {data.map((row) => (
                    <tr>
                      <th>{row._doc.uid}</th>
                      <td>{row._doc.serialNo}</td>
                      <td>{row._doc.testName}</td>
                      <td>{row._doc.testResult}</td>
                      <td>{row._doc.failedReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  );
};
export default Modal;
