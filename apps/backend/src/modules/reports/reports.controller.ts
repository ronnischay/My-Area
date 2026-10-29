import type { RequestHandler } from "express";
import { paginationMeta } from "../../lib/pagination.js";
import { IdParamSchema, parseInput } from "../../lib/validation.js";
import { getSocietyAuth } from "../../middleware/require-society.js";
import { CreateReportBodySchema, ListReportsQuerySchema } from "./reports.schemas.js";
import type { ReportsService } from "./reports.service.js";
import { toReportDto, toReportSummaryDto } from "./reports.types.js";

export function createReportsController({ service }: { service: ReportsService }) {
  const create: RequestHandler = async (req, res) => {
    const input = parseInput(CreateReportBodySchema, req.body);
    const auth = getSocietyAuth(req);
    res.status(201).json({ data: toReportDto(await service.create(auth, input), auth) });
  };

  const list: RequestHandler = async (req, res) => {
    const query = parseInput(ListReportsQuerySchema, req.query);
    const auth = getSocietyAuth(req);
    const { items, total } = await service.list(auth, query);
    res.json({
      data: items.map((item) => toReportSummaryDto(item, auth)),
      meta: paginationMeta(query.page, query.pageSize, total),
    });
  };

  const get: RequestHandler = async (req, res) => {
    const { id } = parseInput(IdParamSchema, req.params);
    const auth = getSocietyAuth(req);
    res.json({ data: toReportDto(await service.get(auth, id), auth) });
  };

  return { create, list, get };
}
