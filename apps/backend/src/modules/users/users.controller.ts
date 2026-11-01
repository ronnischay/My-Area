import type { Request, RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { paginationMeta } from "../../lib/pagination.js";
import { IdParamSchema, parseInput } from "../../lib/validation.js";
import { getAuth } from "../../middleware/require-auth.js";
import type { SocietyAuthContext } from "../../middleware/require-society.js";
import type { SocietiesService } from "../societies/societies.service.js";
import { InviteMemberBodySchema, ListMembersQuerySchema, UpdateMemberBodySchema } from "./users.schemas.js";
import type { InviteResult, UsersService } from "./users.service.js";
import { toSocietyMemberDto } from "./users.types.js";

const SocietyParamSchema = z.object({ societyId: z.uuid({ message: "Must be a valid id" }) });
const societyNotFound = () => new AppError(404, "NOT_FOUND", "Society not found");

/**
 * Checks `:societyId` for the signed-in user: an admin may use any existing society, a manager only
 * their own. Mount after requireAuth + requireRole.
 */
export function memberScope(societies: SocietiesService): RequestHandler {
  return async (req, _res, next) => {
    const { societyId } = parseInput(SocietyParamSchema, req.params);
    const auth = getAuth(req);
    if (auth.role === "ADMIN") await societies.get(societyId);
    else if (auth.societyId !== societyId) throw societyNotFound();
    next();
  };
}

/** The signed-in admin or manager, working on the society in the path (already checked by memberScope). */
const actorOf = (req: Request): SocietyAuthContext => ({ ...getAuth(req), societyId: parseInput(SocietyParamSchema, req.params).societyId });

const inviteResponse = ({ member, invite }: InviteResult) => ({ data: toSocietyMemberDto(member), meta: { invite } });

export function createUsersController({ service }: { service: UsersService }) {
  const list: RequestHandler = async (req, res) => {
    const query = parseInput(ListMembersQuerySchema, req.query);
    const { items, total } = await service.list(actorOf(req).societyId, query);
    res.json({ data: items.map(toSocietyMemberDto), meta: paginationMeta(query.page, query.pageSize, total) });
  };

  const invite: RequestHandler = async (req, res) => {
    const input = parseInput(InviteMemberBodySchema, req.body);
    res.status(201).json(inviteResponse(await service.invite(actorOf(req), input)));
  };

  const resendInvite: RequestHandler = async (req, res) => {
    const { id } = parseInput(IdParamSchema, req.params);
    res.json(inviteResponse(await service.resendInvite(actorOf(req), id)));
  };

  const update: RequestHandler = async (req, res) => {
    const { id } = parseInput(IdParamSchema, req.params);
    const patch = parseInput(UpdateMemberBodySchema, req.body);
    res.json({ data: toSocietyMemberDto(await service.update(actorOf(req), id, patch)) });
  };

  return { list, invite, resendInvite, update };
}
