import { Router, type Request, type Response, type NextFunction } from "express";
import { getPublicAnalyticsSummary } from "./analytics.service.js";

const router = Router();

/**
 * GET /api/analytics/summary
 * Public endpoint to fetch anonymized project analytics and metrics.
 * Safe for public & recruiter viewing (zero PII, counts and farm codes only).
 */
router.get(
  "/summary",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await getPublicAnalyticsSummary();
      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

export const analyticsRouter = router;
