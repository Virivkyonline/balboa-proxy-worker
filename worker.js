export default {
  async fetch(request) {
    return new Response("TEST 999", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }
};
