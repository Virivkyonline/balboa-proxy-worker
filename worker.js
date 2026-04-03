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

    function extractDeviceRequestText(xmlText) {
      const match = xmlText.match(/<device_request\b[^>]*>([\s\S]*?)<\/device_request>/i);
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

    function calcChecksum(bytes, length) {
      let crc = 0xB5;
      for (let i = 0; i < length; i++) {
        crc ^= bytes[i];
        for (let b = 0; b < 8; b++) {
          if (crc & 0x80) {
            crc = ((crc << 1) ^ 0x07) & 0xFF;
          } else {
            crc = (crc << 1) & 0xFF;
          }
        }
      }
      return crc & 0xFF;
    }

    function parseFilterCycleBytes(bytes) {
  if (!bytes || bytes.length < 12) return null;

  const cycle2Byte = bytes[8] ?? 0;

  const fc1Hour = bytes[4] ?? 0;
  const fc1Min = bytes[5] ?? 0;
  const fc1DurHour = bytes[6] ?? 0;
  const fc1DurMin = bytes[7] ?? 0;

  const fc2Enabled = (cycle2Byte & 0x80) !== 0;
  const fc2Hour = cycle2Byte & 0x7F;
  const fc2Min = bytes[9] ?? 0;
  const fc2DurHour = bytes[10] ?? 0;
  const fc2DurMin = bytes[11] ?? 0;

  return {
    filterCycle1: {
      startsAtHour: fc1Hour,
      startsAtMinute: fc1Min,
      durationHour: fc1DurHour,
      durationMinute: fc1DurMin
    },
    filterCycle2: {
      enabled: fc2Enabled,
      startsAtHour: fc2Hour,
      startsAtMinute: fc2Min,
      durationHour: fc2DurHour,
      durationMinute: fc2DurMin
    }
  };
}

    function buildFilterCycleBase64(fc1Hour, fc1Min, fc1DurHour, fc1DurMin, fc2Enabled, fc2Hour, fc2Min, fc2DurHour, fc2DurMin) {
      const bytes = new Uint8Array(13);
      bytes[0] = 13;
      bytes[1] = 10;
      bytes[2] = 191;
      bytes[3] = 35;
      bytes[4] = fc1Hour & 0xFF;
      bytes[5] = fc1Min & 0xFF;
      bytes[6] = fc1DurHour & 0xFF;
      bytes[7] = fc1DurMin & 0xFF;
      bytes[8] = ((fc2Enabled ? 0x80 : 0x00) | (fc2Hour & 0x7F)) & 0xFF;
      bytes[9] = fc2Min & 0xFF;
      bytes[10] = fc2DurHour & 0xFF;
      bytes[11] = fc2DurMin & 0xFF;
      bytes[12] = calcChecksum(bytes, 12);

      let bin = "";
      for (let i = 0; i < bytes.length; i++) {
        bin += String.fromCharCode(bytes[i]);
      }
      return {
        base64: btoa(bin),
        bytes,
        hex: bytesToHex(bytes)
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

      return { resp, text, targetName, value: safeValue };
    }

    async function sendButtonCode(code) {
      const result = await sendDeviceRequest("Button", String(code));
      return makeJsonResponse({
        ok: result.resp.ok,
        status: result.resp.status,
        action: "Button",
        value: String(code),
        deviceId,
        response: result.text
      }, result.resp.status);
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

      const result = await sendDeviceRequest("SetTemp", valueParam);
      return makeJsonResponse({
        ok: result.resp.ok,
        status: result.resp.status,
        action: "SetTemp",
        value: valueParam,
        deviceId,
        response: result.text
      }, result.resp.status);
    }

    if (url.pathname === "/tempunits") {
      const value = (url.searchParams.get("value") || "").trim().toUpperCase();

      if (value !== "C" && value !== "F") {
        return makeJsonResponse({
          ok: false,
          error: "Parameter value musí byť C alebo F"
        }, 400);
      }

      const result = await sendDeviceRequest("TempUnits", value);
      return makeJsonResponse({
        ok: result.resp.ok,
        status: result.resp.status,
        action: "TempUnits",
        value,
        deviceId,
        response: result.text
      }, result.resp.status);
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

      const result = await sendDeviceRequest("SystemTime", timeValue);
      return makeJsonResponse({
        ok: result.resp.ok,
        status: result.resp.status,
        action: "SystemTime",
        value: timeValue,
        deviceId,
        response: result.text
      }, result.resp.status);
    }

    if (url.pathname === "/timeformat") {
      const value = (url.searchParams.get("value") || "").trim();

      if (value !== "12" && value !== "24") {
        return makeJsonResponse({
          ok: false,
          error: "Parameter value musí byť 12 alebo 24"
        }, 400);
      }

      const result = await sendDeviceRequest("TimeFormat", value);
      return makeJsonResponse({
        ok: result.resp.ok,
        status: result.resp.status,
        action: "TimeFormat",
        value,
        deviceId,
        response: result.text
      }, result.resp.status);
    }

    if (url.pathname === "/filters") {
      const rawValue = (url.searchParams.get("value") || "").trim();

      // Podpora pôvodného priameho value
      if (rawValue) {
        const result = await sendDeviceRequest("Filters", rawValue);
        return makeJsonResponse({
          ok: result.resp.ok,
          status: result.resp.status,
          action: "Filters",
          value: rawValue,
          deviceId,
          response: result.text
        }, result.resp.status);
      }

      const fc1Hour = Number(url.searchParams.get("f1h"));
      const fc1Min = Number(url.searchParams.get("f1m"));
      const fc1DurHour = Number(url.searchParams.get("f1dh"));
      const fc1DurMin = Number(url.searchParams.get("f1dm"));
      const fc2EnabledParam = (url.searchParams.get("f2en") || "").trim().toLowerCase();
      const fc2Hour = Number(url.searchParams.get("f2h"));
      const fc2Min = Number(url.searchParams.get("f2m"));
      const fc2DurHour = Number(url.searchParams.get("f2dh"));
      const fc2DurMin = Number(url.searchParams.get("f2dm"));

      const valid =
        Number.isInteger(fc1Hour) && fc1Hour >= 0 && fc1Hour <= 23 &&
        Number.isInteger(fc1Min) && fc1Min >= 0 && fc1Min <= 59 &&
        Number.isInteger(fc1DurHour) && fc1DurHour >= 0 && fc1DurHour <= 23 &&
        Number.isInteger(fc1DurMin) && fc1DurMin >= 0 && fc1DurMin <= 59 &&
        Number.isInteger(fc2Hour) && fc2Hour >= 0 && fc2Hour <= 23 &&
        Number.isInteger(fc2Min) && fc2Min >= 0 && fc2Min <= 59 &&
        Number.isInteger(fc2DurHour) && fc2DurHour >= 0 && fc2DurHour <= 23 &&
        Number.isInteger(fc2DurMin) && fc2DurMin >= 0 && fc2DurMin <= 59 &&
        (fc2EnabledParam === "1" || fc2EnabledParam === "0" || fc2EnabledParam === "true" || fc2EnabledParam === "false");

      if (!valid) {
        return makeJsonResponse({
          ok: false,
          error: "Chýba parameter value alebo sú neplatné parametre f1h,f1m,f1dh,f1dm,f2en,f2h,f2m,f2dh,f2dm"
        }, 400);
      }

      const fc2Enabled = fc2EnabledParam === "1" || fc2EnabledParam === "true";
      const built = buildFilterCycleBase64(
        fc1Hour, fc1Min, fc1DurHour, fc1DurMin,
        fc2Enabled, fc2Hour, fc2Min, fc2DurHour, fc2DurMin
      );

      const result = await sendDeviceRequest("Filters", built.base64);

      return makeJsonResponse({
        ok: result.resp.ok,
        status: result.resp.status,
        action: "Filters",
        deviceId,
        request: {
          f1h: fc1Hour,
          f1m: fc1Min,
          f1dh: fc1DurHour,
          f1dm: fc1DurMin,
          f2en: fc2Enabled,
          f2h: fc2Hour,
          f2m: fc2Min,
          f2dh: fc2DurHour,
          f2dm: fc2DurMin
        },
        encoded: {
          base64: built.base64,
          hex: built.hex
        },
        response: result.text
      }, result.resp.status);
    }

    if (url.pathname === "/requestfilters") {
      const result = await sendDeviceRequest("Request", "Filters");
      const base64Data = extractDeviceRequestText(result.text);

      let bytes = new Uint8Array(0);
      let hex = "";
      let parsed = null;

      if (base64Data) {
        try {
          bytes = base64ToBytes(base64Data);
          hex = bytesToHex(bytes);
          parsed = parseFilterCycleBytes(bytes);
        } catch {
          bytes = new Uint8Array(0);
          hex = "";
          parsed = null;
        }
      }

      return makeJsonResponse({
        ok: result.resp.ok,
        status: result.resp.status,
        action: "Request",
        value: "Filters",
        deviceId,
        base64: base64Data,
        bytesLength: bytes.length,
        hex,
        parsed,
        response: result.text
      }, result.resp.status);
    }

    if (url.pathname === "/getfilters") {
      const result = await sendDeviceRequest("Request", "Filters");
      const base64Data = extractDeviceRequestText(result.text);

      let bytes = new Uint8Array(0);
      let hex = "";
      let parsed = null;

      if (base64Data) {
        try {
          bytes = base64ToBytes(base64Data);
          hex = bytesToHex(bytes);
          parsed = parseFilterCycleBytes(bytes);
        } catch {
          bytes = new Uint8Array(0);
          hex = "";
          parsed = null;
        }
      }

      return makeJsonResponse({
        ok: result.resp.ok,
        status: result.resp.status,
        deviceId,
        base64: base64Data,
        bytesLength: bytes.length,
        hex,
        parsed,
        response: result.text
      }, result.resp.status);
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
