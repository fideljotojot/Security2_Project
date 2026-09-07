import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("OTP_FROM_EMAIL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Restrict to your frontend domain in production
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      405,
    );
  }

  if (!RESEND_API_KEY || !FROM_EMAIL) {
    console.error("Email service is not configured");
    return jsonResponse(
      { ok: false, error: "Email service unavailable" },
      500,
    );
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return jsonResponse(
        { ok: false, error: "Expected JSON request" },
        415,
      );
    }

    const body = await req.json();

    const email = String(body.email ?? "").trim().toLowerCase();
    const code = String(body.code ?? "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse(
        { ok: false, error: "Invalid request" },
        400,
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return jsonResponse(
        { ok: false, error: "Invalid request" },
        400,
      );
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: "Your Password Recovery Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
            <h2>Password Recovery</h2>
            <p>Use the following code to reset your password:</p>

            <div style="
              background: #f0f0f0;
              padding: 20px;
              text-align: center;
              margin: 20px 0;
            ">
              <strong style="font-size: 36px; letter-spacing: 8px;">
                ${code}
              </strong>
            </div>

            <p>This code expires in 10 minutes.</p>
            <p>If you did not request this code, you can ignore this email.</p>
          </div>
        `,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Resend error:", errorText);

      return jsonResponse(
        { ok: false, error: "Unable to send email" },
        502,
      );
    }

    return jsonResponse({
      ok: true,
      message: "OTP email sent successfully",
    });
  } catch (error) {
    console.error("Unexpected error:", error);

    return jsonResponse(
      { ok: false, error: "Internal server error" },
      500,
    );
  }
});
