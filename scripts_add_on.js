/**
 * Codes here for the "get interaction details", "accept interactions" and "dispose interaction"
 */

const myWorker = new Worker("worker.js");

if (window.Worker) {
    myWorker.onmessage = function (event) {
        const { type, data } = event.data;
        if (type === "log") {
            console.debug(data);
            sendMessageBanner(data);

            if (typeof data === "string" && data.startsWith("[Finished]")){
                alert(data);
            }

        } else if (type === "result") {
            console.log("Final result from worker:", data);
            bulkDispoTable(data.resultsProcess3);
            sendMessageBanner(`Done bulk disposing ${data.resultsProcess3.length} interactions.`);
        } else if (type === "error") {
            console.error("Worker error:", data);
            sendMessageBanner(data);
        }
    };
}

//event listener to trigger the worker
document.getElementById("bulkDispo").addEventListener("click", () => {
    const selectElement = document.getElementById("dispositions");
    const selectedValue = selectElement.value;

    if (selectedValue !== "0") {
        const dispositionId = dispositionsCopy.find(
            (dispo) => dispo.name === selectedValue
        ).id;
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

function bulkDispoTable(resultsProcess3) {
    const table = document.getElementById("csvTable");
    const rows = table.querySelectorAll("tbody tr");

    rows.forEach((row, index) => {
        const thElement = row.querySelector("th");
        const status = resultsProcess3[index];
        let tooltipText = status;

        if (status === "done") {
            thElement.style.color = "blue";
            row.classList.add("tooltip-row");
            row.setAttribute("data-tooltip", tooltipText);
        } else {
            thElement.style.color = "red";
            row.classList.add("tooltip-row");
            row.setAttribute("data-tooltip", tooltipText);
        }
    });
}