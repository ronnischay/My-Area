import type { RequestHandler } from "express";
import { paginationMeta } from "../../lib/pagination.js";
import { IdParamSchema, parseInput } from "../../lib/validation.js";
import { getSocietyAuth } from "../../middleware/require-society.js";
import { preparePhoto } from "../media/media.validation.js";
import { CreateReportFormSchema, ListReportsQuerySchema, ResolutionPhotoFormSchema, UpdateStatusBodySchema } from "./reports.schemas.js";
import type { ReportsService } from "./reports.service.js";
import { toReportDto, toReportMediaDto, toReportSummaryDto } from "./reports.types.js";

export function createReportsController({ service }: { service: ReportsService }) {
  const create: RequestHandler = async (req, res) => {
    const { photo, ...input } = parseInput(CreateReportFormSchema, { ...req.body, photo: req.file });
    const auth = getSocietyAuth(req);
    const report = await service.create(auth, input, preparePhoto(photo));
    res.status(201).json({ data: toReportDto(report, auth) });
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

  const changeStatus: RequestHandler = async (req, res) => {
    const { id } = parseInput(IdParamSchema, req.params);
    const input = parseInput(UpdateStatusBodySchema, req.body);
    const auth = getSocietyAuth(req);
    res.json({ data: toReportDto(await service.changeStatus(auth, id, input), auth) });
  };

  const addResolutionPhoto: RequestHandler = async (req, res) => {
    const { id } = parseInput(IdParamSchema, req.params);
    const { photo } = parseInput(ResolutionPhotoFormSchema, { photo: req.file });
    const media = await service.addResolutionPhoto(getSocietyAuth(req), id, preparePhoto(photo));
    res.status(201).json({ data: toReportMediaDto(media) });
  };

  const vote: RequestHandler = async (req, res) => {
    const { id } = parseInput(IdParamSchema, req.params);
    res.status(201).json({ data: await service.vote(getSocietyAuth(req), id) });
  };

  const unvote: RequestHandler = async (req, res) => {
    const { id } = parseInput(IdParamSchema, req.params);
    res.json({ data: await service.unvote(getSocietyAuth(req), id) });
  };

  return { create, list, get, changeStatus, addResolutionPhoto, vote, unvote };
}
