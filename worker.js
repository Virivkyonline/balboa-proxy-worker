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

    function makeTextResponse(text, status) {
      return new Response(text, {
        status,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }

    function makeJsonResponse(obj, status) {
      return new Response(JSON.stringify(obj, null, 2), {
        status,
        headers: {
          "Access-Control-Allow-Origin": "*",
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

    function bytesToBase64(bytes) {
      let bin = "";
      for (let i = 0; i < bytes.length; i++) {
        bin += String.fromCharCode(bytes[i]);
      }
      return btoa(bin);
    }

    function parseIntSafe(value, fallback) {
      const n = parseInt(String(value), 10);
      return Number.isNaN(n) ? fallback : n;
    }

    function clamp(num, min, max) {
      return Math.max(min, Math.min(max, num));
    }

    function checksumBytes(bytes) {
      let sum = 0;
      for (let i = 0; i < bytes.length; i++) {
        sum = (sum + bytes[i]) & 0xff;
      }
      return (0x100 - sum) & 0xff;
    }

    async function sciPostXml(body) {
      const resp = await fetch(
        "https://my.idigi.com/ws/sci?unused=" + crypto.randomUUID(),
        {
          method: "POST",
          headers: {
            "Authorization": auth,
            "Content-Type": "text/xml",
            "Accept": "*/*"
          },
          body
        }
      );

      const text = await resp.text();

      return {
        ok: resp.ok,
        status: resp.status,
        text
      };
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

      const result = await sciPostXml(body);
      const xmlText = result.text;
      const base64Data = extractDataTag(xmlText);

      let bytes = new Uint8Array(0);
      let hex = "";

      if (base64Data) {
        try {
          bytes = base64ToBytes(base64Data);
          hex = bytesToHex(bytes);
        } catch (e) {
          hex = "";
        }
      }

      return makeJsonResponse({
        ok: result.ok,
        status: result.status,
        file: path,
        deviceId,
        base64: base64Data,
        bytesLength: bytes.length,
        hex,
        xml: xmlText
      }, result.status);
    }

    async function sendButtonCode(code) {
      const body =
        '<?xml version="1.0"?>' +
        '<sci_request version="1.0">' +
        '<data_service>' +
        '<targets><device id="' + deviceId + '"/></targets>' +
        '<requests>' +
        '<device_request target_name="Button">' + String(code) + '</device_request>' +
        '</requests>' +
        '</data_service>' +
        '</sci_request>';

      const result = await sciPostXml(body);

      return makeJsonResponse({
        ok: result.ok,
        status: result.status,
        action: "button",
        code,
        deviceId,
        response: result.text
      }, result.status);
    }

    async function sendDataService(targetName, value, noSpaces = false) {
      const innerValue = noSpaces ? String(value) : (" " + String(value) + " ");

      const body =
        '<?xml version="1.0"?>' +
        '<sci_request version="1.0">' +
        '<data_service>' +
        '<targets><device id="' + deviceId + '"/></targets>' +
        '<requests>' +
        '<device_request target_name="' + targetName + '">' + innerValue + '</device_request>' +
        '</requests>' +
        '</data_service>' +
        '</sci_request>';

      const result = await sciPostXml(body);

      return makeJsonResponse({
        ok: result.ok,
        status: result.status,
        target: targetName,
        value,
        deviceId,
        response: result.text
      }, result.status);
    }

    function buildFiltersPacket(params) {
      const f1h = clamp(parseIntSafe(params.f1h, 0), 0, 23);
      const f1m = clamp(parseIntSafe(params.f1m, 0), 0, 59);
      const f1dh = clamp(parseIntSafe(params.f1dh, 0), 0, 23);
      const f1dm = clamp(parseIntSafe(params.f1dm, 0), 0, 59);

      const f2enabled =
        String(params.f2enabled || "").toLowerCase() === "1" ||
        String(params.f2enabled || "").toLowerCase() === "true" ||
        String(params.f2enabled || "").toLowerCase() === "yes" ||
        String(params.f2enabled || "").toLowerCase() === "on";

      const f2h = clamp(parseIntSafe(params.f2h, 0), 0, 23);
      const f2m = clamp(parseIntSafe(params.f2m, 0), 0, 59);
      const f2dh = clamp(parseIntSafe(params.f2dh, 0), 0, 23);
      const f2dm = clamp(parseIntSafe(params.f2dm, 0), 0, 59);

      const bytes = new Uint8Array(13);
      bytes[0] = 13;
      bytes[1] = 10;
      bytes[2] = 0xbf;
      bytes[3] = 0x23;
      bytes[4] = f1h;
      bytes[5] = f1m;
      bytes[6] = f1dh;
      bytes[7] = f1dm;
      bytes[8] = (f2enabled ? 0x80 : 0x00) | (f2h & 0x7f);
      bytes[9] = f2m;
      bytes[10] = f2dh;
      bytes[11] = f2dm;
      bytes[12] = checksumBytes(bytes.slice(0, 12));

      return {
        bytes,
        base64: bytesToBase64(bytes),
        hex: bytesToHex(bytes),
        parsed: {
          f1h, f1m, f1dh, f1dm,
          f2enabled, f2h, f2m, f2dh, f2dm
        }
      };
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

    if (url.pathname === "/settime") {
      const hhRaw = url.searchParams.get("hh");
      const mmRaw = url.searchParams.get("mm");

      if (hhRaw === null || mmRaw === null) {
        return makeJsonResponse({
          ok: false,
          error: "Použi /settime?hh=16&mm=45"
        }, 400);
      }

      const hh = parseInt(hhRaw, 10);
      const mm = parseInt(mmRaw, 10);

      if (
        Number.isNaN(hh) || Number.isNaN(mm) ||
        hh < 0 || hh > 23 || mm < 0 || mm > 59
      ) {
        return makeJsonResponse({
          ok: false,
          error: "Neplatný čas"
        }, 400);
      }

      const timeStr = String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
      return sendDataService("SystemTime", timeStr, false);
    }

    if (url.pathname === "/timeformat") {
      const format = String(url.searchParams.get("value") || "").trim();

      if (format !== "12" && format !== "24") {
        return makeJsonResponse({
          ok: false,
          error: "Použi /timeformat?value=12 alebo /timeformat?value=24"
        }, 400);
      }

      return sendDataService("TimeFormat", format, false);
    }

    if (url.pathname === "/getfilters") {
      return sendDataService("Request", "Filters", false);
    }

    if (url.pathname === "/savefilters") {
      const packet = buildFiltersPacket({
        f1h: url.searchParams.get("f1h"),
        f1m: url.searchParams.get("f1m"),
        f1dh: url.searchParams.get("f1dh"),
        f1dm: url.searchParams.get("f1dm"),
        f2enabled: url.searchParams.get("f2enabled"),
        f2h: url.searchParams.get("f2h"),
        f2m: url.searchParams.get("f2m"),
        f2dh: url.searchParams.get("f2dh"),
        f2dm: url.searchParams.get("f2dm")
      });

      const body =
        '<?xml version="1.0"?>' +
        '<sci_request version="1.0">' +
        '<data_service>' +
        '<targets><device id="' + deviceId + '"/></targets>' +
        '<requests>' +
        '<device_request target_name="Filters">' + packet.base64 + '</device_request>' +
        '</requests>' +
        '</data_service>' +
        '</sci_request>';

      const result = await sciPostXml(body);

      return makeJsonResponse({
        ok: result.ok,
        status: result.status,
        target: "Filters",
        deviceId,
        parsed: packet.parsed,
        base64: packet.base64,
        hex: packet.hex,
        response: result.text
      }, result.status);
    }

    return makeTextResponse("Balboa worker running", 200);
  }
};
