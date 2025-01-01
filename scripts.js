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
  logoutUser();
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
          const headersToShow = text
            .split("\n")[0]
            .split(",")
            .map(
              (x, i) =>
                defaultHeaders.map((y) => y == x && i).filter((z) => z)[0]
            )
            .filter((a) => a);

          const newCSV = text
            .split("\n")
            .map((row) => {
              return headersToShow.map(
                (col) =>
                  row
                    .replace(
                      /^"(.*?)"/gm,
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
            sendMessageBanner(
              "You have uploaded an incorrect csv file. Please review the file."
            );
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
    // try {
    alert(
      "Please have your admin assign you the skills needed for deprovisioning."
    );
    // const res = await getSkills();
    // const skillIDsToMatch = skillsFromCSV.map((skill) =>
    //   JSON.parse(res)
    //     .map((skilldata) => skilldata.name == skill && skilldata.id)
    //     .filter((removeFalseResult) => removeFalseResult)
    // );
    //alert(skillIDsToMatch);
    //assignSkillsToMatch(JSON.stringify(skillIDsToMatch.flat()));
    // } catch (error) {
    //   alert(error);
    // }
  });

document.getElementById("bulkDispo").addEventListener("click", function (e) {
  bulkDispoTable();
});

async function login() {
  const usernameValue = document.getElementById("username").value;
  const passwordValue = document.getElementById("password").value;
  const urldEndpoint = "https://app.five9.com/appsvcs/rs/svc/auth/login";
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
    const result = await response.json();
    console.log("Post Request Success:", result);

    return JSON.stringify(result);
  } catch (error) {
    alert(`Post Request error:\n ${error}`);
  }
}

function getSkill() {
  request("GET", `https://${host}/appsvcs/rs/svc/agents/${userId}/skills`).then(
    (result) => {
      ids = JSON.parse(result).map((x) => x.id);
      userSkills = JSON.parse(result).map((x) => x.name);

      var ul = document.querySelector(".list-group");

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

  //CHECK IF SKILLS MATCH THE SKILLS IN UPLOADED CSV FILE.
  checkSkills();
}

function allowCSVUpload(value) {
  const element = document.getElementById("csvFileInput");
  const element2 = document.getElementById("filter");
  if (value === true) {
    element.style.pointerEvents = "auto";
    element.style.cursor = "pointer";
    element.style.opacity = "1";
  }
}

function enableFilter(value) {
  const filter = document.getElementById("dropdown");
  value == true ? (filter.disabled = false) : (filter.disabled = true);
}

function showMessage(message) {
  const element = document.getElementById("message");
  document.getElementById("message").innerHTML = `<p>${message}</p>`;
  element.style.display = "block";
  setTimeout(() => {
    element.style.display = "none";
  }, 5000);
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
      message.innerHTML = `<p>Logged In: ${username.value}</p>`;
      message.style.display = "block";
      message.style.fontSize = "15px";
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
  banner.style.color = "yellow";
  banner.style.textShadow =
    "0 0 10px yellowGreen, 0 0 20px yellowGreen, 0 0 30px yellowGreen";
  setTimeout(() => {
    banner.style.color = "rgba(241, 241, 241, 0.5)";
    banner.style.textShadow = "2px 2px 4px";
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
  //Dynamically get the index of skills column anywhere from the csv file.
  const getIndexOfSkillsFromCSV = csvData
    .split("\n")[0]
    .split(",")
    .map((col, index) => col.toLowerCase() == "skill" && index)
    .filter((removeFalseResult) => removeFalseResult);
  const csvSkills = csvData.split("\n").map((row) =>
    row
      .split(",")
      .map((col, index) => index == getIndexOfSkillsFromCSV[0] && col)
      .filter((removeFalseResult) => removeFalseResult)
  );

  skillsFromCSV = [...new Set(csvSkills.flat(1))];

  //remove column name 'SKILL'
  skillsFromCSV.shift();

  if (userSkills.length < skillsFromCSV.length) {
    showMatchSkillsButton(true);
    enableFilter(false);
    sendMessageBanner(
      "Please note that your USER has only " +
        userSkills.length +
        " skill(s) assigned, while the uploaded CSV requires " +
        skillsFromCSV.length +
        " skills."
    );
  } else {
    const result = userSkills.map((userSkill) =>
      skillsFromCSV.map((csvSkill) => userSkill == csvSkill && csvSkill)
    );
    enableFilter(true);
    showDispositionsMenu(true);
    showBulkDispoButton(true);
    showMatchSkillsButton(false);
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

async function getSkills() {
  try {
    const response = await request(
      "GET",
      `https://${host}/appsvcs/rs/svc/orgs/${orgID}/skills`
    );
    return response;
  } catch (error) {
    alert(error);
    throw error;
  }
}

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
      alert("Encountered SELECT_STATION during login, trying to fix it..");
      handleSelectStation();
    }

    if (response.replace(/"/g, "") == "SELECT_SKILLS") {
      alert("Encountered SELECT_SKILLS during login, trying to fix it..");
      handleSelectStation();
    }

    if (response.replace(/"/g, "") == "WORKING") {
      getSkill();
    }
  } catch (error) {
    alert(`checkLoginAPIUser error:\n${error}`);
    console.log(`checkLoginAPIUser error:\n${error}`);
  }
}

async function bulkDispoTable() {
  const table = document.getElementById("csvTable");
  const rows = table.querySelectorAll("tbody tr");
  const selectedDispo = document.getElementById("dispositions").value;
  const dispositionId = dispositionsCopy.filter(
    (dispo) => dispo.name == selectedDispo
  )[0].id;

  for (const row of rows) {
    const GUID = row.querySelector("th").textContent;
    const thElement = row.querySelector("th");

    try {
      const result = await getInteractionDetails(GUID);
      thElement.style.color = "green";
      const profileId = JSON.parse(result).profileId;
      const mediaType = JSON.parse(result).mediaType;
    } catch (error) {
      console.error(
        `Error fetching interaction details for GUID: ${GUID}`,
        error
      );
    }
  }
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
    sendMessageBanner("Station set: " + response);
    checkLoginAPIUser();
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
    sendMessageBanner("From handleSelectSkills \n" + response);
  } catch (error) {
    sendMessageBanner(error);
  }
}

async function acceptChatEmail(profileId, mediaType, type) {
  const requestBody = {
    profileId: profileId,
    mediaType: mediaType,
    type: type,
  };
  const jsonBody = JSON.stringify(requestBody);
}

async function disposeChatEmail(profileId, mediaType, dispositionId, isClose) {
  const requestBody = {
    profileId: profileId,
    mediaType: mediaType,
    dispositionId: dispositionId,
    isClose: isClose,
  };
  const jsonBody = JSON.stringify(requestBody);
}

function showLogout(value) {
  const logout = document.getElementById("logout");
  if (value == true) {
    logout.style.display = "block";
  } else {
    logout.style.display = "none";
  }
}

async function logoutUser() {
  // const response = await request(
  //   "POST",
  //   `https://app.five9.com/appsvcs/rs/svc/auth/logout`,
  //   JSON.stringify()
  // );
  // sendMessageBanner("User has been logged out " + response);
  window.location.reload(true);
}
