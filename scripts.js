//Variables needed for the VCC REST API calls
var host;
var tokenID;
var farmID;
var agentID;
var orgID;
var userId;
var csvData;
var userSkills;
var skillsFromCSV;
var ids;
var dispositionsCopy;
const TIMEOUT_DURATION = 10 * 60 * 1000; //10 mins in milliseconds
let timeoutID;
var matchSkillMessage =
  "Please have your admin assign you the skills needed for deprovisioning.";
var loginSate = 0;

initializeSessionTimeout();
sendMessageBanner("Welcome to Five9 Bulk Disposition Tool");
showBulkDispoButton(false);
showMatchSkillsButton(false);
showDispositionsMenu(false);
enableFilter(false);
showLogout(false);
changePanelText(true, "You will see more info below once logged in.");

window.addEventListener("beforeunload", function (event) {
  const confirmationMessage = "Do you want to reload the page?";
  event.returnValue = confirmationMessage;
  return confirmationMessage;
});

document.getElementById("login").addEventListener("click", function () {
  try {
    login();
  } catch (error) {
    alert(error);
  }
});

document.getElementById("logout").addEventListener("click", function () {
  const username = document.querySelector("#username").value;
  logoutUser();
  alert(`${username} has been logged out.`);
});

document
  .getElementById("csvFileInput")
  .addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();

      reader.onload = function (e) {
        const text = e.target.result.trim();

        const defaultHeaders = [
          "SESSION GUID",
          "CAMPAIGN",
          "SKILL",
          "CUSTOMER NAME",
          "DISPOSITION",
          "STATUS",
        ];

        try {
          const headersToShow = defaultHeaders
            .map(
              (col) =>
                text
                  .split("\n")[0]
                  .split(",")
                  .map((data, index) =>
                    data.trim().toLowerCase() === col.trim().toLowerCase()
                      ? index
                      : undefined
                  )
                  .filter((index) => index !== undefined)[0]
            )
            .filter((index) => index !== undefined);

          //Checks if the csv file contains the needed columns
          if (headersToShow.length != 6 && headersToShow.length != 0) {
            clearTable();
            showMatchSkillsButton(false);
            enableFilter(false);
            showBulkDispoButton(false);
            showDispositionsMenu(false);
            sendMessageBanner(
              "The uploaded CSV file has some missing required columns. Please review the file."
            );
            alert(
              `NOTE: Make sure the CSV file contains:\n"SESSION GUID"\n"CAMPAIGN"\n"SKILL"\n"CUSTOMER NAME"\n"DISPOSITION"\n"STATUS"`
            );
            return;
          }

          const newCSV = text
            .split("\n")
            .map((row) => {
              return headersToShow.map(
                (col) =>
                  row
                    .replace(
                      /"(.*?)"/gm,
                      (_, timestamp) => `"${timestamp.replace(/,/g, "")}"`
                    )
                    .split(",")
                    .map((data, index) => index == col && data)
                    .filter((x) => x)[0]
              );
            })
            .join("\n");

          if (newCSV.replace(/[\s,]+/g, "").length == 0) {
            clearTable();
            showMatchSkillsButton(false);
            enableFilter(false);
            showBulkDispoButton(false);
            showDispositionsMenu(false);
            sendMessageBanner("You have uploaded a non CSV file.");
            alert(`Detected a non CSV file.`);
          } else {
            clearTable();
            csvData = newCSV;
            loadTable(csvData);
          }
        } catch (error) {
          alert(error);
        }
      };

      reader.readAsText(file);

      sendMessageBanner("CSV successfuly loaded.");
      enableFilter(true);
    } else {
      alert("No file selected!");
      clearTable();
      enableFilter(false);
      sendMessageBanner("Welcome to Five9 Bulk Disposition Tool");
    }
  });

document
  .getElementById("dropdown")
  .addEventListener("change", async function (event) {
    const filter = this.value;
    const sessionGUIDIndex = 0; //default header session GUID index is 0

    if (filter == "all") {
      clearTable();
      sendMessageBanner(
        'Filtering CSV with "' +
          this.options[this.selectedIndex].text +
          '". Please wait...'
      );
      loadTable(csvData);
      sendMessageBanner(
        'Reloaded CSV table with "' +
          this.options[this.selectedIndex].text +
          '"'
      );
    } else {
      const data = await Promise.all(
        csvData.split("\n").map(async (row, rowIndex) => {
          if (rowIndex != 0) {
            clearTable();
            sendMessageBanner(
              'Filtering CSV with "' +
                this.options[this.selectedIndex].text +
                '". Please wait...'
            );
            try {
              const interactionDetails = await getInteractionDetails(
                row.split(",")[sessionGUIDIndex]
              );
              if (JSON.parse(interactionDetails).mediaType == filter) {
                console.log(
                  "Filtered event tracking: " +
                    row +
                    " media type: " +
                    JSON.parse(interactionDetails).mediaType
                );
                return row;
              }
            } catch (error) {
              alert("Failed to fetch interaction details.");
            }
          } else {
            return row;
          }
        })
      );

      const filteredCSV = data.join("\n");

      if (
        filteredCSV
          .split("\n")
          .map((x, i) => i != 0 && x)
          .filter((removeFalse) => removeFalse)
          .join("\n")
          .replace(/[\s,]+/g, "").length == 0
      ) {
        sendMessageBanner(
          'CSV does not contain any data with "' +
            this.options[this.selectedIndex].text +
            '"'
        );
        clearTable();
      } else {
        loadTable(filteredCSV);
        sendMessageBanner(
          'Reloaded CSV table with "' +
            this.options[this.selectedIndex].text +
            '"'
        );
      }
    }
  });

document
  .getElementById("matchSkills")
  .addEventListener("click", async function (e) {
    alert(matchSkillMessage);
  });

document.getElementById("bulkDispo").addEventListener("click", function (e) {
  const selectElement = document.getElementById("dispositions");
  const selectedValue = selectElement.value;
  if (selectedValue !== "0") {
    bulkDispoTable();
  } else {
    alert("Please select a proper disposition.");
  }
});

async function login() {
  const usernameValue = document.getElementById("username").value;
  const passwordValue = document.getElementById("password").value;
  const urldEndpoint = document.getElementById("endpointSelect").value;
  const headerBody = JSON.stringify({
    passwordCredentials: {
      username: usernameValue,
      password: passwordValue,
    },
    policy: "AttachExisting",
    // You can change the "AttachExisting" to "ForceIn" to force logout existing sessions.
  });
  const method = "POST";

  /**Send POST request to login*/
  request(method, urldEndpoint, headerBody).then((result) => {
    const res = JSON.parse(result);
    try {
      userId = res.userId;
      host = res.metadata.dataCenters[0].uiUrls[0].host;
      tokenID = res.tokenId;
      farmID = res.context.farmId;
      agentID = res.userId;
      orgID = res.orgId;
      showLoading();
      handleSelectStation();
    } catch (error) {
      showMessage(
        `Login encountered an error. Please make sure you have the correct credentials.`
      );
    }
  });
}

async function request(method, urlEndpoint, headerBody) {
  try {
    const options = {
      method: method,
      headers: {
        "Content-Type": "application/json",
        farmId: farmID,
        Authorization: tokenID,
      },
      body: headerBody,
    };

    //Remove body for GET method
    if (method == "GET") delete options.body;

    const request = new Request(urlEndpoint, options);

    const response = await fetch(request);

    if (!response.ok) {
      console.log(
        `HTTP error! Status: ${
          response.status
        }\nURL Endpoint: ${urlEndpoint}\n${JSON.stringify(response)}`
      );
    }

    const text = await response.text();

    let result;
    if (text.trim() === "") {
      //Empty response
      console.warn("Empty response from API: " + response.status);
      result = response.status;
    } else {
      result = JSON.parse(text); //Parse JSON if not empty
    }
    console.log("Post Request Success:", result);
    return JSON.stringify(result); //Return stringified result
  } catch (error) {
    alert(`Post Request error:\n ${error}`);
  }
}

function getSkill() {
  request("GET", `https://${host}/appsvcs/rs/svc/agents/${userId}/skills`).then(
    (result) => {
      userSkills = [];
      try {
        ids = JSON.parse(result).map((x) => x.id);
        userSkills = JSON.parse(result).map((x) => x.name);

        var ul = document.querySelector(".list-group");
        ul.innerHTML = "";

        for (var i = 0; i < userSkills.length; i++) {
          var name = userSkills[i];
          var li = document.createElement("li");
          li.className = "list-group-item text-dark";
          li.appendChild(document.createTextNode(name));
          ul.appendChild(li);
        }
        changePanelText(true, "Your user's assigned skill(s):");
        console.log("Skill IDs: \n" + ids);
        assignSkillsToMatch(JSON.stringify(ids));
      } catch (error) {
        login();
        //if error occurs, this will try logging in again.
      }
    }
  );
}

function showLoading() {
  const loadingImage = document.getElementById("loading");
  loadingImage.style.display = "block";
  setTimeout(() => {
    loadingImage.style.display = "none";
  }, 300);
  ShowLoginDetails(true);
}

function loadTable(csv) {
  const table = document.getElementById("csvTable");
  const rows = csv.split("\n");
  const headers = rows[0].split(",");

  //create table headers
  const thead = table.querySelector("thead");
  const headerRow = document.createElement("tr");
  headers.forEach((header) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = header;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  //create table rows
  const tbody = table.querySelector("tbody");
  rows.slice(1).forEach((row) => {
    const columns = row.split(",");
    const tr = document.createElement("tr");

    columns.forEach((col, index) => {
      const cell =
        index === 0
          ? document.createElement("th")
          : document.createElement("td");
      if (index === 0) {
        cell.scope = "row";
      }
      cell.textContent = col || "";
      tr.appendChild(cell);
    });

    tbody.appendChild(tr);
  });

  //CHECK IF SKILLS IN UPLOADED CSV FILE MATCH THE USER'S SKILLS.
  checkSkills();
}

function allowCSVUpload(value) {
  const element = document.getElementById("csvFileInput");
  if (element) {
    if (value === true) {
      element.style.pointerEvents = "auto";
      element.style.cursor = "pointer";
      element.style.opacity = "1";
      element.disabled = false;
    } else {
      element.style.pointerEvents = "none";
      element.style.cursor = "not-allowed";
      element.style.opacity = "0.5";
      element.disabled = true;
    }
  }
}

function enableFilter(value) {
  const filter = document.getElementById("dropdown");
  value == true ? (filter.disabled = false) : (filter.disabled = true);
}

function showMessage(message) {
  const element = document.getElementById("message");
  element.innerHTML = `<p>${message}</p>`;
  // element.style.display = "block";
  setTimeout(() => {
    element.style.color = "red";
    element.style.fontSize = "xx-small";
    element.innerHTML = `<p></p>`;
  }, 2000);
}

function ShowLoginDetails(value) {
  const element = document.querySelector(".login-container");
  const username = document.querySelector("#username");
  const password = document.querySelector("#password");
  const loginButton = document.querySelector("#login");
  const message = document.getElementById("message");

  if (element) {
    if (value === true) {
      username.style.display = "none";
      password.style.display = "none";
      loginButton.style.display = "none";
      element.style.height = "250px";
      message.style.color = "white";
      message.innerHTML = `<p>🟢 <b>${username.value}</b> logged in</p>`;
      message.style.display = "block";
      message.style.fontSize = "10px";
      allowCSVUpload(true);
      showLogout(true);
    }
  }
}

function clearTable() {
  const table = document.getElementById("csvTable");
  const thead = table.querySelector("thead");
  if (thead) {
    thead.innerHTML = "";
  }
  const tbody = table.querySelector("tbody");
  if (tbody) {
    tbody.innerHTML = "";
  }
}

function sendMessageBanner(msg) {
  const banner = document.getElementById("displayBanner");
  banner.textContent = msg;
  banner.style.color = "white";
  banner.style.textShadow = "0 0 10px white, 0 0 20px white, 0 0 30px white";
  setTimeout(() => {
    banner.style.color = "rgba(241, 241, 241, 0.5)";
    banner.style.textShadow = "1px 1px 2px rgba(241, 241, 241, 0.5)";
  }, 3000);
}

async function getInteractionDetails(sessionGUID) {
  try {
    const result = await request(
      "GET",
      `https://${host}/appsvcs/rs/svc/agents/${userId}/interactions/${sessionGUID}`
    );
    return result;
  } catch (error) {
    console.error("Error in getInteractionDetails:", error);
    throw error;
  }
}

function checkSkills() {
  if (
    checkCsvSkills(
      [...new Set(extractColumnFromCSV(csvData, "SKILL"))],
      userSkills
    )
  ) {
    enableFilter(true);
    showDispositionsMenu(true);
    showBulkDispoButton(true);
    showMatchSkillsButton(false);
  } else {
    showMatchSkillsButton(true);
    enableFilter(false);
    showBulkDispoButton(false);
    showDispositionsMenu(false);
    enableFilter(false);
    sendMessageBanner(
      '\n The  "' +
        getMissingCsvSkills(
          [...new Set(extractColumnFromCSV(csvData, "SKILL"))],
          userSkills
        ) +
        "\" skill from the CSV file is/are NOT found in the User's Skills:\n" +
        userSkills
    );
    matchSkillMessage =
      "Please have your admin assign these skill(s) to your user:\n\n" +
      getMissingCsvSkills(
        [...new Set(extractColumnFromCSV(csvData, "SKILL"))],
        userSkills
      ) +
      "\n\nNOTE: Your user's assigned skill should match skills in the uploaded CSV file!";
    console.log(
      "review skills:\nskills from csv:\n" +
        [...new Set(extractColumnFromCSV(csvData, "SKILL"))] +
        "\nSkills from user:\n" +
        userSkills +
        "\n Are all user skills exist in the CSV skills? = " +
        checkCsvSkills(
          [...new Set(extractColumnFromCSV(csvData, "SKILL"))],
          userSkills
        ) +
        "\n Missing skills from csv file that is not in the user's skills: " +
        getMissingCsvSkills(
          [...new Set(extractColumnFromCSV(csvData, "SKILL"))],
          userSkills
        )
    );
  }
}

function showBulkDispoButton(value) {
  const button = document.getElementById("bulkDispo");

  if (value == true) {
    button.style.display = "block";
  } else {
    button.style.display = "none";
  }
}

function showMatchSkillsButton(value) {
  const button = document.getElementById("matchSkills");

  if (value == true) {
    button.style.display = "block";
  } else {
    button.style.display = "none";
  }
}

function showDispositionsMenu(value) {
  const menu = document.getElementById("dispositions");

  if (value == true) {
    menu.style.display = "block";
  } else {
    menu.style.display = "none";
  }
}

function changePanelText(value, message) {
  const text = document.getElementById("panelText");
  if (value == true) {
    text.style.display = "block";
    text.textContent = message;
  } else {
    text.style.display = "none";
  }
}

// async function getSkills() {
//   try {
//     const response = await request(
//       "GET",
//       `https://${host}/appsvcs/rs/svc/orgs/${orgID}/skills`
//     );
//     return response;
//   } catch (error) {
//     alert(error);
//     throw error;
//   }
// }

async function assignSkillsToMatch(skills) {
  try {
    const response = await request(
      "PUT",
      `https://${host}/appsvcs/rs/svc/agents/${userId}/active_skills`,
      skills
    );
    sendMessageBanner(
      `${ids.length} skills has been assigned properly to the user. You can now proceed in loading the CSV file.`
    );
    loadDispositions();
  } catch (e) {
    alert(e);
    sendMessageBanner(`An error occured: ${e}.`);
  }
}

async function checkLoginAPIUser() {
  try {
    const response = await request(
      "GET",
      `https://${host}/appsvcs/rs/svc/agents/${userId}/login_state`
    );
    console.log("checkLoginAPIUser Success:", response);

    if (response.replace(/"/g, "") == "SELECT_STATION") {
      sendMessageBanner("Selecting station. Please wait...");
      handleSelectStation();
      login();
    }

    if (response.replace(/"/g, "") == "SELECT_SKILLS") {
      sendMessageBanner("Selecting skills. Please wait...");
      handleSelectStation();
      login();
    }

    if (response.replace(/"/g, "") == "ACCEPT_NOTICE") {
      sendMessageBanner("Accepting notice. Please wait...");
      agentGetNotice();
      login();
    }

    if (response.replace(/"/g, "") == "WORKING") {
      getSkill();
      loginSate = 1;
    }
  } catch (error) {
    alert(`Login state check error:\n${error}`);
    console.log(`checkLoginAPIUser error:\n${error}`);
  }
}

async function bulkDispoTable() {
  const table = document.getElementById("csvTable");
  const rows = table.querySelectorAll("tbody tr");
  const selectedDispo = document.getElementById("dispositions").value;
  const dispositionId = dispositionsCopy.find(
    (dispo) => dispo.name === selectedDispo
  ).id;
  let index = 0;

  for (const row of rows) {
    const GUID = row.querySelector("th").textContent;
    const thElement = row.querySelector("th");

    try {
      const result = await getInteractionDetails(GUID);
      const {
        profileId,
        mediaType,
        dispositionId: dispoID,
      } = JSON.parse(result);

      if (dispoID !== "-1") {
        //Already dispositioned
        index++;
        sendMessageBanner(
          `${index} Session GUID(s) highlighted in 🔵 (blue) on the table have already been dispositioned.`
        );
        thElement.style.color = "blue";
        continue;
      }

      //Processing Session GUID
      index++;
      sendMessageBanner(
        `(${index} out of ${rows.length}). Processing Session GUID "${GUID}".`
      );

      //Accept API
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await acceptChatEmail(GUID, profileId, mediaType, 1);

      //Dispose API
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const response = await disposeChatEmail(
        GUID,
        profileId,
        mediaType,
        dispositionId,
        1
      );

      const errorRegex = /error/i;
      const exceptionRegex = /exception/i;

      if (errorRegex.test(response) && exceptionRegex.test(response)) {
        //Handle specific 435 status.
        index--;
        thElement.style.color = "red";
        sendMessageBanner(
          `Error disposing GUID "${GUID}" (${
            JSON.parse(response).five9ExceptionDetail.message
          })`
        );
      } else {
        //Successful disposal
        thElement.style.color = "green";
        sendMessageBanner(
          `(${index} out of ${rows.length}). Done disposing Session GUID "${GUID}".`
        );
      }
    } catch (error) {
      //Catch and handle errors
    }
  }

  // Final notification
  setTimeout(() => {
    alert(
      `A total of ${rows.length} Session GUID(s) have been completed!\n${
        rows.length - index
      } encountered issues.\n${index} were read successfully.\n\nSession GUID table font colors references:\n🟢 ('green' means successful)\n🔵 ('blue' means already dispositioned)\n🔴 ('red' means error or API issue)`
    );
  }, 3000);
}

async function loadDispositions() {
  try {
    const response = await request(
      "GET",
      `https://${host}/appsvcs/rs/svc/orgs/${orgID}/dispositions`
    );
    const selectElement = document.getElementById("dispositions");
    dispositionsCopy = JSON.parse(response);

    dispositionsCopy.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.name;
      opt.textContent = option.name;
      selectElement.appendChild(opt);
    });
  } catch (e) {
    console.error("Error loading dispositions:", e);
  }
}

async function handleSelectStation() {
  try {
    handleSelectSkills();
    const response = await request(
      "PUT",
      `https://${host}/appsvcs/rs/svc/agents/${userId}/session_start?force=true`,
      JSON.stringify({
        stationId: "",
        stationType: "EMPTY",
      })
    );
    sendMessageBanner("Setting up station...");
    console.log("Station set to " + response);
    //If the response is 204, auto re-attempt to login again
    if (response == "204") {
      login();
      checkLoginAPIUser();
    } else {
      checkLoginAPIUser();
    }
  } catch (error) {
    sendMessageBanner(error);
  }
}

async function handleSelectSkills() {
  try {
    const response = await request(
      "PUT",
      `https://${host}/appsvcs/rs/svc/agents/${userId}/active_skills`,
      JSON.stringify([])
    );
    sendMessageBanner("Setting up skills...");
    console.log("Inital Skill set to:" + response);
  } catch (error) {
    sendMessageBanner(error);
  }
}

async function acceptChatEmail(GUID, profileId, mediaType, type) {
  const requestBody = {
    profileId: profileId,
    mediaType: mediaType,
    type: type,
  };
  const jsonBody = JSON.stringify(requestBody);
  try {
    const response = request(
      "PUT",
      `https://${host}/appsvcs/rs/svc/agents/${userId}/interactions/${GUID}/accept`,
      jsonBody
    );
    response.length == undefined &&
      sendMessageBanner('"' + GUID + '" has been accepted to the agent...');
  } catch (error) {
    sendMessageBanner(`Error: ${error}`);
  }
}

async function disposeChatEmail(
  GUID,
  profileId,
  mediaType,
  dispositionId,
  isClose
) {
  const requestBody = {
    profileId: profileId,
    mediaType: mediaType,
    dispositionId: dispositionId,
    isClose: isClose,
  };
  const jsonBody = JSON.stringify(requestBody);

  const response = request(
    "PUT",
    `https://${host}/appsvcs/rs/svc/agents/${userId}/interactions/${GUID}/disposition`,
    jsonBody
  );
  return response;
}

function showLogout(value) {
  const logout = document.getElementById("logout");
  if (value == true) {
    logout.style.display = "block";
  } else {
    logout.style.display = "none";
  }
}

// async function logoutUser() {
//   window.location.reload(true);
// }

function endSession() {
  const confirmEnd = confirm("Do you want to end the session?");
  if (confirmEnd) {
    window.location.reload(true);
  } else {
    return;
  }
}

function extractColumnFromCSV(csvData, columnName) {
  const rows = csvData.split("\n");

  if (rows.length < 2) {
    throw new Error("CSV data is too short or invalid.");
  }

  const headers = rows[0].split(",").map((header) => header.trim());
  const columnIndex = headers.indexOf(columnName);

  if (columnIndex === -1) {
    throw new Error(
      `Column "${columnName}" not found in the uploadded CSV header.`
    );
  }

  return rows
    .slice(1) //skip the header
    .map((row) => row.split(",")[columnIndex])
    .filter((value) => value);
}

function checkCsvSkills(csvSkills, userSkills) {
  const userSkillsSet = new Set(userSkills.map((skill) => skill.trim()));
  const normalizedCsvSkills = csvSkills.map((skill) => skill.trim());

  //check if all CSV skills exist in the user skills
  return normalizedCsvSkills.every((skill) => userSkillsSet.has(skill));
}

function getMissingCsvSkills(csvSkills, userSkills) {
  const userSkillsSet = new Set(userSkills.map((skill) => skill.trim()));
  const normalizedCsvSkills = csvSkills.map((skill) => skill.trim());

  //filter skills from CSV that are not in user skills
  const missingSkills = normalizedCsvSkills.filter(
    (skill) => !userSkillsSet.has(skill)
  );

  return missingSkills;
}

async function logoutUser() {
  const usernameValue = document.getElementById("username").value;
  const passwordValue = document.getElementById("password").value;
  const fileInput = document.getElementById("csvFileInput");
  const urldEndpoint = document.getElementById("endpointSelect").value;
  const headerBody = JSON.stringify({
    passwordCredentials: {
      username: usernameValue,
      password: passwordValue,
    },
    policy: "AttachExisting",
    // You can change the "AttachExisting" to "ForceIn" to force logout existing sessions.
  });
  const method = "POST";
  const response = await request(method, urldEndpoint, headerBody);
  const message = document.getElementById("message");
  const username = document.querySelector("#username");
  const password = document.querySelector("#password");
  const loginButton = document.querySelector("#login");

  sendMessageBanner("Welcome to Five9 Bulk Disposition Tool");
  username.style.display = "block";
  password.style.display = "block";
  loginButton.style.display = "block";
  message.style.color = "white";
  message.innerHTML = `<p>⚪ <b>${username.value}</b> logged out.</p>`;
  fileInput.value = "";
  clearTable();
  clearList();
  clearSelectOptions();
  allowCSVUpload(false);
  showBulkDispoButton(false);
  showMatchSkillsButton(false);
  showDispositionsMenu(false);
  enableFilter(false);
  showLogout(false);
  changePanelText(true, "You will see more info below once logged in.");
  loginSate = 0;
  console.log("LoginState: " + loginSate);
  window.location.reload(true);
}

function resetTimeout() {
  clearTimeout(timeoutID);
  timeoutID = setTimeout(() => {
    if (loginSate == 0) {
      return;
    } else {
      logoutUser();
      alert("You have been logged out due to inactivity.");
      window.location.reload(true);
    }
  }, TIMEOUT_DURATION);
}

function setupActivityListeners() {
  document.addEventListener("mousemove", resetTimeout);
  document.addEventListener("keypress", resetTimeout);
  document.addEventListener("touchstart", resetTimeout);
  document.addEventListener("scroll", resetTimeout);
}

function initializeSessionTimeout() {
  setupActivityListeners();
  resetTimeout(); //start the timeout timer
}

function clearList() {
  const list = document.querySelector(".list-group");
  if (list) {
    list.innerHTML = "";
  }
}

function clearSelectOptions() {
  const selectElement = document.getElementById("dispositions");
  while (selectElement.firstChild) {
    selectElement.removeChild(selectElement.firstChild);
  }
}

async function agentAcceptNotice(noticeId) {
  const response = await request(
    "PUT",
    `https://${host}/appsvcs/rs/svc/agents/${userId}/maintenance_notices/${noticeId}/accept`
  );
  console.log("Notice has been accepted: " + response);
  sendMessageBanner(JSON.parse(response).annotation);
}

async function agentGetNotice() {
  const response = await request(
    "GET",
    `https://${host}/appsvcs/rs/svc/agents/${userId}/maintenance_notices`
  );
  console.log("Notice Maintenance: " + response);
  JSON.parse(response).forEach((notice) => agentAcceptNotice(notice.id));
}
