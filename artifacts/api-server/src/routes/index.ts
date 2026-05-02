import { Router, type IRouter } from "express";
import healthRouter from "./health";
import explainRouter from "./explain/index";
import generateRouter from "./explain/generate";
import analyzeRouter from "./explain/analyze";

const router: IRouter = Router();

router.use(healthRouter);
router.use(explainRouter);
router.use(generateRouter);
router.use(analyzeRouter);

export default router;
