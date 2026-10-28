import type { RequestHandler } from "express";
import { paginationMeta } from "../../lib/pagination.js";
import { IdParamSchema, parseInput } from "../../lib/validation.js";
import { getSocietyAuth } from "../../middleware/require-society.js";
import { InviteMemberBodySchema, ListMembersQuerySchema, UpdateMemberBodySchema } from "./users.schemas.js";
import type { InviteResult, UsersService } from "./users.service.js";
import { toSocietyMemberDto } from "./users.types.js";

const inviteResponse = ({ member, invite }: InviteResult) => ({ data: toSocietyMemberDto(member), meta: { invite } });

export function createUsersController({ service }: { service: UsersService }) {
  const list: RequestHandler = async (req, res) => {
    const query = parseInput(ListMembersQuerySchema, req.query);
    const { items, total } = await service.list(getSocietyAuth(req).societyId, query);
    res.json({ data: items.map(toSocietyMemberDto), meta: paginationMeta(query.page, query.pageSize, total) });
  };

  const invite: RequestHandler = async (req, res) => {
    const input = parseInput(InviteMemberBodySchema, req.body);
    res.status(201).json(inviteResponse(await service.invite(getSocietyAuth(req), input)));
  };

  const resendInvite: RequestHandler = async (req, res) => {
    const { id } = parseInput(IdParamSchema, req.params);
    res.json(inviteResponse(await service.resendInvite(getSocietyAuth(req), id)));
  };

  const update: RequestHandler = async (req, res) => {
    const { id } = parseInput(IdParamSchema, req.params);
    const patch = parseInput(UpdateMemberBodySchema, req.body);
    res.json({ data: toSocietyMemberDto(await service.update(getSocietyAuth(req), id, patch)) });
  };

  return { list, invite, resendInvite, update };
}
