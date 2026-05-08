import { createFileRoute } from "@tanstack/react-router";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const Route = createFileRoute("/api/public/echoface/$endpoint")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ params }) =>
        Response.json(
          { ok: true, endpoint: params.endpoint, hint: "POST data to this endpoint" },
          { headers: cors },
        ),
      POST: async ({ params, request }) => {
        const body = await request.json().catch(() => ({}));
        const endpoint = params.endpoint;
        // Stubbed responses for the documented Echo Face API surface.
        switch (endpoint) {
          case "connect-esp32":
            return Response.json(
              { ok: true, paired: true, ip: body.host ?? null, ssid: body.ssid ?? null },
              { headers: cors },
            );
          case "lipread":
            return Response.json(
              { ok: true, text: "hello echo", confidence: 0.86 },
              { headers: cors },
            );
          case "ai-response":
            return Response.json(
              { ok: true, reply: `Acknowledged: ${body.text ?? ""}` },
              { headers: cors },
            );
          case "oled-display":
          case "speaker-output":
          case "camera-stream":
          case "microphone":
            return Response.json({ ok: true, dispatched: endpoint }, { headers: cors });
          default:
            return new Response(JSON.stringify({ ok: false, error: "unknown endpoint" }), {
              status: 404,
              headers: cors,
            });
        }
      },
    },
  },
});
