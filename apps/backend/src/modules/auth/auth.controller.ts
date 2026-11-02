import type { RequestHandler, Response } from "express";
import { parseInput } from "../../lib/validation.js";
import { getAuth, sessionToken } from "../../middleware/require-auth.js";
import { SESSION_COOKIE, SESSION_TTL_MS } from "./auth.constants.js";
import {
  InviteAcceptBodySchema,
  InviteLookupBodySchema,
  LoginBodySchema,
  PasswordResetConfirmBodySchema,
  PasswordResetLookupBodySchema,
  PasswordResetRequestBodySchema,
} from "./auth.schemas.js";
import type { AuthService } from "./auth.service.js";
import type { PasswordResetService } from "./password-reset.service.js";
import { type SessionGrant, toCurrentUserDto, toInviteDetailsDto } from "./auth.types.js";

export function createAuthController({
  service,
  passwordReset,
  secureCookies,
}: {
  service: AuthService;
  passwordReset: PasswordResetService;
  secureCookies: boolean;
}) {
  const cookieOptions = { httpOnly: true, sameSite: "lax", secure: secureCookies, path: "/" } as const;

  const startSession = (res: Response, grant: SessionGrant) => {
    res.cookie(SESSION_COOKIE, grant.token, { ...cookieOptions, maxAge: SESSION_TTL_MS });
    res.json({ data: toCurrentUserDto(grant.user) });
  };

  const login: RequestHandler = async (req, res) => {
    const { email, password } = parseInput(LoginBodySchema, req.body);
    startSession(res, await service.login(email, password));
  };

  const logout: RequestHandler = async (req, res) => {
    await service.logout(sessionToken(req));
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.status(204).end();
  };

  const me: RequestHandler = async (req, res) => {
    const user = await service.getCurrentUser(getAuth(req).userId);
    res.json({ data: toCurrentUserDto(user) });
  };

  const lookupInvite: RequestHandler = async (req, res) => {
    const { token } = parseInput(InviteLookupBodySchema, req.body);
    res.json({ data: toInviteDetailsDto(await service.lookupInvite(token)) });
  };

  const acceptInvite: RequestHandler = async (req, res) => {
    const { token, password } = parseInput(InviteAcceptBodySchema, req.body);
    startSession(res, await service.acceptInvite(token, password));
  };

  /** 202 whatever the email: the response never says whether an account exists. */
  const requestPasswordReset: RequestHandler = async (req, res) => {
    const { email } = parseInput(PasswordResetRequestBodySchema, req.body);
    passwordReset.request(email);
    res.status(202).json({ data: { requested: true } });
  };

  const lookupPasswordReset: RequestHandler = async (req, res) => {
    const { token } = parseInput(PasswordResetLookupBodySchema, req.body);
    res.json({ data: await passwordReset.lookup(token) });
  };

  const confirmPasswordReset: RequestHandler = async (req, res) => {
    const { token, password } = parseInput(PasswordResetConfirmBodySchema, req.body);
    const { userId, token: sessionToken, expiresAt } = await passwordReset.confirm(token, password);
    startSession(res, { user: await service.getCurrentUser(userId), token: sessionToken, expiresAt });
  };

  return { login, logout, me, lookupInvite, acceptInvite, requestPasswordReset, lookupPasswordReset, confirmPasswordReset };
}
