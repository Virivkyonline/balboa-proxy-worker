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

      const resp = await fetch(
        "https://my.idigi.com/ws/sci?unused=" + crypto.randomUUID(),
        {
          method: "POST",
          headers: {
            "Authorization": auth,
            "Content-Type": "text/xml",
            "Accept": "*/*"
          },
          body: body
        }
      );

      const xmlText = await resp.text();
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

      const result = {
        ok: resp.ok,
        status: resp.status,
        file: path,
        deviceId: deviceId,
        base64: base64Data,
        bytesLength: bytes.length,
        hex: hex,
        xml: xmlText
      };

      return new Response(JSON.stringify(result, null, 2), {
        status: resp.status,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json; charset=utf-8"
        }
      });
    }

    if (url.pathname === "/panelupdate") {
      return sciGetFile("PanelUpdate.txt");
    }

    if (url.pathname === "/deviceconfig") {
      return sciGetFile("DeviceConfiguration.txt");
    }

    return new Response("Balboa worker running", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }
};
