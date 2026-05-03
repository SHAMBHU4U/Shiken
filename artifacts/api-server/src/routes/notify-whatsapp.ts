import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/notify-whatsapp", async (req, res) => {
  const apiKey = process.env["CALLMEBOT_API_KEY"];
  const phone = process.env["CALLMEBOT_PHONE"];
  const adminPhone = process.env["ADMIN_WHATSAPP_NUMBER"] ?? "918340472013";

  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) {
    return res.status(400).json({ ok: false, error: "message is required" });
  }

  if (!apiKey || !phone) {
    logger.warn("CallMeBot not configured");
    return res.status(503).json({ ok: false, error: "WhatsApp notifier not configured" });
  }

  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apiKey)}`;
  const upstream = await fetch(url);
  const text = await upstream.text();

  logger.info({ adminPhone, status: upstream.status }, "Sent WhatsApp notification");
  return res.status(upstream.ok ? 200 : 502).json({ ok: upstream.ok, status: upstream.status, response: text });
});

export default router;
