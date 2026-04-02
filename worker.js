export default {
  async fetch(request) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response("", { headers: corsHeaders });
    }

    const user = "BalboaWaterAndroidApp";
    const pass = "SW2Bra7a!";
    const auth = "Basic " + btoa(user + ":" + pass);
    const deviceId = "00000000-00000000-001527FF-FF3B516E";
    const sciUrl = "https://my.idigi.com/ws/sci?unused=" + crypto.randomUUID();

    function makeTextResponse(text, status = 200) {
      return new Response(text, {
        status,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }

    function makeJsonResponse(obj, status = 200) {
      return new Response(JSON.stringify(obj, null, 2), {
        status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8"
        }
      });
    }

    function extractDataTag(xmlText) {
      const match = xmlText.match(/<data>([\s\S]*?)<\/data>/i);
      return match ? match[1].trim() : "";
    }

    function base64ToBytes(base64) {
      const bin = atob(base64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        out[i] = bin.charCodeAt(i);
      }
      return out;
    }

    function bytesToHex(bytes) {
      let hex = "";
      for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, "0");
      }
      return hex;
    }

    async function sciGetFile(path) {
      const body =
        '<?xml version="1.0"?>' +
        '<sci_request version="1.0">' +
        '<file_system cache="false">' +
        '<targets><device id="' + deviceId + '"/></targets>' +
        '<commands><get_file path="' + path + '"/></commands>' +
        '</file_system>' +
        '</sci_request>';

      const resp = await fetch(sciUrl, {
        method: "POST",
        headers: {
          "Authorization": auth,
          "Content-Type": "text/xml",
          "Accept": "*/*"
        },
        body
      });

      const xmlText = await resp.text();
      const base64Data = extractDataTag(xmlText);

      let bytes = new Uint8Array(0);
      let hex = "";

      if (base64Data) {
        try {
          bytes = base64ToBytes(base64Data);
          hex = bytesToHex(bytes);
        } catch {
          bytes = new Uint8Array(0);
          hex = "";
        }
      }

      return makeJsonResponse({
        ok: resp.ok,
        status: resp.status,
        file: path,
        deviceId,
        base64: base64Data,
        bytesLength: bytes.length,
        hex,
        xml: xmlText
      }, resp.status);
    }

    async function sendDeviceRequest(targetName, value) {
      const safeValue = String(value);

      const body =
        '<?xml version="1.0"?>' +
        '<sci_request version="1.0">' +
        '<data_service>' +
        '<targets><device id="' + deviceId + '"/></targets>' +
        '<requests>' +
        '<device_request target_name="' + targetName + '">' + safeValue + '</device_request>' +
        '</requests>' +
        '</data_service>' +
        '</sci_request>';

      const resp = await fetch(sciUrl, {
        method: "POST",
        headers: {
          "Authorization": auth,
          "Content-Type": "text/xml",
          "Accept": "*/*"
        },
        body
      });

      const text = await resp.text();

      return makeJsonResponse({
        ok: resp.ok,
        status: resp.status,
        action: targetName,
        value: safeValue,
        deviceId,
        response: text
      }, resp.status);
    }

    async function sendButtonCode(code) {
      return sendDeviceRequest("Button", String(code));
    }

    if (url.pathname === "/") {
      return makeTextResponse("Balboa worker running", 200);
    }

    if (url.pathname === "/panelupdate") {
      return sciGetFile("PanelUpdate.txt");
    }

    if (url.pathname === "/deviceconfig") {
      return sciGetFile("DeviceConfiguration.txt");
    }

    if (url.pathname === "/button") {
      const codeParam = (url.searchParams.get("code") || "").trim();
      const code = parseInt(codeParam, 10);

      if (!codeParam || Number.isNaN(code)) {
        return makeJsonResponse({
          ok: false,
          error: "Chýba alebo je neplatný parameter code"
        }, 400);
      }

      return sendButtonCode(code);
    }

    if (url.pathname === "/settemp") {
      const valueParam = (url.searchParams.get("value") || "").trim();
      const value = Number(valueParam);

      if (!valueParam || !Number.isFinite(value)) {
        return makeJsonResponse({
          ok: false,
          error: "Chýba alebo je neplatný parameter value"
        }, 400);
      }

      return sendDeviceRequest("SetTemp", valueParam);
    }

    if (url.pathname === "/tempunits") {
      const value = (url.searchParams.get("value") || "").trim().toUpperCase();

      if (value !== "C" && value !== "F") {
        return makeJsonResponse({
          ok: false,
          error: "Parameter value musí byť C alebo F"
        }, 400);
      }

      return sendDeviceRequest("TempUnits", value);
    }

    if (url.pathname === "/systemtime") {
      const hhParam = (url.searchParams.get("hh") || "").trim();
      const mmParam = (url.searchParams.get("mm") || "").trim();

      const hh = Number(hhParam);
      const mm = Number(mmParam);

      if (
        !Number.isInteger(hh) ||
        !Number.isInteger(mm) ||
        hh < 0 || hh > 23 ||
        mm < 0 || mm > 59
      ) {
        return makeJsonResponse({
          ok: false,
          error: "Parametre hh a mm musia byť platné čísla času"
        }, 400);
      }

      const timeValue =
        String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");

      return sendDeviceRequest("SystemTime", timeValue);
    }

    if (url.pathname === "/timeformat") {
      const value = (url.searchParams.get("value") || "").trim();

      if (value !== "12" && value !== "24") {
        return makeJsonResponse({
          ok: false,
          error: "Parameter value musí byť 12 alebo 24"
        }, 400);
      }

      return sendDeviceRequest("TimeFormat", value);
    }

    if (url.pathname === "/filters") {
      const value = (url.searchParams.get("value") || "").trim();

      if (!value) {
        return makeJsonResponse({
          ok: false,
          error: "Chýba parameter value"
        }, 400);
      }

      return sendDeviceRequest("Filters", value);
    }

    if (url.pathname === "/requestfilters") {
      return sendDeviceRequest("Request", "Filters");
    }

    if (url.pathname === "/buttons") {
      return makeJsonResponse({
        deviceId,
        buttons: [
          { name: "Pump1", code: 4 },
          { name: "Pump2", code: 5 },
          { name: "Pump3", code: 6 },
          { name: "Pump4", code: 7 },
          { name: "Pump5", code: 8 },
          { name: "Pump6", code: 9 },
          { name: "Blower", code: 12 },
          { name: "Mister", code: 14 },
          { name: "Light1", code: 17 },
          { name: "Light2", code: 18 },
          { name: "Aux1", code: 22 },
          { name: "Aux2", code: 23 },
          { name: "TempRange", code: 80 },
          { name: "HeatMode", code: 81 }
        ]
      }, 200);
    }

    return makeJsonResponse({
      ok: false,
      error: "Neznáma cesta"
    }, 404);
  }
};
