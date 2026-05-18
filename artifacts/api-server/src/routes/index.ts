// @ts-nocheck
import { Router, type IRouter } from "express";
import healthRouter from "./health";
import explainRouter from "./explain/index";
import generateRouter from "./explain/generate";
import analyzeRouter from "./explain/analyze";
import notifyWhatsappRouter from "./notify-whatsapp";
import razorpayRouter from "./razorpay";
import translateRouter from "./translate";
import parsePDFRouter from "./parse-pdf";
import comprehensionRouter from "./comprehension";
import generateMockRouter from "./generate-mock";
import referralRouter from "./referral";
import withdrawalRouter from "./withdrawal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(explainRouter);
router.use(generateRouter);
router.use(analyzeRouter);
router.use(notifyWhatsappRouter);
router.use(razorpayRouter);
router.use(translateRouter);
router.use(parsePDFRouter);
router.use(comprehensionRouter);
router.use(generateMockRouter);
router.use(referralRouter);
router.use(withdrawalRouter);

export default router;
