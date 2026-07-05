import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import clothingRouter from "./clothing";
import outfitsRouter from "./outfits";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(clothingRouter);
router.use(outfitsRouter);

export default router;
