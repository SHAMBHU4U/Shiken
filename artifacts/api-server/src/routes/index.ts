// @ts-nocheck
import { Router, type IRouter } from "express";
import healthRouter from "./health";
import explainRouter from "./explain/index";
import generateRouter from "./explain/generate";
import analyzeRouter from "./explain/analyze";
import notifyWhatsappRouter from "./notify-whatsapp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(explainRouter);
router.use(generateRouter);
router.use(analyzeRouter);
router.use(notifyWhatsappRouter);

export default router;
