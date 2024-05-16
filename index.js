/* exported gapiLoaded */
/* exported gisLoaded */
/* exported handleAuthClick */
/* exported handleSignoutClick */

// TODO(developer): Set to client ID and API key from the Developer Console
const CLIENT_ID = "clientId";
const API_KEY = "apiKey";
// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_CAL =
  "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

const DISCOVERY_GMAIL =
  "https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest";
// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES =
  "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly";

let tokenClient;
let gapiInited = false;
let gisInited = false;

document.getElementById("authorize_button").style.visibility = "hidden";
document.getElementById("signout_button").style.visibility = "hidden";

/**
 * Callback after api.js is loaded.
 */
function gapiLoaded() {
  gapi.load("client", initializeGapiClient);
}

/**
 * Callback after the API client is loaded. Loads the
 * discovery doc to initialize the API.
 */
async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: [DISCOVERY_CAL, DISCOVERY_GMAIL],
  });
  gapiInited = true;
  maybeEnableButtons();
  loadSavedToken();
}

/**
 * Callback after Google Identity Services are loaded.
 */
function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: "", // defined later
  });
  gisInited = true;
  maybeEnableButtons();
}

/**
 * Enables user interaction after all libraries are loaded.
 */
function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    document.getElementById("authorize_button").style.visibility = "visible";
  }
}

/**
 * Load the saved access token, if available
 */
function loadSavedToken() {
  const tokenInfo = JSON.parse(localStorage.getItem("gapi_token_info"));
  if (tokenInfo && new Date(tokenInfo.expires_at) > new Date()) {
    gapi.client.setToken(tokenInfo);
    document.getElementById("authorize_button").innerText = "Refresh";
    document.getElementById("signout_button").style.visibility = "visible";
  }
}

/**
 * Save the access token to localStorage
 */
function saveTokenInfo(tokenInfo) {
  const expiresIn = tokenInfo.expires_in || 3600; // 1 hour default
  const expiresAt = new Date().getTime() + expiresIn * 1000;

  const tokenData = {
    access_token: tokenInfo.access_token,
    expires_in: tokenInfo.expires_in,
    expires_at: expiresAt,
  };

  localStorage.setItem("gapi_token_info", JSON.stringify(tokenData));
}

/**
 *  Sign in the user upon button click.
 */

function handleAuthClick() {
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      throw resp;
    }
    document.getElementById("signout_button").style.visibility = "visible";
    document.getElementById("authorize_button").innerText = "Refresh";
    saveTokenInfo(gapi.client.getToken());
  };

  if (gapi.client.getToken() === null) {
    // Prompt the user to select a Google Account and ask for consent to share their data
    // when establishing a new session.
    tokenClient.requestAccessToken({ prompt: "consent" });
  } else {
    // Skip display of account chooser and consent dialog for an existing session.
    tokenClient.requestAccessToken({ prompt: "" });
  }
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken("");
    document.getElementById("content").innerText = "";
    localStorage.removeItem("gapi_token_info");
    document.getElementById("authorize_button").innerText = "Authorize";
    document.getElementById("signout_button").style.visibility = "hidden";
  }
}

/**
 * Print the summary and start datetime/date of the next ten events in
 * the authorized user's calendar. If no events are found an
 * appropriate message is printed.
 */
async function listUpcomingEvents() {
  let response;
  try {
    const request = {
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      showDeleted: false,
      singleEvents: true,
      maxResults: 10,
      orderBy: "startTime",
    };
    response = await gapi.client.calendar.events.list(request);
  } catch (err) {
    document.getElementById("content").innerText = err.message;
    return;
  }

  const events = response.result.items;
  if (!events || events.length == 0) {
    document.getElementById("content").innerText = "No events found.";
    return;
  }
  // Flatten to string to display
  console.log(events);
  const output = events.reduce(
    (str, event) =>
      `${str}${event.summary} (${event.start.dateTime || event.start.date})\n`,
    "Events:\n"
  );
  document.getElementById("content").innerText = output;
}

async function listEventBetween(start, end) {
  let response;
  try {
    const request = {
      calendarId: "primary",
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      showDeleted: false,
      singleEvents: true,
      maxResults: 10,
      orderBy: "startTime",
    };
    response = await gapi.client.calendar.events.list(request);
  } catch (err) {
    document.getElementById("content").innerText = err.message;
    return;
  }

  const events = response.result.items;
  if (!events || events.length == 0) {
    document.getElementById("content").innerText = "No events found.";
    return;
  }
  // Flatten to string to display
  console.log(events);
  const output = events.reduce(
    (str, event) =>
      `${str}${event.summary} (${event.start.dateTime || event.start.date})\n`,
    "Events:\n"
  );
  document.getElementById("content").innerText = output;
}

/**
 *
 * GMAIL
 *
 * **/

/**
 * Print all Labels in the authorized user's inbox. If no labels
 * are found an appropriate message is printed.
 */

async function listMessagesBetween(date) {
  let response;
  try {
    response = await gapi.client.gmail.users.messages.list({
      userId: "me",
      q: `after:${date.getFullYear()}/${
        date.getMonth() + 1
      }/${date.getUTCDay()} before:${date.getFullYear()}/${
        date.getMonth() + 1
      }/${date.getUTCDay() + 1}`,
    });
  } catch (err) {
    document.getElementById("mail-content").innerText = err.message;
    return;
  }
  const messages = response.result.messages;
  if (!messages || messages.length == 0) {
    //create div for each message

    document.getElementById("mail-content").innerText = "No messages found.";
    return;
  }
  // Flatten to string to display
  const emailDetailsPromises = messages.map((message) =>
    gapi.client.gmail.users.messages.get({
      userId: "me",
      id: message.id,
    })
  );

  try {
    const emailDetails = await Promise.all(emailDetailsPromises);
    const output = emailDetails.reduce((str, email) => {
      const subjectHeader = email.result.payload.headers.find(
        (header) => header.name === "Subject"
      );
      const subject = subjectHeader ? subjectHeader.value : "(No Subject)";
      const receivedDate = new Date(
        parseInt(email.result.internalDate, 10)
      ).toUTCString();
      return `${str} ${receivedDate} ${subject}\n`;
    }, "Emails:\n");
    document.getElementById("mail-content").innerText = output;
  } catch (err) {
    document.getElementById("mail-content").innerText = err.message;
  }
}
function getEventsDay() {
  const date = document.querySelector("#date").value;
  const start = new Date(`${date} 00:00 UTC`);
  const end = new Date(`${date} 23:59 UTC`);
  listEventBetween(start, end);
  listMessagesBetween(start);
  console.log("start", start.getUTCDate(), "end", end.getUTCDate());
  window.postMessage(
    {
      type: "REQUEST_BROWSER_HISTORY",
      payload: { startTime: start.getTime(), endTime: end.getTime() },
    },
    "*"
  );
}

/*
 *
 * BROWSER HISTORY
 *
 * */

window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data.type) {
    return;
  }

  if (event.data.type === "BROWSER_HISTORY") {
    console.log("Received browser history from extension:", event.data.data);
    // Flatten to string to display
    const output = event.data.data.reduce(
      (str, historyItem) =>
        `${str}${new Date(historyItem.lastVisitTime).toUTCString()} ${
          historyItem.title
        }\n`,
      "History:\n"
    );

    document.getElementById("history-content").innerText = output;
  }
});
