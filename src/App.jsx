import { ipcRenderer } from "electron";
import { useEffect, useState } from "react";
import SelectPort from "./components/SelectPort";
import DigitalIo from "./components/DigitalIo";
import LoadingComp from "./components/LoadingComp";
import AnalogIoComp from "./components/AnalogIoComp";
import Triacs from "./components/Triacs";
import PIDPage from "./components/PIDPage";
import PWMChannel from "./components/PWMChannel";
import ResultsPage from "./components/ResultPage";
import Modal from "./components/Modal";
import AlertComp from "./components/AlertComp";

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPort, setSelectedPort] = useState("");
  const [boardUid, setBoardUid] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [testResults, setTestResults] = useState({});
  const [globLoading, setGlobLoading] = useState(false);
  const [isShowModal, setIsShowModal] = useState(false);
  const [configs, setConfigs] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    async function getConfigs() {
      setGlobLoading(true);
      const res = await ipcRenderer.invoke("get-configs");
      setConfigs(res);

      setGlobLoading(false);
    }
    getConfigs();
  }, []);

  useEffect(() => {
    let messageEventHandler = async (event, args) => {
      console.log("message", args);
      if (args == "Timed out") {
        setGlobLoading(true);

        await ipcRenderer.invoke("reset-client");
        console.log("client reset done");
        setGlobLoading(false);
      }
      setShowAlert(true);
      setMessage(args);
    };
    ipcRenderer.on("message-from-main", messageEventHandler);
    return () => {
      ipcRenderer.removeListener("message-from-main", messageEventHandler);
    };
  }, []);

  useEffect(() => {
    let messageEventHandler = (event, args) => {
      console.log("message", args);
    };
    ipcRenderer.on("message-from-main", messageEventHandler);
    return () => {
      ipcRenderer.removeListener("message-from-main", messageEventHandler);
    };
  }, []);

  return (
    <>
      <div className="px-4 relative">
        {showAlert && (
          <AlertComp
            msg={message}
            setMessage={setMessage}
            setShowAlert={setShowAlert}
          />
        )}
        {isShowModal && (
          <Modal show={isShowModal} setIsShowModal={setIsShowModal} />
        )}
        {globLoading && <LoadingComp />}
        <SelectPort
          isConnected={isConnected}
          setIsConnected={setIsConnected}
          selectedPort={selectedPort}
          setSelectedPort={setSelectedPort}
          boardUid={boardUid}
          setBoardUid={setBoardUid}
          serialNo={serialNo}
          setSerialNo={setSerialNo}
          setCurrentStep={setCurrentStep}
          setIsShowModal={setIsShowModal}
        />
        <div className=" flex items-start space-x-2 w-full mt-4">
          {currentStep >= 2 && (
            <DigitalIo
              currentStep={currentStep}
              show={currentStep >= 2}
              testResults={testResults}
              setTestResults={setTestResults}
              setCurrentStep={setCurrentStep}
            />
          )}
          {currentStep >= 3 && Object.keys(configs).length && (
            <AnalogIoComp
              configs={configs}
              currentStep={currentStep}
              show={currentStep >= 3}
              setTestResults={setTestResults}
              setCurrentStep={setCurrentStep}
            />
          )}
        </div>
        {currentStep >= 4 && (
          <Triacs
            configs={configs}
            currentStep={currentStep}
            show={currentStep >= 4}
            setTestResults={setTestResults}
            setCurrentStep={setCurrentStep}
          />
        )}
        <div className=" flex items-start space-x-6 w-full mt-4">
          {currentStep >= 5 && (
            <PWMChannel
              configs={configs}
              currentStep={currentStep}
              show={currentStep >= 5}
              setTestResults={setTestResults}
              setCurrentStep={setCurrentStep}
            />
          )}
          {currentStep >= 6 && (
            <PIDPage
              configs={configs}
              currentStep={currentStep}
              show={currentStep >= 6}
              setTestResults={setTestResults}
              setCurrentStep={setCurrentStep}
            />
          )}
        </div>
        {currentStep >= 7 && (
          <ResultsPage
            show={currentStep >= 7}
            testResults={testResults}
            boardUid={boardUid}
            serialNo={serialNo}
            setTestResults={setTestResults}
            setCurrentStep={setCurrentStep}
            setIsConnected={setIsConnected}
            setBoardUid={setBoardUid}
            setSerialNo={setSerialNo}
          />
        )}
      </div>
    </>
  );
}

export default App;
