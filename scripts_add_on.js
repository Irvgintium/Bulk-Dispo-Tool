/**
 * Codes here for the "get interaction details", "accept interactions" and "dispose interaction"
 */

const myWorker = new Worker("worker.js");

if (window.Worker) {
    myWorker.onmessage = function (event) {
        const { type, data } = event.data;
        if (type === "log") {
            console.debug(data);
        } else if (type === "result") {
            console.log("Final result from worker:", data);
        } else if (type === "error") {
            console.error("Worker error:", data);
        }
    };
}

//[NOT YET WORKING] event listener to trigger the worker
document.getElementById("phaseTwoTest").addEventListener("click", () => {
    const selectElement = document.getElementById("dispositions");
    const selectedValue = selectElement.value;
    const dispositionId = dispositionsCopy.find(
        (dispo) => dispo.name === selectedValue
      ).id;

    if (selectedValue !== "0") {

        myWorker.postMessage({
            text: csvData,
            host: host,
            userId: userId,
            farmId: farmID,
            tokenId: tokenID,
            dispositionId: dispositionId,
        });

    } else {
        alert("Please select a proper disposition.");
    }

});