// @ts-nocheck
import { Router, type IRouter } from "express";
import healthRouter from "./health";
import explainRouter from "./explain/index";
import generateRouter from "./explain/generate";
import analyzeRouter from "./explain/analyze";
import notifyWhatsappRouter from "./notify-whatsapp";
import razorpayRouter from "./razorpay";

const router: IRouter = Router();

router.use(healthRouter);
router.use(explainRouter);
router.use(generateRouter);
router.use(analyzeRouter);
router.use(notifyWhatsappRouter);
router.use(razorpayRouter);

export default router;
