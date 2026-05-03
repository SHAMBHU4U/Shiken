// @ts-nocheck
import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import explainRouter from "./explain/index.js";
import generateRouter from "./explain/generate.js";
import analyzeRouter from "./explain/analyze.js";
import notifyWhatsappRouter from "./notify-whatsapp.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(explainRouter);
router.use(generateRouter);
router.use(analyzeRouter);
router.use(notifyWhatsappRouter);

export default router;
