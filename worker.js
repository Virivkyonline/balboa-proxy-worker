export default {
  async fetch(request) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response("", { headers: corsHeaders });
    }

    const user = "BalboaWaterAndroidApp";
    const pass = "SW2Bra7a!";
    const auth = "Basic " + btoa(user + ":" + pass);

    if (url.pathname === "/panelupdate") {
      const device = (url.searchParams.get("device") || "").trim();

      if (!device) {
        return new Response("Missing device", {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "text/plain"
          }
        });
      }

      const target = "https://my.idigi.com/ws/data/~/" + device + "/PanelUpdate.txt";

      try {
        const resp = await fetch(target, {
          method: "GET",
          headers: {
            "Authorization": auth
          }
        });

        const text = await resp.text();

        return new Response(text, {
          status: resp.status,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "text/plain"
          }
        });
      } catch (e) {
        return new Response("Worker error: " + e.message, {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "text/plain"
          }
        });
      }
    }

    if (url.pathname === "/devices") {
      const target = "https://my.idigi.com/ws/DeviceCore/.json";

      try {
        const resp = await fetch(target, {
          method: "GET",
          headers: {
            "Authorization": auth,
            "Accept": "application/json"
          }
        });

        const data = await resp.json();
        const items = Array.isArray(data.items) ? data.items : [];

        const filtered = items
          .filter(function (x) {
            return x.dpDeviceType === "BWG Spa";
          })
          .map(function (x) {
            return {
              devId: x.id && x.id.devId ? x.id.devId : "",
              devMac: x.devMac || "",
              dpLastKnownIp: x.dpLastKnownIp || "",
              devConnectwareId: x.devConnectwareId || "",
              grpId: x.grpId || "",
              cstId: x.cstId || "",
              dpGlobalIp: x.dpGlobalIp || "",
              dpConnectionStatus: x.dpConnectionStatus || "",
              dpLastConnectTime: x.dpLastConnectTime || ""
            };
          });

        return new Response(JSON.stringify(filtered, null, 2), {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json"
          }
        });
      } catch (e) {
        return new Response("Worker error: " + e.message, {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "text/plain"
          }
        });
      }
    }

    return new Response("Balboa worker running", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "text/plain"
      }
    });
  }
};
