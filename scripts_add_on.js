/**
 * Codes here for the "get interaction details", "accept interactions" and "dispose interaction"
 */

const myWorker = new Worker("worker.js");
const banner = document.querySelector('.banner');
let isProcessing = false;

function process() {
    banner.classList.add('loading');
}

function stop() {
    banner.classList.remove('loading');
}

if (window.Worker) {
    myWorker.onmessage = function (event) {
        const { type, data } = event.data;
        if (type === "log") {
            console.debug(data);
            process();
            sendMessageBanner(data);

            if (typeof data === "string" && data.startsWith("[Finished]")) {
                alert(data);
                stop();
                isProcessing = false;
            }

        } else if (type === "result") {
            console.log("Final result from worker:", data);
            console.debug("NOTE: If you notice the final total interactions was subtracted by 1, it could be due to a null space in the processed CSV file. The tool automatically removes it.")
            bulkDispoTable(data.resultsProcess3);
            sendMessageBanner(`Done processing ${data.resultsProcess3.length} interactions.`);
            isProcessing = false;

        } else if (type === "error") {
            console.error("Worker error:", data);
            sendMessageBanner(data);
            isProcessing = false;
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

        if (isProcessing) {
            alert("The tool is already processing the interactions, please wait until it's done.");
            return;
        }

        isProcessing = true;
        console.log("Processing started, isProcessing:", isProcessing);
        
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
            thElement.style.color = "green";
            row.classList.add("tooltip-row");
            row.setAttribute("data-tooltip", tooltipText);
        } else {
            thElement.style.color = "red";
            row.classList.add("tooltip-row");
            row.setAttribute("data-tooltip", tooltipText);
        }
    });
}